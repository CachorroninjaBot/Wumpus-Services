import { getRequestIP } from "@tanstack/react-start/server";

type WindowCount = { start: number; count: number };
const buckets = new Map<string, WindowCount>();

/** Best-effort per-process throttle for costly or administrative RPC calls. */
export function enforceRequestLimit(bucket: string, limit: number, windowMs: number, identity?: string): void {
  const ip = getRequestIP({ xForwardedFor: false }) ?? "unknown";
  const key = `${bucket}:${identity ?? ip}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return;
  }
  if (current.count >= limit) throw new Error("Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.");
  current.count += 1;

  if (buckets.size > 10_000) {
    for (const [entry, value] of buckets) {
      if (now - value.start >= windowMs) buckets.delete(entry);
    }
  }
}
