import assert from "node:assert/strict";
import test from "node:test";

import { pushPersistedSecurityWindow, readPersistedSecurityWindow, type SecurityWindowKind } from "./security.ts";
import { mutate } from "./store.ts";

async function resetWindow(guildId: string, kind: SecurityWindowKind): Promise<void> {
  await mutate<{ guildId: string; kind: SecurityWindowKind }>("security-windows", (rows) => {
    return rows.filter((row) => !(row.guildId === guildId && row.kind === kind));
  });
}

test("janelas de raid persistem e contam entradas dentro do prazo", async () => {
  const guildId = "guild-persist-raid";
  await resetWindow(guildId, "raid");

  await pushPersistedSecurityWindow(guildId, "raid", 10_000);
  const secondCount = await pushPersistedSecurityWindow(guildId, "raid", 10_000);
  const entries = await readPersistedSecurityWindow(guildId, "raid", 10_000);

  assert.equal(secondCount, 2);
  assert.equal(entries.length, 2);

  await resetWindow(guildId, "raid");
});

test("janelas de nuke ficam separadas por autor", async () => {
  const guildId = "guild-persist-nuke";
  await resetWindow(guildId, "nuke-ban");

  await pushPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-1");
  await pushPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-1");
  await pushPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-2");

  const entries = await readPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-1");
  assert.equal(entries.length, 2);

  await resetWindow(guildId, "nuke-ban");
});
