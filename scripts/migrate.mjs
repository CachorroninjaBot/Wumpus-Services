#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * No DATABASE_URL (local / preview builds) -> skip.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  if (process.env.NODE_ENV === "production") {
    console.error("[banco] DATABASE_URL é obrigatória em produção.");
    process.exit(1);
  }
  console.log("[banco] Migrações ignoradas: DATABASE_URL não configurada.");
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const root = join(migrationsDir, "..");
const dataDirectory = resolve(process.env.WUMPUS_DATA_DIR || join(root, "data"));

function legacyFiles(entries) {
  const files = new Map();
  const knownFiles = new Map([
    [resolve(process.env.WUMPUS_RUNTIME_PATH || join(dataDirectory, "wumpus-runtime.json")), "runtime"],
    [resolve(process.env.WUMPUS_LICENSE_PATH || join(dataDirectory, "wumpus-entitlements.json")), "guild-licenses"],
    [resolve(process.env.WUMPUS_MEMBERS_PATH || join(dataDirectory, "wumpus-dashboard-members.json")), "dashboard-admin"],
    [resolve(process.env.WUMPUS_HEALTH_PATH || join(dataDirectory, "wumpus-health.json")), "bot-health"],
    [resolve(process.env.WUMPUS_SECURITY_REVIEWS_PATH || join(dataDirectory, "wumpus-security-reviews.json")), "security-reviews"],
  ]);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = resolve(dataDirectory, entry.name);
    files.set(path, knownFiles.get(path) ?? `bot-collection:${entry.name.slice(0, -5)}`);
  }
  for (const [path, key] of knownFiles) files.set(path, key);
  return [...files.entries()];
}

async function importLegacyState(pool, entries) {
  let imported = 0;
  for (const [path, key] of legacyFiles(entries)) {
    const marker = await pool.query(
      "SELECT 1 FROM wumpus_legacy_imports WHERE source_path = $1",
      [path],
    );
    if (marker.rowCount) continue;

    let text;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const value = JSON.parse(text);
    const rowCount = Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : 1;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO wumpus_state (key, value, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO NOTHING`,
        [key, JSON.stringify(value)],
      );
      await client.query(
        "INSERT INTO wumpus_legacy_imports (source_path, row_count) VALUES ($1, $2) ON CONFLICT (source_path) DO NOTHING",
        [path, rowCount],
      );
      await client.query("COMMIT");
      imported += 1;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  return imported;
}

async function main() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name);

    let count = 0;
    for (const { name } of pendingMigrations(entries.filter((entry) => entry.isFile()).map((entry) => entry.name), applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[banco] Falha ao aplicar a atualização ${name}.`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // keep the original error
        }
        throw err;
      }
      count += 1;
    }
    let dataEntries = [];
    try {
      dataEntries = await readdir(dataDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const imported = await importLegacyState(pool, dataEntries);
    console.log(
      `${count ? `[banco] ${count} ${count === 1 ? "atualização aplicada" : "atualizações aplicadas"}.` : "[banco] Banco atualizado."} ` +
      `${imported ? `${imported} arquivo(s) legado(s) importado(s).` : "Nenhum arquivo legado pendente."}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  const detail = String(err?.message || err).replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1[redacted]@");
  console.error("[banco] Não foi possível atualizar o banco:", detail);
  process.exit(1);
});
