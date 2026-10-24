import { slaState } from "../../bot/tickets-sla.ts";

export type StaffMonitoringTicket = {
  id: number;
  guildId: string;
  status: string;
  claimedBy: string | null;
  claimedAt?: string | null;
  createdAt: string;
  closedAt: string | null;
  closedBy?: string | null;
  firstResponseAt: string | null;
  firstRespondedBy?: string | null;
  feedback?: { rating: number; comment?: string | null } | null;
  feedbackAt?: string | null;
  feedbackStaffId?: string | null;
};

export type StaffMonitoringMember = {
  id: string;
  username: string;
  displayName: string;
  roleIds: string[];
};

export type StaffMonitoringRow = StaffMonitoringMember & {
  openTickets: number;
  overdueTickets: number;
  claimedTickets: number;
  closedTickets: number;
  averageResolutionMinutes: number | null;
  resolutionCount: number;
  firstResponseCount: number;
  averageFirstResponseMinutes: number | null;
  responseGoalRate: number | null;
  ratingCount: number;
  averageRating: number | null;
  reviewedForms: number;
  approvedForms: number;
  rejectedForms: number;
  moderationActions: number;
  ticketMessages: number;
  lastActivityAt: number | null;
};

export type StaffMonitoringResult = {
  rosterStatus: "ready" | "refreshing" | "error" | "unconfigured";
  rosterUpdatedAt: number | null;
  rosterDetail: string | null;
  periodDays: 7 | 30 | 90;
  staff: StaffMonitoringRow[];
  summary: {
    staffCount: number;
    openTickets: number;
    overdueTickets: number;
    unassignedTickets: number;
  };
};

type StaffMonitoringForm = {
  reviewedBy: string | null;
  reviewedAt: string | null;
  status: string;
};

type StaffMonitoringMessage = {
  ticketId: number;
  authorId: string;
  at: string;
};

type StaffMonitoringAudit = {
  module: string;
  actorId?: string;
  at: string;
};

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function aggregateStaffMonitoring(input: {
  members: StaffMonitoringMember[];
  tickets: StaffMonitoringTicket[];
  messages: StaffMonitoringMessage[];
  forms: StaffMonitoringForm[];
  audit: StaffMonitoringAudit[];
  periodDays: 7 | 30 | 90;
  responseGoalMinutes: number;
  slaWarningMinutes: number;
  now?: number;
}): StaffMonitoringResult["staff"] {
  const now = input.now ?? Date.now();
  const cutoff = now - input.periodDays * 86_400_000;
  const ticketIds = new Set(input.tickets.map((ticket) => ticket.id));
  const responseTimes = new Map<string, number[]>();
  const resolutionTimes = new Map<string, number[]>();
  const goalResponses = new Map<string, { met: number; total: number }>();
  const ratings = new Map<string, number[]>();
  const lastActivity = new Map<string, number>();
  const activity = (staffId: string, at: number | null) => {
    if (at === null || at < cutoff) return;
    lastActivity.set(staffId, Math.max(lastActivity.get(staffId) ?? 0, at));
  };
  const rows = new Map(
    input.members.map((member) => [
      member.id,
      {
        ...member,
        openTickets: 0,
        overdueTickets: 0,
        claimedTickets: 0,
        closedTickets: 0,
        averageResolutionMinutes: null,
        resolutionCount: 0,
        firstResponseCount: 0,
        averageFirstResponseMinutes: null,
        responseGoalRate: null,
        ratingCount: 0,
        averageRating: null,
        reviewedForms: 0,
        approvedForms: 0,
        rejectedForms: 0,
        moderationActions: 0,
        ticketMessages: 0,
        lastActivityAt: null,
      } satisfies StaffMonitoringRow,
    ]),
  );
  const isInWindow = (at: number | null) => at !== null && at >= cutoff && at <= now;

  for (const ticket of input.tickets) {
    const openedAt = timestamp(ticket.createdAt);
    const claimedAt = timestamp(ticket.claimedAt);
    const closedAt = timestamp(ticket.closedAt);
    const responseAt = timestamp(ticket.firstResponseAt);
    const feedbackAt = timestamp(ticket.feedbackAt);

    if (ticket.status !== "closed" && ticket.claimedBy && rows.has(ticket.claimedBy)) {
      const row = rows.get(ticket.claimedBy)!;
      row.openTickets += 1;
      if (slaState(ticket, input.slaWarningMinutes, now) === "breach") row.overdueTickets += 1;
    }

    if (ticket.claimedBy && rows.has(ticket.claimedBy) && isInWindow(claimedAt)) {
      rows.get(ticket.claimedBy)!.claimedTickets += 1;
      activity(ticket.claimedBy, claimedAt);
    }

    if (ticket.closedBy && rows.has(ticket.closedBy) && isInWindow(closedAt)) {
      rows.get(ticket.closedBy)!.closedTickets += 1;
      activity(ticket.closedBy, closedAt);
    }

    if (
      ticket.claimedBy &&
      rows.has(ticket.claimedBy) &&
      isInWindow(closedAt) &&
      claimedAt !== null &&
      closedAt! >= claimedAt
    ) {
      const values = resolutionTimes.get(ticket.claimedBy) ?? [];
      values.push((closedAt! - claimedAt) / 60_000);
      resolutionTimes.set(ticket.claimedBy, values);
    }

    const responderId = ticket.firstRespondedBy;
    if (
      responderId &&
      rows.has(responderId) &&
      isInWindow(responseAt) &&
      openedAt !== null &&
      responseAt! >= openedAt
    ) {
      const elapsedMinutes = (responseAt! - openedAt) / 60_000;
      rows.get(responderId)!.firstResponseCount += 1;
      const times = responseTimes.get(responderId) ?? [];
      times.push(elapsedMinutes);
      responseTimes.set(responderId, times);
      const goal = goalResponses.get(responderId) ?? { met: 0, total: 0 };
      goal.total += 1;
      if (elapsedMinutes <= input.responseGoalMinutes) goal.met += 1;
      goalResponses.set(responderId, goal);
      activity(responderId, responseAt);
    }

    const ratingStaffId = ticket.feedbackStaffId;
    if (ticket.feedback && ratingStaffId && rows.has(ratingStaffId) && isInWindow(feedbackAt)) {
      const values = ratings.get(ratingStaffId) ?? [];
      values.push(ticket.feedback.rating);
      ratings.set(ratingStaffId, values);
      activity(ratingStaffId, feedbackAt);
    }
  }

  for (const message of input.messages) {
    if (!ticketIds.has(message.ticketId)) continue;
    const row = rows.get(message.authorId);
    const at = timestamp(message.at);
    if (!row || !isInWindow(at)) continue;
    row.ticketMessages += 1;
    activity(message.authorId, at);
  }

  for (const form of input.forms) {
    if (!form.reviewedBy || !rows.has(form.reviewedBy)) continue;
    const reviewedAt = timestamp(form.reviewedAt);
    if (!isInWindow(reviewedAt)) continue;
    const row = rows.get(form.reviewedBy)!;
    row.reviewedForms += 1;
    if (form.status === "approved") row.approvedForms += 1;
    if (form.status === "rejected") row.rejectedForms += 1;
    activity(form.reviewedBy, reviewedAt);
  }

  for (const event of input.audit) {
    if (
      !event.actorId ||
      !rows.has(event.actorId) ||
      !["moderation", "security"].includes(event.module)
    )
      continue;
    const at = timestamp(event.at);
    if (!isInWindow(at)) continue;
    rows.get(event.actorId)!.moderationActions += 1;
    activity(event.actorId, at);
  }

  return [...rows.values()]
    .map((row) => {
      const times = responseTimes.get(row.id) ?? [];
      const resolutions = resolutionTimes.get(row.id) ?? [];
      const goal = goalResponses.get(row.id);
      const memberRatings = ratings.get(row.id) ?? [];
      return {
        ...row,
        averageFirstResponseMinutes: average(times),
        averageResolutionMinutes: average(resolutions),
        resolutionCount: resolutions.length,
        responseGoalRate: goal?.total ? Math.round((goal.met / goal.total) * 100) : null,
        ratingCount: memberRatings.length,
        averageRating: average(memberRatings),
        lastActivityAt: lastActivity.get(row.id) ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.openTickets - a.openTickets ||
        b.claimedTickets - a.claimedTickets ||
        a.displayName.localeCompare(b.displayName),
    );
}
