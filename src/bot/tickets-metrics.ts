/**
 * Metricas de atendimento por atendente (item D do plano).
 *
 * A aba "Equipe" do painel mostra carga, 1a resposta e CSAT — mas so do ESTADO
 * LOCAL da dashboard, que nao sabe nada do que acontece no Discord. O `/stats`
 * e o digest semanal precisam dos numeros de verdade, que so existem nos
 * tickets persistidos pelo bot.
 *
 * A agregacao e pura (testavel); a leitura do store mora no wrapper.
 */
import { read } from "./store.ts";

/**
 * Recorte do ticket que a agregacao le.
 *
 * Estrutural, de proposito: o Ticket do bot e o da dashboard tem formas
 * diferentes (id number vs string, createdAt ISO vs epoch) e os dois tem de
 * entrar aqui sem conversao.
 */
export type StaffTicketInput = {
  id: number | string;
  guildId: string;
  number?: number;
  openerId?: string;
  claimedBy: string | null;
  department?: string | null;
  status: string;
  createdAt: string;
  claimedAt?: string | null;
  closedAt?: string | null;
  firstResponseAt?: string | null;
  feedback?: { rating: number; comment: string | null } | null;
};

export type StaffTicketReport = {
  staffId: string;
  /** Tickets assumidos na janela. */
  claimed: number;
  /** Ainda abertos (open ou claimed). */
  open: number;
  /** Encerrados na janela. */
  closed: number;
  /** Media em minutos entre abrir e a primeira resposta. */
  averageFirstResponseMinutes: number | null;
  /** Media em minutos entre assumir e encerrar. */
  averageResolveMinutes: number | null;
  /** CSAT medio (1-5) dos tickets com feedback. */
  csat: number | null;
};

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

/**
 * Agrega por atendente dentro da janela. Ticket sem atendente nao entra em
 * linha nenhuma — quem o enxerga e o contador de abertos do `/stats`.
 */
export function aggregateStaffReport(
  tickets: StaffTicketInput[],
  windowDays = 30,
  now = Date.now()
): StaffTicketReport[] {
  const cutoff = now - windowDays * 86_400_000;
  const byStaff = new Map<string, StaffTicketReport>();
  const firstResponses = new Map<string, number[]>();
  const resolveTimes = new Map<string, number[]>();
  const ratings = new Map<string, number[]>();

  for (const ticket of tickets) {
    const opened = Date.parse(ticket.createdAt);
    const inWindow = !Number.isFinite(opened) || opened >= cutoff;
    if (!inWindow || !ticket.claimedBy) continue;

    const staffId = ticket.claimedBy;
    const row =
      byStaff.get(staffId) ??
      {
        staffId,
        claimed: 0,
        open: 0,
        closed: 0,
        averageFirstResponseMinutes: null,
        averageResolveMinutes: null,
        csat: null
      };
    row.claimed += 1;
    if (ticket.status === "closed") row.closed += 1;
    else row.open += 1;
    byStaff.set(staffId, row);

    const firstResponse = ticket.firstResponseAt ? Date.parse(ticket.firstResponseAt) : NaN;
    if (Number.isFinite(opened) && Number.isFinite(firstResponse) && firstResponse >= opened) {
      const list = firstResponses.get(staffId) ?? [];
      list.push((firstResponse - opened) / 60_000);
      firstResponses.set(staffId, list);
    }

    const claimed = ticket.claimedAt ? Date.parse(ticket.claimedAt) : NaN;
    const closed = ticket.closedAt ? Date.parse(ticket.closedAt) : NaN;
    if (Number.isFinite(claimed) && Number.isFinite(closed) && closed >= claimed) {
      const list = resolveTimes.get(staffId) ?? [];
      list.push((closed - claimed) / 60_000);
      resolveTimes.set(staffId, list);
    }

    if (ticket.feedback) {
      const list = ratings.get(staffId) ?? [];
      list.push(ticket.feedback.rating);
      ratings.set(staffId, list);
    }
  }

  for (const row of byStaff.values()) {
    row.averageFirstResponseMinutes = average(firstResponses.get(row.staffId) ?? []);
    row.averageResolveMinutes = average(resolveTimes.get(row.staffId) ?? []);
    const rates = ratings.get(row.staffId) ?? [];
    row.csat = rates.length ? average(rates) : null;
  }

  return [...byStaff.values()].sort((a, b) => b.claimed - a.claimed);
}

export async function ticketStaffReport(guildId: string, windowDays = 30): Promise<StaffTicketReport[]> {
  const tickets = (await read<StaffTicketInput>("tickets")).filter((row) => row.guildId === guildId);
  return aggregateStaffReport(tickets, windowDays);
}

/** Linhas prontas para o /stats, o plantao e o digest semanal. */
export function reportLines(reports: StaffTicketReport[], goalMinutes = 30): string[] {
  return reports.map((row) => {
    const first = row.averageFirstResponseMinutes;
    const mark = first === null ? "" : first <= goalMinutes ? " ✅" : " ⚠️";
    return [
      `**<@${row.staffId}>**${mark} · assumidos: ${row.claimed} · abertos: ${row.open} · encerrados: ${row.closed}`,
      first === null ? "" : `· 1a resposta: ${first} min (meta ${goalMinutes})`,
      row.averageResolveMinutes === null ? "" : `· resolucao: ${row.averageResolveMinutes} min`,
      row.csat === null ? "" : `· CSAT: ${row.csat}`
    ]
      .filter(Boolean)
      .join(" ");
  });
}
