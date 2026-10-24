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
    tickets: [],
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
