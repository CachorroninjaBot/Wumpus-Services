import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("feedback is recorded only once by the ticket opener", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wumpus-ticket-feedback-"));
  const previousDataDir = process.env.WUMPUS_DATA_DIR;
  process.env.WUMPUS_DATA_DIR = directory;
  try {
    const { resetStoreCacheForTests, mutate, read } = await import("./store.ts");
    resetStoreCacheForTests();
    const { recordFeedback } = await import("./tickets.ts");
    await mutate("tickets", (rows) => {
      rows.push({
        id: 42,
        guildId: "guild-feedback",
        openerId: "ticket-opener",
        status: "closed",
        feedback: null,
        claimedBy: "staff-member",
      });
    });
    const log = { info() {}, warn() {}, error() {}, debug() {} };

    assert.equal(await recordFeedback(42, 6, "ticket-opener", log, "guild-feedback"), false);
    assert.equal(await recordFeedback(42, 5, "different-user", log, "guild-feedback"), false);
    assert.equal(await recordFeedback(42, 5, "ticket-opener", log, "another-guild"), false);
    assert.equal(await recordFeedback(42, 5, "ticket-opener", log, "guild-feedback"), true);
    assert.equal(await recordFeedback(42, 4, "ticket-opener", log, "guild-feedback"), false);

    const [ticket] = await read<{ feedback: { rating: number; comment: string | null } | null; feedbackStaffId: string }>("tickets");
    assert.deepEqual(ticket?.feedback, { rating: 5, comment: null });
    assert.equal(ticket?.feedbackStaffId, "staff-member");
  } finally {
    if (previousDataDir === undefined) delete process.env.WUMPUS_DATA_DIR;
    else process.env.WUMPUS_DATA_DIR = previousDataDir;
    await rm(directory, { recursive: true, force: true });
  }
});
