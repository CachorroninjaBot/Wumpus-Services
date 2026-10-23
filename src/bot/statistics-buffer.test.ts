import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeStatisticDeltas } from "./statistics-buffer.ts";

test("merges pending deltas by server and day without touching other counters", () => {
  const rows = [{ guildId: "guild-a", day: "2026-10-23", messages: 10, joins: 2, leaves: 1, tickets: 3 }];
  const result = mergeStatisticDeltas(rows, [
    { guildId: "guild-a", day: "2026-10-23", field: "messages", amount: 5 },
    { guildId: "guild-a", day: "2026-10-23", field: "tickets", amount: 1 },
    { guildId: "guild-b", day: "2026-10-23", field: "joins", amount: 2 },
  ]);

  assert.deepEqual(result, [
    { guildId: "guild-a", day: "2026-10-23", messages: 15, joins: 2, leaves: 1, tickets: 4 },
    { guildId: "guild-b", day: "2026-10-23", messages: 0, joins: 2, leaves: 0, tickets: 0 },
  ]);
});

test("an empty batch preserves the original rows", () => {
  const rows = [{ guildId: "guild-a", day: "2026-10-23", messages: 10, joins: 2, leaves: 1, tickets: 3 }];
  assert.equal(mergeStatisticDeltas(rows, []), rows);
});
