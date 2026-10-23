import { createServerFn } from "@tanstack/react-start";
import { readBotHealth } from "./health.server";
import { enforceRequestLimit } from "./request-limits.server";

export type PublicBotHealth = {
  status: "online" | "offline" | "unknown";
  lastSeenAt: number | null;
  guildCount: number | null;
  pingMs: number | null;
};

export const getPublicBotHealth = createServerFn({ method: "GET" }).handler(async (): Promise<PublicBotHealth> => {
  enforceRequestLimit("public-bot-health", 120, 60_000);
  const record = await readBotHealth();
  if (!record) return { status: "unknown", lastSeenAt: null, guildCount: null, pingMs: null };
  const fresh = record.status === "online" && Date.now() - record.at <= 90_000;
  return {
    status: fresh ? "online" : "offline",
    lastSeenAt: null,
    guildCount: null,
    pingMs: null,
  };
});
