/**
 * Direitos de acesso — quem pode ver o que.
 *
 * Antes disto o painel nao checava NADA:
 *   - `owner-workspace.ts` marcava `isAdmin: true` para todo mundo que logava;
 *   - o plano era `"pro"` fixo, entao todo servidor vinha liberado;
 *   - `installed: true` fixo, entao servidor sem o bot aparecia igual;
 *   - as licencas vinham todas `"active"`.
 *
 * REGRA ATUAL (por pedido explicito do dono do produto): o painel e de uso
 * EXCLUSIVO de quem responde pelo servidor. Na pratica:
 *
 *   1. a pessoa precisa ser DONA do servidor no Discord (`owner: true`);
 *   2. o Wumpus precisa estar instalado naquele servidor;
 *   3. ela precisa ter assinatura ativa que cubra aquele servidor.
 *
 * Ser administrador NAO basta, e ser staff/membro nao da acesso nenhum. Isso e
 * proposital: a equipe enxerga o resultado do trabalho no Discord (tickets,
 * logs, punicoes), nunca o painel de configuracao — que fica com quem contratou.
 *
 * As funcoes aqui sao puras de proposito: da para testar cada regra sem rede.
 */
import { planById, serverLimit, type PlanId } from "./catalog.ts";
import { isPlatformOwner } from "./owner.ts";

/** Assinatura vinda da ShardPay, reduzida ao que importa aqui. */
export type SubscriptionLite = {
  status: string;
  planId: PlanId | null;
  discordUsername: string | null;
  discordUserId?: string | null;
};

/**
 * Status que dao direito de uso.
 *
 * `past_due` e `canceled` ficam DE FORA de proposito: assinatura com pagamento
 * falhando nao deve manter o painel liberado indefinidamente.
 */
const ENTITLED_STATUS = new Set(["active", "trialing", "paid", "authorized", "succeeded"]);

/** Ordem de grandeza para escolher o melhor plano quando ha mais de um. */
const PLAN_WEIGHT: Record<PlanId, number> = {
  essencial: 1,
  pro: 2,
  escala: 3,
  vitalicio: 4,
};

function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^@/, "");
}

/**
 * A assinatura pertence a esta pessoa?
 *
 * Casamos por id quando a ShardPay mandar, e por nome de usuario como reserva —
 * o nome e o que a API expoe hoje (`discord_username`).
 */
function belongsTo(sub: SubscriptionLite, userId: string, username: string): boolean {
  if (sub.discordUserId && sub.discordUserId === userId) return true;
  const a = normalizeUsername(sub.discordUsername);
  const b = normalizeUsername(username);
  return Boolean(a) && a === b;
}

/**
 * O melhor plano ATIVO desta pessoa, ou `null` se ela nao tem assinatura valida.
 * Devolve o mais alto quando ha mais de um (quem assina Pro e Escala nao perde).
 */
export function planForUser(
  subscriptions: SubscriptionLite[],
  userId: string,
  username: string
): { plan: PlanId; status: string } | null {
  const active = subscriptions.filter(
    (sub) => sub.planId && ENTITLED_STATUS.has(sub.status.toLowerCase()) && belongsTo(sub, userId, username)
  );

  if (!active.length) return null;

  const best = active.reduce((winner, sub) =>
    PLAN_WEIGHT[sub.planId!] > PLAN_WEIGHT[winner.planId!] ? sub : winner
  );

  return { plan: best.planId!, status: best.status };
}

export type EntitlementInput = {
  discordUserId: string;
  discordUsername: string;
  /**
   * Servidores onde a pessoa e DONA (`owner: true` no OAuth do Discord).
   *
   * Nao e "servidores que ela administra": ter permissao de administrador nao
   * da acesso ao painel. Um cargo de staff nao pode configurar o produto.
   */
  ownedGuildIds: string[];
  /** Servidores onde o BOT esta de fato presente. */
  botGuildIds: string[];
  subscriptions: SubscriptionLite[];
};

export type Entitlements = {
  isOwner: boolean;
  /** `null` = sem assinatura ativa. */
  plan: PlanId | null;
  planName: string | null;
  /** Servidores que a pessoa pode configurar. */
  guildIds: string[];
  /** Dentro do direito, mas acima do limite do plano. */
  overLimitGuildIds: string[];
  /** Limite de servidores do plano; `null` = ilimitado. */
  limit: number | null;
  reason: "owner" | "subscribed" | "no-subscription";
};

/**
 * Resolve tudo de uma vez.
 *
 * Regras:
 *   1. O dono da plataforma passa por cima de tudo (acesso total, sem limite).
 *   2. Sem assinatura ativa: nenhum servidor, e o motivo fica explicito para a
 *      interface poder dizer POR QUE a tela esta vazia.
 *   3. Servidor so entra se o BOT ESTIVER NELE e a pessoa for DONA — os dois.
 *   4. O limite do plano corta o excedente; nao escondemos em silencio, o que
 *      sobra vai em `overLimitGuildIds` para a interface avisar.
 */
export function resolveEntitlements(input: EntitlementInput): Entitlements {
  const isOwner = isPlatformOwner(input.discordUserId);
  const bot = new Set(input.botGuildIds);
  const eligible = input.ownedGuildIds.filter((id) => bot.has(id));

  if (isOwner) {
    return {
      isOwner: true,
      plan: "escala",
      planName: planById("escala").name,
      guildIds: eligible,
      overLimitGuildIds: [],
      limit: null,
      reason: "owner",
    };
  }

  const sub = planForUser(input.subscriptions, input.discordUserId, input.discordUsername);

  if (!sub) {
    return {
      isOwner: false,
      plan: null,
      planName: null,
      guildIds: [],
      overLimitGuildIds: [],
      limit: null,
      reason: "no-subscription",
    };
  }

  const limit = serverLimit(sub.plan);
  const allowed = limit === null ? eligible : eligible.slice(0, limit);
  const overLimit = limit === null ? [] : eligible.slice(limit);

  return {
    isOwner: false,
    plan: sub.plan,
    planName: planById(sub.plan).name,
    guildIds: allowed,
    overLimitGuildIds: overLimit,
    limit,
    reason: "subscribed",
  };
}

/** Pode adicionar mais um servidor? Usado ao entrar com um novo servidor. */
export function canAddServer(entitlements: Entitlements, currentCount: number): boolean {
  if (entitlements.isOwner) return true;
  if (!entitlements.plan) return false;
  const limit = serverLimit(entitlements.plan);
  if (limit === null) return true;
  return currentCount < limit;
}

/** Texto curto do estado, para a interface nao inventar o proprio. */
export function describeEntitlements(entitlements: Entitlements): string {
  if (entitlements.reason === "owner") return "Acesso de dono da plataforma.";
  if (entitlements.reason === "no-subscription") {
    return "Nenhuma assinatura ativa encontrada para esta conta do Discord.";
  }

  const limit = entitlements.limit;
  const used = entitlements.guildIds.length;

  if (limit === null) return `${entitlements.planName} · servidores ilimitados.`;
  return `${entitlements.planName} · ${used} de ${limit} servidores.`;
}
