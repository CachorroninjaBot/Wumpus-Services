import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateStaffReport, reportLines } from "./tickets-metrics.ts";

test("aggregateStaffReport conta carga aberta por atendente na janela", () => {
  const now = Date.parse("2026-01-15T12:00:00.000Z");
  const reports = aggregateStaffReport(
    [
      {
        id: 1,
        guildId: "1",
        claimedBy: "staff-a",
        status: "claimed",
        createdAt: "2026-01-10T10:00:00.000Z",
        claimedAt: "2026-01-10T10:05:00.000Z",
      },
      {
        id: 2,
        guildId: "1",
        claimedBy: "staff-a",
        status: "open",
        createdAt: "2026-01-12T10:00:00.000Z",
      },
      {
        id: 3,
        guildId: "1",
        claimedBy: "staff-b",
        status: "closed",
        createdAt: "2026-01-08T10:00:00.000Z",
        claimedAt: "2026-01-08T10:10:00.000Z",
        closedAt: "2026-01-08T11:00:00.000Z",
      },
    ],
    30,
    now,
  );
  const a = reports.find((row) => row.staffId === "staff-a");
  assert.ok(a);
  assert.equal(a!.claimed, 2);
  assert.equal(a!.open, 2);
  assert.equal(a!.closed, 0);
});

test("reportLines destaca meta de primeira resposta", () => {
  const lines = reportLines(
    [
      {
        staffId: "42",
        claimed: 1,
        open: 0,
        closed: 1,
        averageFirstResponseMinutes: 45,
        averageResolveMinutes: 90,
        csat: 5,
      },
    ],
    30,
  );
  assert.match(lines[0]!, /45/);
});
