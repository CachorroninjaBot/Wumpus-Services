import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectBotHealth } from "./health.server.ts";

async function withHealthFile(run: (path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "wumpus-health-test-"));
  const path = join(directory, "health.json");
  const previousPath = process.env.WUMPUS_HEALTH_PATH;
  process.env.WUMPUS_HEALTH_PATH = path;
  try {
    await run(path);
  } finally {
    if (previousPath === undefined) delete process.env.WUMPUS_HEALTH_PATH;
    else process.env.WUMPUS_HEALTH_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
}

test("diagnóstico identifica arquivo de saúde ausente", async () => {
  await withHealthFile(async () => {
    assert.deepEqual(await inspectBotHealth(), {
      state: "missing",
      pathSource: "configured",
      record: null,
    });
  });
});

test("diagnóstico separa JSON e registros inválidos", async () => {
  await withHealthFile(async (path) => {
    await writeFile(path, "{");
    assert.equal((await inspectBotHealth()).errorCode, "INVALID_JSON");

    await writeFile(path, JSON.stringify({ status: "unknown" }));
    assert.equal((await inspectBotHealth()).errorCode, "INVALID_RECORD");
  });
});

test("diagnóstico lê heartbeat e servidores reportados", async () => {
  await withHealthFile(async (path) => {
    const record = {
      status: "online",
      at: Date.now(),
      startedAt: Date.now() - 1_000,
      guildCount: 1,
      guildIds: ["12345678901234567"],
      pingMs: 42,
    };
    await writeFile(path, JSON.stringify(record));

    const inspection = await inspectBotHealth();
    assert.equal(inspection.state, "available");
    assert.equal(inspection.pathSource, "configured");
    assert.equal(inspection.record?.status, "online");
    assert.deepEqual(inspection.record?.guildIds, record.guildIds);
  });
});
