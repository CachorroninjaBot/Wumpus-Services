/**
 * Monta o workspace de quem entrou com Discord.
 *
 * O que este arquivo fazia de errado, e que deixava o painel sem qualquer
 * checagem:
 *   - `isAdmin: true` para todo mundo → qualquer login virava admin;
 *   - `plan: "pro"` fixo → todo servidor vinha com o plano pago liberado;
 *   - `installed: true` fixo → servidor sem o bot aparecia como instalado;
 *   - licencas todas `"active"` → nada refletia assinatura real.
 *
 * Agora quem decide e `resolveEntitlements`, e aqui so montamos o estado a
 * partir dessa decisao. Se a pessoa nao tem assinatura ativa, ela entra com a
 * lista de servidores VAZIA — nao com tudo liberado.
 */
import { defaultsFor, type ModuleKey } from "./defaults";
import type { Entitlements } from "./entitlements";
import { planById } from "./catalog";
import type { Guild, GuildModules, License, SessionUser } from "./types";

const MODULES: ModuleKey[] = [
  "servers",
  "tickets",
  "forms",
  "moderation",
  "automod",
  "security",
  "logs",
  "staff",
  "knowledge",
  "statistics",
  "roles",
];

function emptyModules(): GuildModules {
  const out = {} as GuildModules;
  for (const key of MODULES) out[key] = { enabled: true, config: defaultsFor(key) };
  return out;
}

export type DiscordGuildLite = {
  id: string;
  name: string;
  owner: boolean;
  iconUrl?: string | null;
};

export function buildWorkspace(
  user: { id: string; username: string; globalName: string; avatar?: string | null },
  guilds: DiscordGuildLite[],
  entitlements: Entitlements,
) {
  // So os servidores que passaram na checagem: bot presente + pessoa administra
  // + dentro do limite do plano.
  const allowed = new Set(entitlements.guildIds);
  const entitled = guilds.filter((g) => allowed.has(g.id));

  // O plano aplicado a cada servidor e o plano REAL da assinatura. Sem
  // assinatura (`plan === null`) nao ha servidor, entao o fallback so cobre o
  // caso do dono, que ja vem com "escala" resolvido.
  const plan = entitlements.plan ?? "essencial";

  const list: Guild[] = entitled.map((g) => ({
    id: g.id,
    name: g.name,
    tag: g.name.slice(0, 2).toUpperCase(),
    memberCount: 0,
    online: 0,
    plan,
    preset: "community" as const,
    // Chegou aqui porque o bot esta no servidor — isso ja foi verificado.
    installed: true,
    region: "Discord",
    iconUrl: g.iconUrl ?? null,
  }));

  const modules: Record<string, GuildModules> = {};
  const channels: Record<string, { id: string; name: string; type: "text" | "category" | "voice"; parentId: string | null }[]> = {};
  const roles: Record<string, { id: string; name: string; color: string; position: number; staff?: boolean }[]> = {};
  const formQuestions: Record<string, { id: string; label: string; required: boolean }[]> = {};

  for (const g of list) {
    modules[g.id] = emptyModules();
    channels[g.id] = [];
    roles[g.id] = [{ id: `owner-${g.id}`, name: "Dono", color: "#f5d76e", position: 50, staff: true }];
    formQuestions[g.id] = [
      { id: "q1", label: "Qual o seu nome ou apelido?", required: true },
      { id: "q2", label: "Por que quer fazer parte da equipe?", required: true },
      { id: "q3", label: "Qual a sua experiência relevante?", required: true },
    ];
  }

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    // A unica fonte de verdade do admin: o id do dono da plataforma.
    isAdmin: entitlements.isOwner,
    signedIn: true,
    avatar: user.avatar ?? null,
  };

  const licenses: License[] = list.map((g) => ({
    id: `lic-${g.id}`,
    guildName: g.name,
    plan,
    seats: 5,
    expires: "—",
    status: "active" as const,
  }));

  const first = list[0];

  return {
    activeGuildId: first?.id ?? "",
    guilds: list,
    members: first
      ? [
          {
            id: user.id,
            guildId: first.id,
            username: user.username,
            displayName: user.globalName,
            hue: 262,
            roleIds: [`owner-${first.id}`],
            joinedAt: Date.now(),
            strikes: 0,
            status: "online" as const,
            accountCreatedAt: Date.now(),
            timedOutUntil: null,
            banned: false,
          },
        ]
      : [],
    tickets: [],
    formQuestions,
    submissions: [],
    cases: [],
    automodHits: [],
    incidents: [],
    articles: [],
    logs: [
      {
        id: "l-login",
        guildId: first?.id ?? "",
        at: Date.now(),
        actor: user.globalName,
        category: "auth",
        summary: entitlements.isOwner
          ? "Entrou com Discord. Acesso de dono da plataforma."
          : `Entrou com Discord. ${entitlements.planName ?? "Sem assinatura"} · ${list.length} servidor(es).`,
      },
    ],
    modules,
    channels,
    roles,
    dashboardMembers: [{ id: user.id, username: user.username, role: "owner" as const, addedAt: Date.now() }],
    licenses,
    posts: [],
    publishQueue: [],
    recentMessages: [],
    sessionUser,
    theme: "dark" as const,
  };
}

/** Nome do plano para exibir, sem o prefixo comercial. */
export function planLabel(entitlements: Entitlements): string {
  return entitlements.plan ? planById(entitlements.plan).name : "Sem assinatura";
}
