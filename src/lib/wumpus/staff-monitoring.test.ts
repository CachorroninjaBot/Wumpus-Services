import assert from "node:assert/strict";
import test from "node:test";
import { aggregateStaffMonitoring } from "./staff-monitoring.ts";

const now = Date.parse("2026-04-30T12:00:00.000Z");
const recent = "2026-04-25T12:00:00.000Z";
const older = "2026-03-01T12:00:00.000Z";
const staffMembers = [
  { id: "staff-1", username: "ana", displayName: "Ana", roleIds: ["role-staff"] },
  { id: "staff-2", username: "bia", displayName: "Bia", roleIds: ["role-staff"] },
];

test("keeps all role members, including those without recorded activity", () => {
  const rows = aggregateStaffMonitoring({
    members: staffMembers,
    tickets: [{
      id: 10,
      guildId: "guild",
      status: "open",
      claimedBy: "staff-1",
      createdAt: recent,
      closedAt: null,
      firstResponseAt: null,
    }],
    messages: [],
    forms: [],
    audit: [],
    periodDays: 30,
    responseGoalMinutes: 30,
    slaWarningMinutes: 60,
    now,
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.displayName, "Bia");
  assert.equal(rows[1]?.lastActivityAt, null);
  assert.equal(rows[1]?.averageFirstResponseMinutes, null);
  assert.equal(rows[1]?.averageRating, null);
});

test("attributes ticket metrics to recorded responders, closers, raters, and reviewers", () => {
  const rows = aggregateStaffMonitoring({
    members: staffMembers,
    tickets: [
      {
        id: 10,
        guildId: "guild",
        status: "closed",
        claimedBy: "staff-1",
        claimedAt: "2026-04-25T11:35:00.000Z",
        createdAt: "2026-04-25T11:30:00.000Z",
        closedAt: recent,
        closedBy: "staff-2",
        firstResponseAt: "2026-04-25T11:40:00.000Z",
        firstRespondedBy: "staff-2",
        feedback: { rating: 5 },
        feedbackAt: recent,
        feedbackStaffId: "staff-1",
      },
    ],
    messages: [{ ticketId: 10, authorId: "staff-2", at: recent }],
    forms: [{ reviewedBy: "staff-2", reviewedAt: recent, status: "approved" }],
    audit: [{ module: "moderation", actorId: "staff-2", at: recent }],
    moderation: [
      {
        staffId: "staff-2",
        targetId: "member-2",
        requestedAction: "warn",
        appliedAction: "warn",
        status: "applied",
        createdAt: recent,
        appliedAt: recent,
      },
    ],
    periodDays: 30,
    responseGoalMinutes: 30,
    slaWarningMinutes: 60,
    now,
  });
  const ana = rows.find((row) => row.id === "staff-1");
  const bia = rows.find((row) => row.id === "staff-2");

  assert.equal(ana?.claimedTickets, 1);
  assert.equal(ana?.averageResolutionMinutes, 25);
  assert.equal(ana?.resolutionCount, 1);
  assert.equal(ana?.averageRating, 5);
  assert.equal(ana?.ratingCount, 1);
  assert.equal(bia?.closedTickets, 1);
  assert.equal(bia?.averageFirstResponseMinutes, 10);
  assert.equal(bia?.responseGoalRate, 100);
  assert.equal(bia?.reviewedForms, 1);
  assert.equal(bia?.approvedForms, 1);
  assert.equal(bia?.moderationActions, 1);
  assert.equal(bia?.ticketMessages, 1);
});

test("does not count internal ticket notes as staff responses", () => {
  const rows = aggregateStaffMonitoring({
    members: staffMembers,
    tickets: [{
      id: 10,
      guildId: "guild",
      status: "open",
      claimedBy: "staff-1",
      createdAt: recent,
      closedAt: null,
      firstResponseAt: null,
    }],
    messages: [
      { ticketId: 10, authorId: "staff-1", at: recent, internal: true },
      { ticketId: 10, authorId: "staff-1", at: recent },
    ],
    forms: [],
    audit: [],
    periodDays: 30,
    responseGoalMinutes: 30,
    slaWarningMinutes: 60,
    now,
  });

  assert.equal(rows.find((row) => row.id === "staff-1")?.ticketMessages, 1);
});

test("excludes activity outside the selected period and does not guess legacy attribution", () => {
  const rows = aggregateStaffMonitoring({
    members: staffMembers,
    tickets: [
      {
        id: 11,
        guildId: "guild",
        status: "closed",
        claimedBy: "staff-1",
        claimedAt: older,
        createdAt: older,
        closedAt: older,
        closedBy: "staff-1",
        firstResponseAt: older,
        feedback: { rating: 4 },
      },
    ],
    messages: [{ ticketId: 11, authorId: "staff-1", at: older }],
    forms: [{ reviewedBy: "staff-1", reviewedAt: older, status: "rejected" }],
    audit: [{ module: "moderation", actorId: "staff-1", at: older }],
    periodDays: 30,
    responseGoalMinutes: 30,
    slaWarningMinutes: 60,
    now,
  });
  const ana = rows.find((row) => row.id === "staff-1");

  assert.equal(ana?.claimedTickets, 0);
  assert.equal(ana?.closedTickets, 0);
  assert.equal(ana?.averageFirstResponseMinutes, null);
  assert.equal(ana?.averageRating, null);
  assert.equal(ana?.reviewedForms, 0);
  assert.equal(ana?.moderationActions, 0);
  assert.equal(ana?.ticketMessages, 0);
  assert.equal(ana?.lastActivityAt, null);
});

test("shows open ticket aging and recent attributed activity", () => {
  const rows = aggregateStaffMonitoring({
    members: staffMembers,
    tickets: [
      {
        id: 12,
        guildId: "guild",
        channelId: "channel-12",
        subject: "Problema com pedido",
        department: "Compras",
        priority: "high",
        status: "claimed",
        claimedBy: "staff-1",
        claimedAt: recent,
        createdAt: "2026-04-26T00:00:00.000Z",
        lastActivityAt: "2026-04-26T01:00:00.000Z",
        closedAt: null,
        firstResponseAt: null,
      },
    ],
    messages: [],
    forms: [],
    audit: [],
    periodDays: 30,
    responseGoalMinutes: 30,
    slaWarningMinutes: 60,
    now,
  });
  const ana = rows.find((row) => row.id === "staff-1");

  assert.equal(ana?.openTickets, 1);
  assert.equal(ana?.openTicketDetails[0]?.subject, "Problema com pedido");
  assert.equal(ana?.openTicketDetails[0]?.channelId, "channel-12");
  assert.equal(ana?.openTicketDetails[0]?.ageHours, 108);
  assert.equal(ana?.openTicketDetails[0]?.sla, "breach");
  assert.equal(ana?.activity[0]?.title, "Assumiu atendimento #12");
});

test("counts transfer, urgent escalation, reopen and successful moderation events", () => {
  const rows = aggregateStaffMonitoring({
    members: staffMembers,
    tickets: [
      {
        id: 13,
        guildId: "guild",
        channelId: "channel-13",
        status: "claimed",
        claimedBy: "staff-2",
        createdAt: recent,
        closedAt: null,
        firstResponseAt: null,
      },
    ],
    messages: [],
    forms: [],
    audit: [
      {
        id: 1,
        module: "tickets",
        eventType: "ticket_transferred",
        actorId: "staff-1",
        targetId: "staff-2",
        channelId: "channel-13",
        at: recent,
      },
      {
        id: 2,
        module: "tickets",
        eventType: "ticket_priority_changed",
        actorId: "staff-2",
        channelId: "channel-13",
        data: { ticketId: 13, priority: "urgent" },
        at: recent,
      },
      {
        id: 3,
        module: "tickets",
        eventType: "ticket_reopened",
        actorId: "staff-1",
        channelId: "channel-13",
        at: recent,
      },
    ],
    moderation: [
      {
        staffId: "staff-1",
        targetId: "member-1",
        requestedAction: "warn",
        appliedAction: "warn",
        status: "applied",
        createdAt: recent,
        appliedAt: recent,
      },
      {
        staffId: "staff-1",
        targetId: "member-2",
        requestedAction: "ban",
        appliedAction: null,
        status: "failed",
        createdAt: recent,
        appliedAt: null,
      },
    ],
    periodDays: 30,
    responseGoalMinutes: 30,
    slaWarningMinutes: 60,
    now,
  });
  const ana = rows.find((row) => row.id === "staff-1");
  const bia = rows.find((row) => row.id === "staff-2");

  assert.equal(ana?.transfersMade, 1);
  assert.equal(ana?.reopenActions, 1);
  assert.equal(ana?.moderationActions, 1);
  assert.equal(ana?.moderationAttempts, 2);
  assert.equal(bia?.transfersReceived, 1);
  assert.equal(bia?.escalations, 1);
  assert.ok(ana?.activity.some((event) => event.title.startsWith("Transferiu atendimento")));
  assert.ok(ana?.activity.some((event) => event.kind === "moderation"));
});
