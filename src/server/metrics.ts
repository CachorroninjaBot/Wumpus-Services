/**
 * Observabilidade operacional.
 *
 * Guardamos um anel em memoria (latencia recente, erros) e persistimos
 * amostras no Postgres para a area de admin. Nao substitui um APM, mas
 * responde "o que esta lento / quebrando agora" sem servico extra.
 */

import { getPool } from "./db/index.js";

export type MetricKind = "http" | "ai" | "bot";

export type MetricSample = {
  kind: MetricKind;
  name: string;
  durationMs: number;
  ok: boolean;
  status?: number;
  data?: Record<string, unknown>;
  at?: number;
};

type StoredSample = MetricSample & { at: number };

const RING = 400;
const samples: StoredSample[] = [];
let persistQueue: MetricSample[] = [];
let flushing = false;

export function recordMetric(sample: MetricSample): void {
  const entry: StoredSample = { ...sample, at: sample.at ?? Date.now() };
  samples.push(entry);
  if (samples.length > RING) samples.splice(0, samples.length - RING);
  persistQueue.push(entry);
  if (persistQueue.length >= 20) void flushMetrics();
}

export function snapshotMetrics(windowMs = 15 * 60_000) {
  const since = Date.now() - windowMs;
  const recent = samples.filter((sample) => sample.at >= since);
  const byName = new Map<
    string,
    { kind: string; name: string; count: number; errors: number; totalMs: number; lastMs: number; lastOk: boolean }
  >();

  for (const sample of recent) {
    const key = `${sample.kind}:${sample.name}`;
    const current = byName.get(key) ?? {
      kind: sample.kind,
      name: sample.name,
      count: 0,
      errors: 0,
      totalMs: 0,
      lastMs: 0,
      lastOk: true
    };
    current.count += 1;
    if (!sample.ok) current.errors += 1;
    current.totalMs += sample.durationMs;
    current.lastMs = sample.durationMs;
    current.lastOk = sample.ok;
    byName.set(key, current);
  }

  const routes = [...byName.values()]
    .map((entry) => ({
      ...entry,
      avgMs: entry.count ? Math.round(entry.totalMs / entry.count) : 0,
      errorRate: entry.count ? entry.errors / entry.count : 0
    }))
    .sort((a, b) => b.count - a.count);

  const http = recent.filter((sample) => sample.kind === "http");
  const ai = recent.filter((sample) => sample.kind === "ai");

  return {
    windowMinutes: Math.round(windowMs / 60_000),
    totals: {
      requests: http.length,
      requestErrors: http.filter((sample) => !sample.ok).length,
      avgRequestMs: average(http.map((sample) => sample.durationMs)),
      aiCalls: ai.length,
      aiErrors: ai.filter((sample) => !sample.ok).length,
      avgAiMs: average(ai.map((sample) => sample.durationMs))
    },
    routes,
    recent: recent
      .slice(-40)
      .reverse()
      .map((sample) => ({
        kind: sample.kind,
        name: sample.name,
        durationMs: sample.durationMs,
        ok: sample.ok,
        status: sample.status ?? null,
        at: new Date(sample.at).toISOString()
      }))
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function flushMetrics(): Promise<void> {
  if (flushing || !persistQueue.length) return;
  const batch = persistQueue.splice(0, 80);
  flushing = true;
  try {
    const db = getPool();
    for (const sample of batch) {
      await db.query(
        `insert into operational_metrics (kind, name, duration_ms, ok, status, data)
         values ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          sample.kind,
          sample.name.slice(0, 180),
          Math.max(0, Math.round(sample.durationMs)),
          sample.ok,
          sample.status ?? null,
          JSON.stringify(sample.data ?? {})
        ]
      );
    }
  } catch {
    persistQueue.unshift(...batch);
    if (persistQueue.length > 200) persistQueue = persistQueue.slice(-200);
  } finally {
    flushing = false;
  }
}

export function startMetricsFlush(intervalMs = 20_000): NodeJS.Timeout {
  return setInterval(() => {
    void flushMetrics();
  }, intervalMs);
}
