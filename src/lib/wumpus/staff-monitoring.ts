import { slaState } from "../../bot/tickets-sla.ts";

export type StaffMonitoringTicket = {
  id: number;
  guildId: string;
  channelId?: string;
  subject?: string;
  department?: string | null;
  priority?: string;
  status: string;
  claimedBy: string | null;
  claimedAt?: string | null;
  createdAt: string;
  closedAt: string | null;
  closedBy?: string | null;
  closeReason?: string | null;
  firstResponseAt: string | null;
  firstRespondedBy?: string | null;
  lastActivityAt?: string | null;
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
  moderationAttempts: number;
  transfersMade: number;
  transfersReceived: number;
  escalations: number;
  reopenActions: number;
  ticketMessages: number;
  lastActivityAt: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  openTicketDetails: StaffOpenTicket[];
  activity: StaffActivityEntry[];
};

export type StaffOpenTicket = {
  id: number;
  subject: string;
  department: string;
  priority: string;
  createdAt: number;
  lastActivityAt: number | null;
  ageHours: number;
  sla: "ok" | "warning" | "breach";
  channelId?: string;
};

export type StaffActivityEntry = {
  id: string;
  at: number;
  kind:
    "ticket" | "response" | "rating" | "form" | "moderation" | "transfer" | "escalation" | "reopen";
  title: string;
  detail: string;
  ticketId?: number;
  rating?: number;
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
  id?: number;
  module: string;
  eventType?: string;
  actorId?: string;
  targetId?: string;
  channelId?: string;
  data?: Record<string, unknown>;
  at: string;
};

type StaffMonitoringModeration = {
  staffId: string;
  targetId: string;
  requestedAction: string;
  appliedAction: string | null;
  status: string;
  createdAt: string;
  appliedAt: string | null;
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
  moderation?: StaffMonitoringModeration[];
  periodDays: 7 | 30 | 90;
  responseGoalMinutes: number;
  slaWarningMinutes: number;
  now?: number;
}): StaffMonitoringResult["staff"] {
  const now = input.now ?? Date.now();
  const cutoff = now - input.periodDays * 86_400_000;
  const ticketIds = new Set(input.tickets.map((ticket) => ticket.id));
  const ticketById = new Map(input.tickets.map((ticket) => [ticket.id, ticket]));
  const responseTimes = new Map<string, number[]>();
  const resolutionTimes = new Map<string, number[]>();
  const goalResponses = new Map<string, { met: number; total: number }>();
  const ratings = new Map<string, number[]>();
  const lastActivity = new Map<string, number>();
  const activities = new Map<string, StaffActivityEntry[]>();
  const openTicketDetails = new Map<string, StaffOpenTicket[]>();
  const addActivity = (staffId: string, item: StaffActivityEntry, countsAsWork = true) => {
    if (!rows.has(staffId) || item.at < cutoff || item.at > now) return;
    const current = activities.get(staffId) ?? [];
    current.push(item);
    activities.set(staffId, current);
    if (countsAsWork) activity(staffId, item.at);
  };
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
        moderationAttempts: 0,
        transfersMade: 0,
        transfersReceived: 0,
        escalations: 0,
        reopenActions: 0,
        ticketMessages: 0,
        lastActivityAt: null,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        openTicketDetails: [],
        activity: [],
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

    const isOpen = ticket.status === "open" || ticket.status === "claimed";
    if (isOpen && ticket.claimedBy && rows.has(ticket.claimedBy)) {
      const row = rows.get(ticket.claimedBy)!;
      row.openTickets += 1;
      const sla = slaState(ticket, input.slaWarningMinutes, now);
      if (sla !== "ok") row.overdueTickets += 1;
      const opened = openedAt ?? now;
      const latestActivity = timestamp(ticket.lastActivityAt);
      const ticketDetails = openTicketDetails.get(ticket.claimedBy) ?? [];
      ticketDetails.push({
        id: ticket.id,
        subject: ticket.subject?.trim().slice(0, 100) || `Atendimento #${ticket.id}`,
        department: ticket.department?.slice(0, 60) || "Geral",
        priority: ticket.priority || "normal",
        createdAt: opened,
        lastActivityAt: latestActivity,
        ageHours: Math.max(0, Math.floor((now - opened) / 3_600_000)),
        sla,
        ...(ticket.channelId ? { channelId: ticket.channelId } : {}),
      });
      openTicketDetails.set(ticket.claimedBy, ticketDetails);
    }

    if (ticket.claimedBy && rows.has(ticket.claimedBy) && isInWindow(claimedAt)) {
      rows.get(ticket.claimedBy)!.claimedTickets += 1;
      addActivity(ticket.claimedBy, {
        id: `claim-${ticket.id}`,
        at: claimedAt!,
        kind: "ticket",
        title: `Assumiu atendimento #${ticket.id}`,
        detail: ticket.subject?.slice(0, 100) || ticket.department || "Atendimento",
        ticketId: ticket.id,
      });
    }

    if (ticket.closedBy && rows.has(ticket.closedBy) && isInWindow(closedAt)) {
      rows.get(ticket.closedBy)!.closedTickets += 1;
      addActivity(ticket.closedBy, {
        id: `close-${ticket.id}`,
        at: closedAt!,
        kind: "ticket",
        title: `Encerrou atendimento #${ticket.id}`,
        detail:
          ticket.closeReason?.slice(0, 120) ||
          ticket.subject?.slice(0, 100) ||
          "Atendimento encerrado",
        ticketId: ticket.id,
      });
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
      addActivity(responderId, {
        id: `first-response-${ticket.id}`,
        at: responseAt!,
        kind: "response",
        title: `Primeira resposta no atendimento #${ticket.id}`,
        detail: `${Math.round(elapsedMinutes)} min após a abertura`,
        ticketId: ticket.id,
      });
    }

    const ratingStaffId = ticket.feedbackStaffId;
    if (ticket.feedback && ratingStaffId && rows.has(ratingStaffId) && isInWindow(feedbackAt)) {
      if (ticket.feedback.rating >= 1 && ticket.feedback.rating <= 5) {
        const values = ratings.get(ratingStaffId) ?? [];
        values.push(ticket.feedback.rating);
        ratings.set(ratingStaffId, values);
        rows.get(ratingStaffId)!.ratingDistribution[ticket.feedback.rating as 1 | 2 | 3 | 4 | 5] +=
          1;
      }
      addActivity(
        ratingStaffId,
        {
          id: `rating-${ticket.id}`,
          at: feedbackAt!,
          kind: "rating",
          title: `Recebeu avaliação no atendimento #${ticket.id}`,
          detail: `${ticket.feedback.rating} de 5 estrelas`,
          ticketId: ticket.id,
          rating: ticket.feedback.rating,
        },
        false,
      );
    }
  }

  for (const message of input.messages) {
    if (!ticketIds.has(message.ticketId)) continue;
    const row = rows.get(message.authorId);
    const at = timestamp(message.at);
    if (!row || at === null || !isInWindow(at)) continue;
    row.ticketMessages += 1;
    activity(message.authorId, at);
    const ticket = ticketById.get(message.ticketId);
    if (message.authorId === ticket?.firstRespondedBy && timestamp(ticket.firstResponseAt) === at) {
      continue;
    }
    addActivity(message.authorId, {
      id: `message-${message.ticketId}-${at}-${row.ticketMessages}`,
      at: at!,
      kind: "response",
      title: `Respondeu no atendimento #${message.ticketId}`,
      detail: ticket?.subject?.slice(0, 100) || ticket?.department || "Mensagem registrada",
      ticketId: message.ticketId,
    });
  }

  for (const form of input.forms) {
    if (!form.reviewedBy || !rows.has(form.reviewedBy)) continue;
    const reviewedAt = timestamp(form.reviewedAt);
    if (!isInWindow(reviewedAt)) continue;
    const row = rows.get(form.reviewedBy)!;
    row.reviewedForms += 1;
    if (form.status === "approved") row.approvedForms += 1;
    if (form.status === "rejected") row.rejectedForms += 1;
    addActivity(form.reviewedBy, {
      id: `form-${form.reviewedBy}-${reviewedAt}`,
      at: reviewedAt!,
      kind: "form",
      title: `Revisou um formulário · ${form.status === "approved" ? "aprovado" : form.status === "rejected" ? "recusado" : "revisado"}`,
      detail: "Decisão registrada na dashboard",
    });
  }

  for (const event of input.audit) {
    if (!event.actorId || !rows.has(event.actorId)) continue;
    const at = timestamp(event.at);
    if (at === null || !isInWindow(at)) continue;
    const row = rows.get(event.actorId)!;
    const ticketIdFromData = Number(event.data?.ticketId);
    const ticket = input.tickets.find(
      (candidate) =>
        (Number.isInteger(ticketIdFromData) && candidate.id === ticketIdFromData) ||
        (event.channelId && candidate.channelId === event.channelId),
    );
    if (event.module === "tickets") {
      if (event.eventType === "ticket_transferred") {
        row.transfersMade += 1;
        addActivity(event.actorId, {
          id: `transfer-${event.id ?? at}-${event.actorId}`,
          at,
          kind: "transfer",
          title: `Transferiu atendimento${ticket ? ` #${ticket.id}` : ""}`,
          detail: event.targetId
            ? `Novo responsável: ${event.targetId}`
            : "Transferência registrada",
          ...(ticket ? { ticketId: ticket.id } : {}),
        });
        if (event.targetId && rows.has(event.targetId)) {
          rows.get(event.targetId)!.transfersReceived += 1;
          addActivity(
            event.targetId,
            {
              id: `transfer-received-${event.id ?? at}-${event.targetId}`,
              at,
              kind: "transfer",
              title: `Recebeu atendimento${ticket ? ` #${ticket.id}` : ""}`,
              detail: `Transferido por ${event.actorId}`,
              ...(ticket ? { ticketId: ticket.id } : {}),
            },
            false,
          );
        }
      } else if (event.eventType === "ticket_reopened") {
        row.reopenActions += 1;
        addActivity(event.actorId, {
          id: `reopen-${event.id ?? at}`,
          at,
          kind: "reopen",
          title: `Reabriu atendimento${ticket ? ` #${ticket.id}` : ""}`,
          detail: "Reabertura registrada",
          ...(ticket ? { ticketId: ticket.id } : {}),
        });
      } else if (
        event.eventType === "ticket_priority_changed" &&
        event.data?.priority === "urgent"
      ) {
        row.escalations += 1;
        addActivity(event.actorId, {
          id: `escalation-${event.id ?? at}`,
          at,
          kind: "escalation",
          title: `Escalou atendimento${ticket ? ` #${ticket.id}` : ""}`,
          detail: "Prioridade urgente",
          ...(ticket ? { ticketId: ticket.id } : {}),
        });
      }
    }
  }

  for (const occurrence of input.moderation ?? []) {
    if (!rows.has(occurrence.staffId)) continue;
    const at = timestamp(occurrence.appliedAt) ?? timestamp(occurrence.createdAt);
    if (at === null || !isInWindow(at)) continue;
    const row = rows.get(occurrence.staffId)!;
    row.moderationAttempts += 1;
    if (occurrence.status === "applied" || occurrence.status === "pardoned")
      row.moderationActions += 1;
    addActivity(occurrence.staffId, {
      id: `moderation-${occurrence.staffId}-${occurrence.createdAt}`,
      at: at!,
      kind: "moderation",
      title: `${occurrence.status === "applied" || occurrence.status === "pardoned" ? "Aplicou" : "Tentou aplicar"} ${occurrence.appliedAction ?? occurrence.requestedAction}`,
      detail: `Membro: ${occurrence.targetId}`,
    });
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
        openTicketDetails: (openTicketDetails.get(row.id) ?? []).sort(
          (a, b) => b.ageHours - a.ageHours,
        ),
        activity: (activities.get(row.id) ?? []).sort((a, b) => b.at - a.at).slice(0, 40),
      };
    })
    .sort(
      (a, b) =>
        b.openTickets - a.openTickets ||
        b.claimedTickets - a.claimedTickets ||
        a.displayName.localeCompare(b.displayName),
    );
}
