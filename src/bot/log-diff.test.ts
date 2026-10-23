import assert from "node:assert/strict";
import test from "node:test";
import { renderAuditDiff } from "./log-diff.ts";
import { renderLogEvent } from "./log-render.ts";

test("audit diff presents Discord before/after values with readable labels", () => {
  const fields = renderAuditDiff([
    { key: "name", old: "geral", new: "avisos" },
    { key: "rate_limit_per_user", old: 0, new: 30 },
  ] as never);
  assert.match(fields[0]?.value ?? "", /Nome[\s\S]*geral → avisos/);
  assert.match(fields[1]?.value ?? "", /Slowmode[\s\S]*0 → 30/);
});

test("audit diff truncates changes to its budget", () => {
  const fields = renderAuditDiff([{ key: "topic", old: "a".repeat(2000), new: "b".repeat(2000) }] as never, 80);
  assert.ok(fields.reduce((sum, field) => sum + field.value.length, 0) <= 80);
  assert.match(fields[0]?.value ?? "", /…$/);
});

test("log event renderer includes actor, target, channel, and timestamp in bounded fields", () => {
  const event = renderLogEvent({
    title: "x".repeat(300),
    description: "y".repeat(3000),
    actorId: "actor",
    targetId: "target",
    channelId: "channel",
    at: 1_700_000_000_000,
  });
  assert.equal(event.title.length, 250);
  assert.equal(event.description.length, 1800);
  assert.deepEqual(event.fields.map((field) => field.name), ["Autor", "Alvo", "Canal", "Horário"]);
});
