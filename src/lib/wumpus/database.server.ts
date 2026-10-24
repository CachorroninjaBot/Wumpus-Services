import pg, { type Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL não está configurada.");
  pool ??= new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

export async function readPersistentState<T>(key: string): Promise<T | null> {
  const result = await getPool().query<{ value: T }>(
    "SELECT value FROM wumpus_state WHERE key = $1",
    [key],
  );
  return result.rows[0]?.value ?? null;
}

export async function writePersistentState<T>(key: string, value: T): Promise<void> {
  await getPool().query(
    `INSERT INTO wumpus_state (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function mutatePersistentState<T>(
  key: string,
  initialValue: () => T,
  update: (current: T) => T | void,
): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO wumpus_state (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(initialValue())],
    );
    const result = await client.query<{ value: T }>(
      "SELECT value FROM wumpus_state WHERE key = $1 FOR UPDATE",
      [key],
    );
    if (!result.rows[0]) throw new Error(`Estado persistente ausente após inicialização: ${key}`);
    const current = result.rows[0].value;
    const next = update(current) ?? current;
    await client.query(
      "UPDATE wumpus_state SET value = $2::jsonb, updated_at = now() WHERE key = $1",
      [key, JSON.stringify(next)],
    );
    await client.query("COMMIT");
    return next;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabasePoolForTests(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}
