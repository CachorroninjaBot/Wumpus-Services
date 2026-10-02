/**
 * Automacoes — execucao de acoes com guardas.
 *
 * O painel tem `dryRun`, `maxActionsPerHour`, `requireApprovalForDestructiveActions`,
 * `allowChannelCreate`, `allowRoleAssign`, `retryOnFailure`... e o bot nao tinha
 * nenhum executor. Eram os campos mais perigosos de todos ficando sem efeito:
 * quem configurasse "permitir criar canal" nao tinha como saber que nada acontecia.
 *
 * Toda acao passa por `runAction`. As guardas sao checadas ANTES de qualquer
 * efeito, e `dryRun` registra o que TERIA acontecido sem tocar no servidor.
 */
import { ChannelType, type Guild } from "discord.js";
import { bool, isEnabled, moduleConfig, num, str } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { resolveChannel, resolveRole } from "./resolve.ts";

export type ActionKind = "channelCreate" | "roleAssign" | "sendMessage" | "nicknameChange";

export type ActionRequest = {
  kind: ActionKind;
  /** Id do alvo, quando a acao precisa de um. */
  targetId?: string;
  /** Nome do canal a criar, ou o apelido a definir. */
  value?: string;
  /** Texto a enviar, quando `sendMessage`. */
  message?: string;
};

export type ActionResult = {
  ok: boolean;
  /** `true` quando nada foi executado de verdade (dry-run). */
  simulated: boolean;
  detail: string;
};

/** Janela de limite por hora, por servidor. */
const actionWindows = new Map<string, number[]>();

function withinLimit(guildId: string, maxPerHour: number): boolean {
  if (maxPerHour <= 0) return true;

  const now = Date.now();
  const kept = (actionWindows.get(guildId) ?? []).filter((at) => now - at < 3_600_000);

  if (kept.length >= maxPerHour) {
    actionWindows.set(guildId, kept);
    return false;
  }

  kept.push(now);
  actionWindows.set(guildId, kept);
  return true;
}

/** A acao e destrutiva? As destrutivas podem exigir aprovacao humana. */
function isDestructive(kind: ActionKind): boolean {
  return kind === "channelCreate";
}

/**
 * Executa uma acao de automacao, respeitando todas as guardas do painel.
 *
 * A ordem importa: primeiro as permissoes, depois o limite, depois dry-run.
 * Assim uma acao barrada por permissao nao consome cota de hora.
 */
export async function runAction(
  guild: Guild,
  request: ActionRequest,
  log: Logger
): Promise<ActionResult> {
  const config = await moduleConfig(guild.id, "automations");

  if (!isEnabled(config)) {
    return { ok: false, simulated: false, detail: "Automacoes desligadas neste servidor." };
  }

  // 1. A acao e permitida?
  const allowedFlag: Record<ActionKind, string> = {
    channelCreate: "allowChannelCreate",
    roleAssign: "allowRoleAssign",
    sendMessage: "allowSendMessage",
    nicknameChange: "allowNicknameChange"
  };

  if (!bool(config, allowedFlag[request.kind], false)) {
    return {
      ok: false,
      simulated: false,
      detail: `A acao "${request.kind}" nao esta liberada neste servidor.`
    };
  }

  // 2. Limite por hora (nao consome cota se a acao for barrada depois).
  const maxPerHour = Math.trunc(num(config, "maxActionsPerHour", 30));
  if (!withinLimit(guild.id, maxPerHour)) {
    return {
      ok: false,
      simulated: false,
      detail: `Limite de ${maxPerHour} acoes por hora atingido.`
    };
  }

  // 3. Destrutiva com aprovacao obrigatoria: registra e para aqui.
  if (isDestructive(request.kind) && bool(config, "requireApprovalForDestructiveActions", true)) {
    const notify = resolveChannel(guild, str(config, "notifyChannelId"));

    await auditAndLog(
      guild,
      {
        module: "automations",
        category: "channels",
        eventType: "automation_awaiting_approval",
        severity: "warning",
        title: "AUTOMACAO AGUARDANDO APROVACAO",
        description: `Acao **${request.kind}** precisa de aprovacao manual.`,
        accentColor: "#f5a524",
        fields: [
          { name: "Acao", value: request.kind },
          ...(request.value ? [{ name: "Valor", value: request.value }] : []),
          ...(request.targetId ? [{ name: "Alvo", value: `<@${request.targetId}>` }] : [])
        ]
      },
      log
    );

    if (notify?.isTextBased()) {
      await notify
        .send(`Aprovacao pendente: **${request.kind}**${request.value ? ` (${request.value})` : ""}`)
        .catch(() => undefined);
    }

    return { ok: false, simulated: false, detail: "Acao registrada para aprovacao manual." };
  }

  // 4. Dry-run: registra a intencao e nao toca no servidor.
  if (bool(config, "dryRun", false)) {
    log.info("automacao em dry-run", { guildId: guild.id, kind: request.kind, value: request.value });
    return { ok: true, simulated: true, detail: "Simulado (dry-run ligado)." };
  }

  // 5. Execucao, com as tentativas configuradas.
  const attempts = bool(config, "retryOnFailure", true)
    ? Math.max(1, Math.trunc(num(config, "maxRetries", 3)))
    : 1;

  let lastError = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const detail = await execute(guild, request);
      log.info("automacao executada", { guildId: guild.id, kind: request.kind, attempt });
      return { ok: true, simulated: false, detail };
    } catch (error) {
      lastError = String(error).slice(0, 300);
      log.warn("tentativa de automacao falhou", {
        guildId: guild.id,
        kind: request.kind,
        attempt,
        error: lastError
      });
    }
  }

  await auditAndLog(
    guild,
    {
      module: "automations",
      category: "channels",
      eventType: "automation_failed",
      severity: "warning",
      title: "AUTOMACAO FALHOU",
      description: `Acao **${request.kind}** falhou apos ${attempts} tentativa(s).`,
      accentColor: "#ff5c6c",
      fields: [
        { name: "Acao", value: request.kind },
        { name: "Erro", value: lastError || "desconhecido" }
      ]
    },
    log
  );

  return { ok: false, simulated: false, detail: lastError || "Falhou." };
}

/** Executa de fato uma acao ja liberada pelas guardas. */
async function execute(guild: Guild, request: ActionRequest): Promise<string> {
  if (request.kind === "channelCreate") {
    const name = (request.value ?? "canal").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90);
    const channel = await guild.channels.create({ name, type: ChannelType.GuildText });
    return `Canal <#${channel.id}> criado.`;
  }

  if (request.kind === "roleAssign") {
    if (!request.targetId || !request.value) throw new Error("Faltam alvo e cargo.");

    const member = await guild.members.fetch(request.targetId);
    const role = resolveRole(guild, request.value);
    if (!role) throw new Error(`Cargo "${request.value}" nao existe neste servidor.`);

    const me = guild.members.me;
    if (me && role.position >= me.roles.highest.position) {
      throw new Error("O cargo esta acima do meu na hierarquia.");
    }

    await member.roles.add(role, "automacao do Wumpus");
    return `Cargo ${role.name} dado a <@${request.targetId}>.`;
  }

  if (request.kind === "sendMessage") {
    if (!request.targetId || !request.message) throw new Error("Faltam canal e mensagem.");

    const channel = guild.channels.cache.get(request.targetId);
    if (!channel?.isTextBased()) throw new Error("Canal invalido.");

    await channel.send(request.message.slice(0, 2000));
    return `Mensagem enviada em <#${channel.id}>.`;
  }

  if (request.kind === "nicknameChange") {
    if (!request.targetId || !request.value) throw new Error("Faltam alvo e apelido.");

    const member = await guild.members.fetch(request.targetId);
    await member.setNickname(request.value.slice(0, 32), "automacao do Wumpus");
    return `Apelido de <@${request.targetId}> alterado.`;
  }

  throw new Error(`Acao desconhecida: ${String(request.kind)}`);
}

/** Estado atual das automacoes, para o `/config status`. */
export async function automationsStatus(guildId: string): Promise<string> {
  const config = await moduleConfig(guildId, "automations");
  if (!isEnabled(config)) return "Automacoes desligadas.";

  const mode = bool(config, "dryRun", false) ? "simulacao (dry-run)" : "execucao real";
  const approval = bool(config, "requireApprovalForDestructiveActions", true) ? "sim" : "nao";
  const limit = Math.trunc(num(config, "maxActionsPerHour", 30));

  return [
    `Modo: **${mode}**`,
    `Aprovacao para destrutivas: **${approval}**`,
    `Limite: **${limit}** acoes/hora`
  ].join(" · ");
}
