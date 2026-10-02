/**
 * Estatisticas — atividade do servidor e digest periodico.
 *
 * O painel tem uma aba inteira de estatisticas (retencao, anonimizar, rastrear
 * mensagens/entradas/tickets, canal e hora do digest). O bot nao gravava um
 * unico contador: a aba mostrava so o que o proprio navegador inventava.
 *
 * Contagem por DIA, nao por evento: guardar cada mensagem seria um arquivo sem
 * fim. O que a aba precisa e serie temporal, e ela cabe em um registro por dia.
 */
import type { Guild } from "discord.js";
import { bool, isEnabled, moduleConfig, num, str } from "./config.ts";
import type { Logger } from "./logger.ts";
import { buildPanelPayload } from "./panels.ts";
import { resolveChannel } from "./resolve.ts";
import { mutate, read } from "./store.ts";
import { reportLines, ticketStaffReport } from "./tickets-metrics.ts";

export type DailyStat = {
  guildId: string;
  /** ISO `YYYY-MM-DD`. */
  day: string;
  messages: number;
  joins: number;
  leaves: number;
  tickets: number;
};

/** Chave de um dia, para agrupar sem depender de fuso do processo. */
function dayKey(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Incrementa um contador do dia.
 *
 * Nunca lanca: metrica e observacao, e uma falha aqui nao pode impedir a acao
 * que estava sendo medida (uma entrada, uma mensagem, um ticket).
 */
export async function bump(
  guildId: string,
  field: "messages" | "joins" | "leaves" | "tickets",
  amount = 1
): Promise<void> {
  try {
    const config = await moduleConfig(guildId, "statistics");
    if (!isEnabled(config)) return;

    const flag = {
      messages: "trackMessages",
      joins: "trackJoins",
      leaves: "trackJoins",
      tickets: "trackTickets"
    }[field];

    if (!bool(config, flag, true)) return;

    const day = dayKey();

    await mutate<DailyStat>("statistics", (rows) => {
      const row = rows.find((entry) => entry.guildId === guildId && entry.day === day);
      if (row) {
        row[field] += amount;
      } else {
        rows.push({ guildId, day, messages: 0, joins: 0, leaves: 0, tickets: 0, [field]: amount });
      }
      return rows;
    });
  } catch {
    // Metrica perdida nao e incidente.
  }
}

export async function statsFor(guildId: string, days = 30): Promise<DailyStat[]> {
  const cutoff = dayKey(new Date(Date.now() - days * 86_400_000));
  const rows = await read<DailyStat>("statistics");

  return rows
    .filter((row) => row.guildId === guildId && row.day >= cutoff)
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Resumo dos ultimos N dias, para o digest e para o `/stats`. */
export async function summarize(guildId: string, days = 7): Promise<{
  messages: number;
  joins: number;
  leaves: number;
  tickets: number;
  net: number;
}> {
  const rows = await statsFor(guildId, days);

  const total = rows.reduce(
    (acc, row) => ({
      messages: acc.messages + row.messages,
      joins: acc.joins + row.joins,
      leaves: acc.leaves + row.leaves,
      tickets: acc.tickets + row.tickets
    }),
    { messages: 0, joins: 0, leaves: 0, tickets: 0 }
  );

  return { ...total, net: total.joins - total.leaves };
}

/**
 * Publica o digest no canal configurado, se for a hora e ainda nao saiu hoje.
 * `digestHourUtc` vem da config; a marca de "ja enviado" fica em `counters`.
 */
export async function maybeSendDigest(guild: Guild, log: Logger): Promise<boolean> {
  const config = await moduleConfig(guild.id, "statistics");
  if (!isEnabled(config)) return false;

  const channel = resolveChannel(guild, str(config, "digestChannelId"));
  if (!channel || !channel.isTextBased()) return false;

  const targetHour = Math.trunc(num(config, "digestHourUtc", 12));
  const now = new Date();
  if (now.getUTCHours() !== targetHour) return false;

  const day = dayKey(now);
  let shouldSend = false;

  await mutate<{ key: string; value: number }>("counters", (rows) => {
    const key = `digest:${guild.id}:${day}`;
    if (rows.some((row) => row.key === key)) return rows;
    rows.push({ key, value: 1 });
    shouldSend = true;
    return rows;
  });

  if (!shouldSend) return false;

  const summary = await summarize(guild.id, 7);
  const top = (await read<DailyStat>("statistics"))
    .filter((row) => row.guildId === guild.id)
    .sort((a, b) => b.messages - a.messages)[0];

  // Desempenho por atendente: a aba "Equipe" do painel mostra os numeros do
  // estado local; o digest mostra os DE VERDADE, lidos dos tickets do bot.
  const staffConfig = await moduleConfig(guild.id, "staff");
  const staffGoal = Math.trunc(num(staffConfig, "responseTimeGoalMinutes", 30));
  const staffWindow = Math.trunc(num(staffConfig, "performanceWindowDays", 30));
  const staffLines = reportLines(await ticketStaffReport(guild.id, staffWindow), staffGoal).slice(0, 5);

  const highlight = Math.max(1, Math.trunc(num(config, "highlightTopMembers", 5)));

  const panel = buildPanelPayload({
    title: "Resumo da semana",
    description: [
      `Mensagens: **${summary.messages}**`,
      `Entradas: **${summary.joins}** · Saidas: **${summary.leaves}** (saldo ${summary.net >= 0 ? "+" : ""}${summary.net})`,
      `Atendimentos abertos: **${summary.tickets}**`,
      ...(staffLines.length ? ["", `**Equipe · janela de ${staffWindow} dias**`, ...staffLines] : [])
    ].join("\n"),
    accentColor: "#7c5cff",
    footer: [
      `Janela: 7 dias`,
      top ? `Dia mais movimentado: ${top.day} (${top.messages} msgs)` : "",
      `Destaques: top ${highlight}`
    ].filter(Boolean).join(" · ")
  });

  try {
    await channel.send(panel as never);
    log.info("digest publicado", { guildId: guild.id, day });
    return true;
  } catch (error) {
    log.warn("falha ao publicar digest", { guildId: guild.id, error: String(error) });
    return false;
  }
}

/**
 * Descarta estatisticas mais antigas que a retencao configurada.
 * Sem isso o arquivo cresce indefinidamente, um dia por servidor.
 */
export async function pruneStatistics(guildId: string, log: Logger): Promise<number> {
  const config = await moduleConfig(guildId, "statistics");
  const retentionDays = Math.max(7, Math.trunc(num(config, "retentionDays", 180)));
  const cutoff = dayKey(new Date(Date.now() - retentionDays * 86_400_000));

  let removed = 0;

  await mutate<DailyStat>("statistics", (rows) => {
    const kept = rows.filter((row) => !(row.guildId === guildId && row.day < cutoff));
    removed = rows.length - kept.length;
    return kept;
  });

  if (removed) log.info("estatisticas podadas", { guildId, removed, retentionDays });
  return removed;
}
