import { createServerFn } from "@tanstack/react-start";
import { readBotHealth } from "./health.server";

export type PublicBotHealth = {
  status: "online" | "offline" | "unknown";
  lastSeenAt: number | null;
  guildCount: number | null;
  pingMs: number | null;
};

export const getPublicBotHealth = createServerFn({ method: "GET" }).handler(async (): Promise<PublicBotHealth> => {
  const record = await readBotHealth();
  if (!record) return { status: "unknown", lastSeenAt: null, guildCount: null, pingMs: null };
  const fresh = record.status === "online" && Date.now() - record.at <= 90_000;
  return {
    status: fresh ? "online" : "offline",
    lastSeenAt: record.at,
    guildCount: record.guildCount,
    pingMs: record.pingMs,
  };
});
