import assert from "node:assert/strict";
import test from "node:test";

import { isOnboardingReadabilityError, pushPersistedSecurityWindow, readPersistedSecurityWindow, type SecurityWindowKind, verificationSetupFailure } from "./security.ts";
import { flushPersistedSecurityWindows, resetSecurityWindowCacheForTests } from "./security/windows.ts";
import { mutate, resetStoreCacheForTests } from "./store.ts";

test("canal do onboarding que o Discord exige manter público é reconhecido", () => {
  assert.equal(isOnboardingReadabilityError({ code: 350003, message: "Onboarding channels must be readable by everyone" }), true);
  assert.equal(isOnboardingReadabilityError(new Error("unrelated permission error")), false);
});

test("outros erros de permissão preservam o detalhe do Discord", () => {
  const detail = verificationSetupFailure(new Error("Missing Permissions"));
  assert.match(detail, /Não consegui aplicar todas as permissões/);
  assert.match(detail, /Missing Permissions/);
});

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
  await flushPersistedSecurityWindows();
  resetSecurityWindowCacheForTests();
  resetStoreCacheForTests("security-windows");
  assert.equal((await readPersistedSecurityWindow(guildId, "raid", 10_000)).length, 2);

  await resetWindow(guildId, "raid");
  resetSecurityWindowCacheForTests();
});

test("janelas de nuke ficam separadas por autor", async () => {
  const guildId = "guild-persist-nuke";
  await resetWindow(guildId, "nuke-ban");

  await pushPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-1");
  await pushPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-1");
  await pushPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-2");

  const entries = await readPersistedSecurityWindow(guildId, "nuke-ban", 10_000, "user-1");
  assert.equal(entries.length, 2);
  await flushPersistedSecurityWindows();

  await resetWindow(guildId, "nuke-ban");
  resetSecurityWindowCacheForTests();
  resetStoreCacheForTests("security-windows");
});

test("janelas vencidas são removidas na leitura após recriar o módulo", async () => {
  const guildId = "guild-expired-window";
  const now = Date.now();
  await mutate<{ guildId: string; kind: SecurityWindowKind; entries: { at: number; actorId?: string }[]; updatedAt: number }>("security-windows", (rows) => {
    rows.push({ guildId, kind: "raid", entries: [{ at: now - 5_000 }], updatedAt: now - 5_000 });
  });
  resetSecurityWindowCacheForTests();
  assert.deepEqual(await readPersistedSecurityWindow(guildId, "raid", 1_000), []);
  await resetWindow(guildId, "raid");
});
