import { mutate, read } from "../store.ts";

export type SecurityWindowKind = "raid" | "raid-alert" | "nuke-ban" | "nuke-channel" | "nuke-role" | "nuke-webhook" | "nuke-invite" | "nuke-mention" | "nuke-cooldown";
export type SecurityWindowEntry = { at: number; actorId?: string };
type SecurityWindowRecord = { guildId: string; kind: SecurityWindowKind; entries: SecurityWindowEntry[]; updatedAt: number };

const cache = new Map<string, SecurityWindowEntry[]>();
const lastPersistedAt = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, { guildId: string; kind: SecurityWindowKind }>();
const FLUSH_INTERVAL_MS = 1000;

function key(guildId: string, kind: SecurityWindowKind): string { return `${guildId}:${kind}`; }

async function flushKey(windowKey: string): Promise<void> {
  const item = pending.get(windowKey);
  if (!item) return;
  pending.delete(windowKey);
  const timer = timers.get(windowKey);
  if (timer) clearTimeout(timer);
  timers.delete(windowKey);
  const entries = cache.get(windowKey) ?? [];
  await mutate<SecurityWindowRecord>("security-windows", (rows) => {
    const next = { ...item, entries, updatedAt: Date.now() };
    const index = rows.findIndex((row) => row.guildId === item.guildId && row.kind === item.kind);
    if (index >= 0) rows[index] = next;
    else rows.push(next);
    return rows;
  });
  lastPersistedAt.set(windowKey, Date.now());
}

async function schedulePersist(guildId: string, kind: SecurityWindowKind, immediate = false): Promise<void> {
  const windowKey = key(guildId, kind);
  pending.set(windowKey, { guildId, kind });
  const waitMs = Math.max(0, FLUSH_INTERVAL_MS - (Date.now() - (lastPersistedAt.get(windowKey) ?? 0)));
  if (immediate || waitMs === 0) {
    await flushKey(windowKey);
    return;
  }
  if (!timers.has(windowKey)) {
    timers.set(windowKey, setTimeout(() => { void flushKey(windowKey); }, waitMs));
  }
}

const queues = new Map<string, Promise<void>>();

export async function readPersistedSecurityWindow(
  guildId: string, kind: SecurityWindowKind, windowMs: number, actorId?: string,
): Promise<SecurityWindowEntry[]> {
  const windowKey = key(guildId, kind);
  const now = Date.now();
  let entries = cache.get(windowKey);
  if (!entries) {
    const rows = await read<SecurityWindowRecord>("security-windows");
    entries = rows.find((row) => row.guildId === guildId && row.kind === kind)?.entries ?? [];
  }
  entries = entries.filter((entry) => now >= entry.at && now - entry.at <= windowMs);
  cache.set(windowKey, entries);
  if (actorId) return entries.filter((entry) => entry.actorId === actorId);
  return entries;
}

export async function pushPersistedSecurityWindow(
  guildId: string, kind: SecurityWindowKind, windowMs: number, actorId?: string,
): Promise<number> {
  const windowKey = key(guildId, kind);
  const previous = queues.get(windowKey) ?? Promise.resolve();
  let count = 0;
  const nextJob = previous.then(async () => {
    const now = Date.now();
    const current = await readPersistedSecurityWindow(guildId, kind, windowMs);
    const next = [...current, { at: now, ...(actorId ? { actorId } : {}) }];
    cache.set(windowKey, next);
    await schedulePersist(guildId, kind);
    count = actorId ? next.filter((entry) => entry.actorId === actorId).length : next.length;
  });
  queues.set(windowKey, nextJob.catch(() => undefined));
  await nextJob;
  return count;
}

export async function clearPersistedSecurityWindow(guildId: string, kind: SecurityWindowKind): Promise<void> {
  cache.set(key(guildId, kind), []);
  await schedulePersist(guildId, kind, true);
}

/** Exposed for deterministic restart tests and orderly bot shutdown. */
export async function flushPersistedSecurityWindows(): Promise<void> {
  await Promise.all([...pending.keys()].map((windowKey) => flushKey(windowKey)));
}

export function resetSecurityWindowCacheForTests(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  cache.clear();
  lastPersistedAt.clear();
  pending.clear();
  queues.clear();
}
