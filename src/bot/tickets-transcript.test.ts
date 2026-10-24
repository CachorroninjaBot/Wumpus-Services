import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("stores the built transcript with the ticket before channel cleanup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wumpus-ticket-transcript-"));
  const previousDataDir = process.env.WUMPUS_DATA_DIR;
  process.env.WUMPUS_DATA_DIR = directory;
  try {
    const { resetStoreCacheForTests, mutate, read } = await import("./store.ts");
    resetStoreCacheForTests();
    const { saveTicketTranscript } = await import("./tickets.ts");
    await mutate("tickets", (rows) => {
      rows.push({ id: 27, guildId: "guild-transcript", status: "open", transcript: null });
    });
    const transcript = "Atendimento #27 — Servidor\n\nPessoa: preciso de ajuda";

    assert.equal(await saveTicketTranscript("guild-transcript", 27, transcript), true);
    assert.equal(await saveTicketTranscript("guild-transcript", 28, transcript), false);

    const [ticket] = await read<{ transcript: string | null }>("tickets");
    assert.equal(ticket?.transcript, transcript);
  } finally {
    if (previousDataDir === undefined) delete process.env.WUMPUS_DATA_DIR;
    else process.env.WUMPUS_DATA_DIR = previousDataDir;
    await rm(directory, { recursive: true, force: true });
  }
});
