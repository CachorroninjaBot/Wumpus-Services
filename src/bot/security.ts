import {
  AuditLogEvent,
  Routes,
  type Client,
  type Guild,
  type GuildAuditLogsEntry,
  type GuildMember
} from "discord.js";
import { getPool, recordAuditEvent, resolveModuleConfig } from "../server/db/index.js";
import { buildLogPayload } from "./panels.js";

/**
 * Anti-raid e anti-nuke.
 *
 * Principios de desenho:
 * - Deteccao por janela deslizante, na memoria do processo. Nao precisa de
 *   tabela: se o bot reiniciar no meio de uma raid, a contagem recomeca — e
 *   isso e aceitavel, porque o alerta ja foi enviado.
 * - NUNCA age contra o dono do servidor, contra o proprio bot ou contra um
 *   cargo confiavel. Isso e verificado antes de qualquer punicao.
 * - Toda deteccao vira registro em `incidents` e alerta no canal configurado.
 *   A equipe decide; o bot contem o obvio.
 * - Resfriamento por incidente: sem ele, uma raid de 200 contas geraria 200
 *   alertas identicos.
 */

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

/** Acoes que contam para o anti-nuke. */
const DESTRUCTIVE_ACTIONS = new Set<AuditLogEvent>([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
  AuditLogEvent.WebhookCreate
]);

const ACTION_LABELS: Partial<Record<AuditLogEvent, string>> = {
  [AuditLogEvent.ChannelDelete]: "canal apagado",
  [AuditLogEvent.RoleDelete]: "cargo apagado",
  [AuditLogEvent.MemberBanAdd]: "membro banido",
  [AuditLogEvent.MemberKick]: "membro expulso",
  [AuditLogEvent.WebhookCreate]: "webhook criado"
};

type Hit = { at: number; userId: string };

const joinHits = new Map<string, Hit[]>();
const actionHits = new Map<string, Hit[]>();
const lastIncident = new Map<string, number>();

/** Uma ocorrencia por janela evita 40 alertas para a mesma raid. */
const INCIDENT_COOLDOWN_MS = 3 * 60_000;
/** Teto de contencao por incidente, para nao disparar centenas de chamadas. */
const MAX_CONTAINMENTS = 10;

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function record(map: Map<string, Hit[]>, key: string, userId: string, now: number, windowMs: number): Hit[] {
  const list = (map.get(key) ?? []).filter((hit) => now - hit.at < windowMs);
  list.push({ at: now, userId });
  map.set(key, list);
  return list;
}

function onCooldown(key: string): boolean {
  return Date.now() - (lastIncident.get(key) ?? 0) < INCIDENT_COOLDOWN_MS;
}

function describeResponse(value: string): string {
  if (value === "timeout_suspect") return "Timeout preventivo nos suspeitos";
  if (value === "lockdown_review") return "Bloqueio preventivo e revisão";
  return "Apenas alertar a equipe";
}

/** Nunca age contra o dono, contra o proprio bot ou contra cargo confiavel. */
async function isExempt(guild: Guild, userId: string, trustedRoleIds: string[]): Promise<boolean> {
  if (userId === guild.ownerId) return true;
  if (userId === guild.client.user?.id) return true;
  if (trustedRoleIds.length === 0) return false;
  try {
    const member = await guild.members.fetch(userId);
    return member.roles.cache.some((role) => trustedRoleIds.includes(role.id));
  } catch {
    return false;
  }
}

/** Reutilizado pelo AutoMod: uma unica implementacao de timeout no projeto. */
export async function applyTimeout(
  client: Client,
  guildId: string,
  userId: string,
  minutes: number
): Promise<boolean> {
  try {
    await client.rest.patch(Routes.guildMember(guildId, userId), {
      body: { communication_disabled_until: new Date(Date.now() + minutes * 60_000).toISOString() }
    });
    return true;
  } catch {
    return false;
  }
}

/** Bloqueio preventivo: exige conta verificada para entrar. */
async function raiseVerification(client: Client, guildId: string): Promise<boolean> {
  try {
    await client.rest.patch(Routes.guild(guildId), { body: { verification_level: 4 } });
    return true;
  } catch {
    return false;
  }
}

async function openIncident(input: {
  guildId: string;
  type: "raid" | "nuke";
  severity: "high" | "critical";
  actorId: string | null;
  details: Record<string, unknown>;
}): Promise<number | null> {
  try {
    const result = await getPool().query<{ id: number }>(
      `insert into incidents (guild_id, incident_type, severity, actor_id, details)
       values ($1, $2, $3, $4, $5::jsonb) returning id`,
      [input.guildId, input.type, input.severity, input.actorId, JSON.stringify(input.details)]
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function alert(
  client: Client,
  channelId: string,
  payload: Parameters<typeof buildLogPayload>[0],
  log: Logger
): Promise<void> {
  if (!channelId) return;
  try {
    await client.rest.post(Routes.channelMessages(channelId), { body: buildLogPayload(payload) });
  } catch (error) {
    log.error("falha ao enviar o alerta de seguranca", { error: String(error) });
  }
}

/* ------------------------------------------------------------------ *
 * Anti-raid
 * ------------------------------------------------------------------ */

export async function handleMemberAdd(client: Client, member: GuildMember, log: Logger): Promise<void> {
  if (member.user.bot) return;

  const guild = member.guild;
  const config = await resolveModuleConfig(guild.id, "security");
  if (!config.enabled) return;

  const threshold = num(config.config.raidJoinThreshold, 12);
  const windowMs = num(config.config.raidWindowSeconds, 60) * 1000;
  const now = Date.now();

  const hits = record(joinHits, guild.id, member.id, now, windowMs);
  if (hits.length < threshold) return;

  const incidentKey = `${guild.id}:raid`;
  if (onCooldown(incidentKey)) return;
  lastIncident.set(incidentKey, now);

  const suspects = [...new Set(hits.map((hit) => hit.userId))];
  const trustedRoleIds = asList(config.config.trustedRoleIds);
  const response = asString(config.config.response) || "alert";
  const timeoutMinutes = num(config.config.timeoutMinutes, 60);

  const incidentId = await openIncident({
    guildId: guild.id,
    type: "raid",
    severity: hits.length >= threshold * 2 ? "critical" : "high",
    actorId: null,
    details: {
      joins: hits.length,
      windowSeconds: windowMs / 1000,
      threshold,
      suspects: suspects.slice(-MAX_CONTAINMENTS)
    }
  });

  let contained = 0;
  if (response !== "alert") {
    for (const userId of suspects.slice(-MAX_CONTAINMENTS)) {
      if (await isExempt(guild, userId, trustedRoleIds)) continue;
      if (await applyTimeout(client, guild.id, userId, timeoutMinutes)) contained += 1;
    }
  }
  const verificationRaised = response === "lockdown_review" ? await raiseVerification(client, guild.id) : false;

  // Zera a janela: sem isso o proximo join ja estouraria o limite de novo.
  joinHits.set(guild.id, []);

  await recordAuditEvent({
    guildId: guild.id,
    module: "security",
    eventType: "raid_detected",
    severity: "critical",
    data: { joins: hits.length, threshold, contained, verificationRaised, incidentId }
  });

  await alert(
    client,
    asString(config.config.alertChannelId),
    {
      title: "Possível raid detectado",
      description: `Entraram **${hits.length} contas** em ${windowMs / 1000}s (limite configurado: ${threshold}).`,
      accentColor: "#ff5c6c",
      fields: [
        { name: "Resposta aplicada", value: describeResponse(response), inline: true },
        { name: "Contidos", value: `${contained} conta(s) com timeout`, inline: true },
        {
          name: "Bloqueio preventivo",
          value: verificationRaised ? "Nível de verificação elevado" : "não aplicado",
          inline: true
        },
        {
          name: "O que fazer agora",
          value: "Confirme no canal de entradas se essas contas são legítimas. Se não forem, mantenha o bloqueio e revise os convites ativos.",
          inline: false
        }
      ]
    },
    log
  );

  log.info("raid detectado", { guildId: guild.id, joins: hits.length, contained, verificationRaised });
}

/* ------------------------------------------------------------------ *
 * Anti-nuke
 * ------------------------------------------------------------------ */

export async function handleAuditLogEntry(
  client: Client,
  entry: GuildAuditLogsEntry,
  guild: Guild,
  log: Logger
): Promise<void> {
  if (!DESTRUCTIVE_ACTIONS.has(entry.action)) return;

  const executorId = entry.executorId;
  if (!executorId || executorId === guild.client.user?.id) return;

  const config = await resolveModuleConfig(guild.id, "security");
  if (!config.enabled) return;

  const threshold = num(config.config.nukeActionThreshold, 5);
  const windowMs = num(config.config.nukeWindowSeconds, 30) * 1000;
  const now = Date.now();
  const hitKey = `${guild.id}:${executorId}`;

  const hits = record(actionHits, hitKey, executorId, now, windowMs);

  // Abaixo do limite nao e nuke, mas fica registrado para auditoria.
  if (hits.length < threshold) {
    await recordAuditEvent({
      guildId: guild.id,
      module: "security",
      eventType: "destructive_action",
      actorId: executorId,
      targetId: entry.targetId,
      severity: "warning",
      data: { action: ACTION_LABELS[entry.action] ?? String(entry.action) }
    }).catch(() => undefined);
    return;
  }

  const incidentKey = `${guild.id}:nuke:${executorId}`;
  if (onCooldown(incidentKey)) return;
  lastIncident.set(incidentKey, now);

  const trustedRoleIds = asList(config.config.trustedRoleIds);
  const response = asString(config.config.response) || "alert";
  const timeoutMinutes = num(config.config.timeoutMinutes, 60);

  const incidentId = await openIncident({
    guildId: guild.id,
    type: "nuke",
    severity: "critical",
    actorId: executorId,
    details: {
      actions: hits.length,
      windowSeconds: windowMs / 1000,
      threshold,
      lastAction: ACTION_LABELS[entry.action] ?? String(entry.action),
      targetId: entry.targetId
    }
  });

  // Cargo confiavel nunca e punido — mas o alerta sai mesmo assim.
  const exempt = await isExempt(guild, executorId, trustedRoleIds);
  const contained = response !== "alert" && !exempt
    ? await applyTimeout(client, guild.id, executorId, timeoutMinutes)
    : false;
  const verificationRaised = response === "lockdown_review" ? await raiseVerification(client, guild.id) : false;

  actionHits.set(hitKey, []);

  await recordAuditEvent({
    guildId: guild.id,
    module: "security",
    eventType: "nuke_detected",
    actorId: executorId,
    targetId: entry.targetId,
    severity: "critical",
    data: { actions: hits.length, threshold, contained, exempt, verificationRaised, incidentId }
  });

  await alert(
    client,
    asString(config.config.alertChannelId),
    {
      title: "Ações destrutivas em sequência",
      description: `<@${executorId}> executou **${hits.length} ações destrutivas** em ${windowMs / 1000}s.`,
      accentColor: "#ff5c6c",
      fields: [
        { name: "Última ação", value: ACTION_LABELS[entry.action] ?? "desconhecida", inline: true },
        {
          name: "Quem executou",
          value: exempt ? "cargo confiável — nenhuma punição aplicada" : `<@${executorId}>`,
          inline: true
        },
        {
          name: "Contenção",
          value: contained ? `Timeout de ${timeoutMinutes} min` : "não aplicada",
          inline: true
        },
        {
          name: "O que fazer agora",
          value: "Confirme se a ação foi intencional. Se não foi, revise as permissões desse membro e o que foi apagado.",
          inline: false
        }
      ]
    },
    log
  );

  log.info("nuke detectado", { guildId: guild.id, executorId, actions: hits.length, contained, exempt });
}
