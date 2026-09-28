import { Routes, type Client } from "discord.js";
import { getPool, resolveModuleConfig } from "../server/db/index.js";
import { buildLogPayload } from "./panels.js";

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

type StatsConfig = {
  retentionDays?: number;
  trackMessages?: boolean;
  trackVoice?: boolean;
  trackJoins?: boolean;
  trackTickets?: boolean;
  trackReactions?: boolean;
  trackCommands?: boolean;
  digestChannelId?: string;
  digestHourUtc?: number;
  highlightTopMembers?: number;
};

// Contadores em memória (flush periódico para o banco)
const messageCounts = new Map<string, number>(); // guildId:channelId -> count
const joinCounts = new Map<string, number>(); // guildId -> count
const commandCounts = new Map<string, number>(); // guildId -> count

/**
 * Incrementa contagem de mensagens por servidor.
 */
export function trackMessage(guildId: string): void {
  messageCounts.set(guildId, (messageCounts.get(guildId) ?? 0) + 1);
}

/**
 * Incrementa contagem de entradas por servidor.
 */
export function trackJoin(guildId: string): void {
  joinCounts.set(guildId, (joinCounts.get(guildId) ?? 0) + 1);
}

/**
 * Incrementa contagem de comandos por servidor.
 */
export function trackCommand(guildId: string): void {
  commandCounts.set(guildId, (commandCounts.get(guildId) ?? 0) + 1);
}

/**
 * Flush periódico: grava os contadores no banco e zera.
 * Chamado a cada hora pelo setInterval no client.ts.
 */
export async function flushStatistics(): Promise<number> {
  const entries = [...messageCounts.entries(), ...joinCounts.entries(), ...commandCounts.entries()];
  if (!entries.length) return 0;

  // Grava snapshot diário
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  for (const [guildId, count] of messageCounts) {
    await getPool().query(
      `insert into audit_events (guild_id, module, event_type, severity, data)
       values ($1, 'statistics', 'message_snapshot', 'info', $2::jsonb)`,
      [guildId, JSON.stringify({ date, count, type: "messages" })]
    ).catch(() => undefined);
  }

  for (const [guildId, count] of joinCounts) {
    await getPool().query(
      `insert into audit_events (guild_id, module, event_type, severity, data)
       values ($1, 'statistics', 'join_snapshot', 'info', $2::jsonb)`,
      [guildId, JSON.stringify({ date, count, type: "joins" })]
    ).catch(() => undefined);
  }

  const flushed = entries.length;
  messageCounts.clear();
  joinCounts.clear();
  commandCounts.clear();
  return flushed;
}

/**
 * Gera e envia o resumo diário para o canal configurado.
 * Chamado uma vez por dia pelo scheduler.
 */
export async function sendDailyDigest(client: Client, guildId: string, log: Logger): Promise<void> {
  const mod = await resolveModuleConfig(guildId, "statistics").catch(() => null);
  if (!mod?.enabled) return;
  const config = mod.config as StatsConfig;

  const digestChannelId = typeof config.digestChannelId === "string" ? config.digestChannelId : "";
  if (!digestChannelId) return;

  const highlightCount = config.highlightTopMembers ?? 5;

  // Conta eventos das últimas 24h
  const db = getPool();
  const [events, tickets] = await Promise.all([
    db.query<{ module: string; cnt: number }>(
      `select module, count(*)::integer as cnt from audit_events
       where guild_id = $1 and occurred_at > now() - interval '24 hours'
       group by module order by cnt desc`,
      [guildId]
    ),
    config.trackTickets !== false ? db.query<{ cnt: number }>(
      `select count(*)::integer as cnt from tickets where guild_id = $1 and created_at > now() - interval '24 hours'`,
      [guildId]
    ) : Promise.resolve({ rows: [{ cnt: 0 }] })
  ]);

  const eventLines = events.rows.map((r) => `**${r.module}**: ${r.cnt} evento(s)`).join("\n") || "Nenhum evento registrado.";
  const ticketCount = tickets.rows[0]?.cnt ?? 0;

  // Membros mais ativos (por ocorrências de moderação)
  const topMembers = await db.query<{ targetId: string; cnt: number }>(
    `select target_id as "targetId", count(*)::integer as cnt from moderation_occurrences
     where guild_id = $1 and created_at > now() - interval '24 hours'
     group by target_id order by cnt desc limit $2`,
    [guildId, highlightCount]
  ).catch(() => ({ rows: [] as Array<{ targetId: string; cnt: number }> }));

  const topLines = topMembers.rows.length
    ? topMembers.rows.map((r, i) => `${i + 1}. <@${r.targetId}> — ${r.cnt} ocorrência(s)`).join("\n")
    : "Nenhuma ocorrência.";

  await client.rest.post(Routes.channelMessages(digestChannelId), {
    body: buildLogPayload({
      title: "📊 Resumo diário",
      description: `Estatísticas das últimas 24 horas.`,
      accentColor: "#7c5cff",
      fields: [
        { name: "Eventos", value: eventLines.slice(0, 1024), inline: false },
        { name: "Atendimentos abertos", value: String(ticketCount), inline: true },
        { name: "Ocorrências de moderação", value: topLines.slice(0, 1024), inline: false }
      ]
    })
  }).catch((error) => log.error("falha ao enviar resumo diário", { guildId, error: String(error) }));

  log.info("resumo diário enviado", { guildId });
}
