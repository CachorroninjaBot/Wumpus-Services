#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * No DATABASE_URL (local / preview builds) -> skip.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("[banco] Migrações ignoradas: DATABASE_URL não configurada.");
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[banco] Sem pasta de migrações; nada a atualizar.");
    return;
  }
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[banco] Banco atualizado; nenhuma migração pendente.");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name);

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
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
    console.log(count ? `[banco] ${count} ${count === 1 ? "atualização aplicada" : "atualizações aplicadas"}.` : "[banco] Banco atualizado.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[banco] Não foi possível atualizar o banco:", err?.message || err);
  process.exit(1);
});
