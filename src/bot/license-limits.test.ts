import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const directory = await mkdtemp(join(tmpdir(), "wumpus-license-limits-"));
process.env.WUMPUS_DATA_DIR = directory;
process.env.WUMPUS_LICENSE_PATH = join(directory, "licenses.json");

const { syncGuildEntitlements, readGuildLicenses } = await import("../lib/wumpus/license-store.server.ts");
const { reserveOcrRequest } = await import("./ocr.ts");
const { resetStoreCacheForTests } = await import("./store.ts");

after(async () => {
  resetStoreCacheForTests();
  await rm(directory, { recursive: true, force: true });
  delete process.env.WUMPUS_LICENSE_PATH;
  delete process.env.WUMPUS_DATA_DIR;
});

test("servidores fora da cota recebem licença inativa", async () => {
  await syncGuildEntitlements({
    accountId: "owner-1",
    discordUsername: "cliente",
    planId: "essencial",
    botGuildIds: ["g1", "g2"],
    ownedGuildIds: ["g1", "g2"],
    allowedGuildIds: ["g1"],
  });

  const licenses = (await readGuildLicenses()).byGuild;
  assert.equal(licenses.g1?.status, "active");
  assert.equal(licenses.g2?.status, "inactive");
  assert.equal(licenses.g2?.reason, "server_limit");
  assert.equal(licenses.g2?.priority, 1);
});

test("login de outra conta não substitui o vínculo de um servidor já atribuído", async () => {
  await syncGuildEntitlements({
    accountId: "owner-1",
    discordUsername: "primeiro",
    planId: "pro",
    botGuildIds: ["g3"],
    ownedGuildIds: ["g3"],
    allowedGuildIds: ["g3"],
  });
  await syncGuildEntitlements({
    accountId: "owner-2",
    discordUsername: "segundo",
    planId: "escala",
    botGuildIds: ["g3"],
    ownedGuildIds: ["g3"],
    allowedGuildIds: ["g3"],
  });

  const license = (await readGuildLicenses()).byGuild.g3;
  assert.equal(license?.accountId, "owner-1");
  assert.equal(license?.discordUsername, "primeiro");
  assert.equal(license?.planId, "pro");
});

test("servidor com vínculo inativo pode ser assumido pelo dono atual", async () => {
  await syncGuildEntitlements({
    accountId: "owner-1",
    discordUsername: "antigo",
    planId: null,
    botGuildIds: ["g4"],
    ownedGuildIds: ["g4"],
    allowedGuildIds: [],
  });
  await syncGuildEntitlements({
    accountId: "owner-2",
    discordUsername: "dono-atual",
    planId: "pro",
    botGuildIds: ["g4"],
    ownedGuildIds: ["g4"],
    allowedGuildIds: ["g4"],
  });

  const license = (await readGuildLicenses()).byGuild.g4;
  assert.equal(license?.accountId, "owner-2");
  assert.equal(license?.status, "active");
  assert.equal(license?.planId, "pro");
});

test("OCR Pro conta 500 chamadas por conta e por mês, compartilhadas entre servidores", async () => {
  resetStoreCacheForTests("ocr-usage");
  for (let index = 0; index < 500; index += 1) {
    assert.equal(await reserveOcrRequest("owner-2", 500), true);
  }
  assert.equal(await reserveOcrRequest("owner-2", 500), false);
  assert.equal(await reserveOcrRequest("owner-3", 500), true);
});

test("OCR do Escala não tem limite mensal", async () => {
  assert.equal(await reserveOcrRequest("owner-scale", null), true);
  assert.equal(await reserveOcrRequest("owner-scale", null), true);
});
