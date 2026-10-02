/**
 * Auditoria e logs — o que o painel mostra na aba "Auditoria".
 *
 * O bot antigo nao registrava nada: a pagina de logs existia no painel e
 * ficava vazia para sempre, e o `/mod` nao deixava rastro de quem puniu quem.
 *
 * Aqui todo evento vira duas coisas:
 *   1. uma linha em `data/audit.json` (historico consultavel, sobrevive a restart)
 *   2. uma mensagem no canal configurado, se a categoria estiver ligada
 *
 * A mensagem e best-effort: canal sem permissao nao pode impedir a punicao de
 * ter efeito nem a auditoria de ser gravada.
 */
import type { Guild } from "discord.js";
import { bool, isEnabled, list, moduleConfig, str } from "./config.ts";
import type { Logger } from "./logger.ts";
import { buildLogPayload, type LogField } from "./panels.ts";
import { resolveChannel, resolveRoles } from "./resolve.ts";
import { mutate, nextId } from "./store.ts";

export type Severity = "info" | "warning" | "critical";

export type AuditEvent = {
  id: number;
  guildId: string;
  module: string;
  eventType: string;
  actorId?: string;
  targetId?: string;
  channelId?: string;
  severity: Severity;
  data?: Record<string, unknown>;
  at: string;
};

/** Categoria de evento -> chave do modulo `logs` que a habilita. */
const CATEGORY_FLAG: Record<string, string> = {
  moderation: "logModeration",
  members: "logMembers",
  messages: "logMessages",
  voice: "logVoice",
  roles: "logRoles",
  channels: "logChannels",
  bans: "logBans",
  automod: "logAutoMod"
};

/**
 * Grava o evento no historico. Devolve o id para correlacionar com a mensagem.
 * Nunca lanca: auditoria nao pode derrubar a acao que esta sendo auditada.
 */
export async function recordAudit(input: Omit<AuditEvent, "id" | "at">): Promise<number | null> {
  try {
    const id = await nextId("audit");
    const at = new Date().toISOString();

    await mutate<AuditEvent>("audit", (rows) => {
      rows.push({ ...input, id, at });
      return rows;
    });

    return id;
  } catch {
    return null;
  }
}

/**
 * Publica no canal de logs, respeitando a categoria.
 * Devolve `false` quando nao havia canal, permissao ou a categoria esta desligada.
 */
export async function shouldIgnoreLogEvent(
  guild: Guild,
  config: Record<string, unknown> | null,
  details: { actorId?: string; targetId?: string; channelId?: string } = {}
): Promise<boolean> {
  if (!config || !isEnabled(config)) return true;

  if (details.actorId && details.actorId === guild.client.user?.id && bool(config, "ignoreBotMessages", true)) {
    return true;
  }

  const ignoredUsers = new Set(list(config, "ignoredUserIds"));
  if (details.actorId && ignoredUsers.has(details.actorId)) return true;
  if (details.targetId && ignoredUsers.has(details.targetId)) return true;

  const ignoredMentionInChannel = list(config, "ignoredChannelIds");
  if (details.channelId && ignoredMentionInChannel.includes(details.channelId)) return true;

  const ignoredRoleIds = new Set(
    resolveRoles(guild, list(config, "ignoredRoleIds")).map((role) => role.id)
  );

  const actorMember = details.actorId ? await guild.members.fetch(details.actorId).catch(() => null) : null;
  const targetMember = details.targetId ? await guild.members.fetch(details.targetId).catch(() => null) : null;

  if (actorMember && actorMember.roles.cache.some((role) => ignoredRoleIds.has(role.id))) return true;
  if (targetMember && targetMember.roles.cache.some((role) => ignoredRoleIds.has(role.id))) return true;

  return false;
}

export async function logToChannel(
  guild: Guild,
  category: keyof typeof CATEGORY_FLAG | string,
  payload: { title: string; description: string; accentColor?: string; fields?: LogField[] },
  log: Logger,
  details: { actorId?: string; targetId?: string; channelId?: string } = {}
): Promise<boolean> {
  try {
    const config = await moduleConfig(guild.id, "logs");
    if (!isEnabled(config)) return false;

    const flag = CATEGORY_FLAG[category];
    if (flag && !bool(config, flag, true)) return false;
    if (await shouldIgnoreLogEvent(guild, config, details)) return false;

    const channel = resolveChannel(guild, str(config, "channelId"));
    if (!channel || !channel.isTextBased()) return false;

    await channel.send(buildLogPayload(payload) as never);
    return true;
  } catch (error) {
    log.warn("nao consegui publicar no canal de logs", { guildId: guild.id, category, error: String(error) });
    return false;
  }
}

/** Auditoria + canal num passo so — o caso comum. */
export async function auditAndLog(
  guild: Guild,
  input: {
    module: string;
    category: string;
    eventType: string;
    actorId?: string;
    targetId?: string;
    channelId?: string;
    severity?: Severity;
    title: string;
    description: string;
    accentColor?: string;
    fields?: LogField[];
    data?: Record<string, unknown>;
  },
  log: Logger
): Promise<void> {
  await recordAudit({
    guildId: guild.id,
    module: input.module,
    eventType: input.eventType,
    actorId: input.actorId,
    targetId: input.targetId,
    channelId: input.channelId,
    severity: input.severity ?? "info",
    data: input.data
  });

  await logToChannel(
    guild,
    input.category,
    {
      title: input.title,
      description: input.description,
      accentColor: input.accentColor,
      fields: input.fields
    },
    log,
    {
      actorId: input.actorId,
      targetId: input.targetId,
      channelId: input.channelId
    }
  );
}

/**
 * Descarta eventos mais antigos que `retentionDays` do modulo de logs.
 * Sem isso o arquivo de auditoria cresce para sempre.
 */
export async function pruneAudit(log: Logger, retentionDays = 180): Promise<number> {
  try {
    const days = Math.max(7, Math.trunc(retentionDays) || 180);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    let removed = 0;
    await mutate<AuditEvent>("audit", (rows) => {
      const kept = rows.filter((row) => {
        const at = Date.parse(row.at);
        return !Number.isFinite(at) || at >= cutoff;
      });
      removed = rows.length - kept.length;
      return kept;
    });

    if (removed > 0) log.info("auditoria podada", { removed, retentionDays: days });
    return removed;
  } catch {
    return 0;
  }
}
