/**
 * Equipe — desempenho e carga de trabalho.
 *
 * A aba "Equipe" mostra tempo de resposta, carga por atendente e plantao. Tudo
 * isso sai dos tickets ja persistidos: o modulo nao guarda dado proprio, ele
 * LE o que `tickets.ts` gravou. Por isso e barato e sempre consistente.
 *
 * `responseTimeGoalMinutes` e `maxConcurrentTickets` existiam no painel sem
 * nenhum consumidor — e o que o `/stats` e o alerta de sobrecarga usam agora.
 */
import type { Guild } from "discord.js";
import { bool, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { resolveChannel, resolveRoles } from "./resolve.ts";
import { read } from "./store.ts";
import type { Ticket } from "./tickets.ts";
import { reportLines, ticketStaffReport } from "./tickets-metrics.ts";

export type StaffLoad = {
  staffId: string;
  claimed: number;
  open: number;
  closed: number;
  /** Media em minutos entre abrir e assumir, so dos que ele assumiu. */
  averageClaimMinutes: number | null;
  /** Media em minutos entre assumir e encerrar. */
  averageResolveMinutes: number | null;
};

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Carga por atendente, na janela configurada.
 * So considera tickets do servidor e dentro da janela — senao um atendente
 * antigo apareceria carregado para sempre.
 */
export async function loadPerStaff(guildId: string, windowDays = 30): Promise<StaffLoad[]> {
  const cutoff = Date.now() - windowDays * 86_400_000;
  const tickets = (await read<Ticket>("tickets")).filter((ticket) => {
    if (ticket.guildId !== guildId) return false;
    const at = Date.parse(ticket.createdAt);
    return !Number.isFinite(at) || at >= cutoff;
  });

  const byStaff = new Map<string, StaffLoad>();

  const ensure = (staffId: string): StaffLoad => {
    const existing = byStaff.get(staffId);
    if (existing) return existing;
    const created: StaffLoad = {
      staffId,
      claimed: 0,
      open: 0,
      closed: 0,
      averageClaimMinutes: null,
      averageResolveMinutes: null
    };
    byStaff.set(staffId, created);
    return created;
  };

  const claimTimes = new Map<string, number[]>();
  const resolveTimes = new Map<string, number[]>();

  for (const ticket of tickets) {
    if (ticket.claimedBy) {
      const staff = ensure(ticket.claimedBy);
      staff.claimed += 1;

      if (ticket.status === "closed") staff.closed += 1;
      else staff.open += 1;

      const opened = Date.parse(ticket.createdAt);
      const claimed = ticket.claimedAt ? Date.parse(ticket.claimedAt) : NaN;
      if (Number.isFinite(opened) && Number.isFinite(claimed) && claimed >= opened) {
        const list = claimTimes.get(ticket.claimedBy) ?? [];
        list.push((claimed - opened) / 60_000);
        claimTimes.set(ticket.claimedBy, list);
      }

      const closed = ticket.closedAt ? Date.parse(ticket.closedAt) : NaN;
      if (Number.isFinite(claimed) && Number.isFinite(closed) && closed >= claimed) {
        const list = resolveTimes.get(ticket.claimedBy) ?? [];
        list.push((closed - claimed) / 60_000);
        resolveTimes.set(ticket.claimedBy, list);
      }
    }
  }

  for (const staff of byStaff.values()) {
    staff.averageClaimMinutes = average(claimTimes.get(staff.staffId) ?? []);
    staff.averageResolveMinutes = average(resolveTimes.get(staff.staffId) ?? []);
  }

  return [...byStaff.values()].sort((a, b) => b.claimed - a.claimed);
}

/**
 * Alerta quando alguem passa do limite de atendimentos simultaneos.
 * `maxConcurrentTickets` era um numero decorativo no painel.
 */
export async function checkOverload(guild: Guild, log: Logger): Promise<number> {
  const config = await moduleConfig(guild.id, "staff");
  if (!isEnabled(config)) return 0;

  const maxConcurrent = Math.trunc(num(config, "maxConcurrentTickets", 0));
  if (maxConcurrent <= 0) return 0;

  const loads = await loadPerStaff(guild.id, Math.trunc(num(config, "performanceWindowDays", 30)));
  let warned = 0;

  for (const load of loads) {
    if (load.open <= maxConcurrent) continue;

    await auditAndLog(
      guild,
      {
        module: "staff",
        category: "members",
        eventType: "staff_overloaded",
        targetId: load.staffId,
        severity: "warning",
        title: "ATENDENTE SOBRECARREGADO",
        description: `<@${load.staffId}> esta com **${load.open}** atendimentos abertos (limite ${maxConcurrent}).`,
        accentColor: "#f5a524",
        fields: [
          { name: "Abertos", value: String(load.open) },
          { name: "Limite", value: String(maxConcurrent) },
          { name: "Assumidos na janela", value: String(load.claimed) }
        ]
      },
      log
    );

    warned += 1;
  }

  return warned;
}

/**
 * Carga atual do plantao, para o `/stats`.
 *
 * Le as metricas de ATENDIMENTO (1a resposta, resolucao, CSAT) de
 * `tickets-metrics` — que agrega os tickets persistidos pelo bot. O painel
 * mostra esses numeros do estado local; aqui sao os de verdade.
 */
export async function shiftSummary(guild: Guild): Promise<string> {
  const config = await moduleConfig(guild.id, "staff");
  if (!isEnabled(config)) return "O modulo de equipe esta desligado.";

  const windowDays = Math.trunc(num(config, "performanceWindowDays", 30));
  const goal = Math.trunc(num(config, "responseTimeGoalMinutes", 30));
  const reports = await ticketStaffReport(guild.id, windowDays);

  if (!reports.length) {
    return `Nenhum atendimento assumido nos ultimos **${windowDays}** dias.`;
  }

  return [`**Plantao · ultimos ${windowDays} dias**`, "", ...reportLines(reports, goal).slice(0, 8)].join("\n");
}

/** Avisa o canal de staff sobre quem esta inativo. */
export async function checkInactivity(guild: Guild, log: Logger): Promise<number> {
  const config = await moduleConfig(guild.id, "staff");
  if (!isEnabled(config)) return 0;

  const inactivityDays = Math.trunc(num(config, "inactivityDays", 0));
  if (inactivityDays <= 0) return 0;

  const staffRoles = resolveRoles(guild, list(config, "staffRoleIds"));
  if (!staffRoles.length) return 0;

  const staffRoleIds = new Set(staffRoles.map((role) => role.id));
  const loads = await loadPerStaff(guild.id, inactivityDays);
  const active = new Set(loads.filter((load) => load.claimed > 0).map((load) => load.staffId));

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return 0;

  const idle: string[] = [];
  for (const member of members.values()) {
    if (member.user.bot) continue;
    if (!member.roles.cache.some((role) => staffRoleIds.has(role.id))) continue;
    if (active.has(member.id)) continue;
    idle.push(member.id);
  }

  if (!idle.length) return 0;

  const channel = resolveChannel(guild, str(config, "logChannelId"));

  await auditAndLog(
    guild,
    {
      module: "staff",
      category: "members",
      eventType: "staff_inactive",
      severity: "info",
      title: "EQUIPE SEM ATENDIMENTOS",
      description: `${idle.length} membro(s) da equipe sem atendimento nos ultimos ${inactivityDays} dias.`,
      accentColor: "#7c5cff",
      fields: [{ name: "Membros", value: idle.map((id) => `<@${id}>`).join(", ").slice(0, 1000) }]
    },
    log
  );

  if (channel?.isTextBased() && idle.length) {
    await channel
      .send(`Sem atendimentos em ${inactivityDays} dias: ${idle.map((id) => `<@${id}>`).join(", ")}`)
      .catch(() => undefined);
  }

  return idle.length;
}

/** O staff precisa informar motivo ao punir? Vem do modulo de equipe. */
export async function reasonRequired(guildId: string): Promise<boolean> {
  const config = await moduleConfig(guildId, "staff");
  if (!isEnabled(config)) return false;
  return bool(config, "requireReason", true);
}
