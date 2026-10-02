import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type BotHealthRecord = {
  status: "online" | "offline";
  at: number;
  startedAt: number;
  guildCount: number;
  pingMs: number | null;
};

function healthPath(): string {
  return process.env.WUMPUS_HEALTH_PATH || join(process.cwd(), "data", "wumpus-health.json");
}

export async function writeBotHealth(record: BotHealthRecord): Promise<void> {
  const path = healthPath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(record));
  await rename(tmp, path);
}

export async function readBotHealth(): Promise<BotHealthRecord | null> {
  let raw: string;
  try {
    raw = await readFile(healthPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<BotHealthRecord>;
  if (
    (record.status !== "online" && record.status !== "offline") ||
    typeof record.at !== "number" ||
    typeof record.startedAt !== "number" ||
    typeof record.guildCount !== "number" ||
    (typeof record.pingMs !== "number" && record.pingMs !== null)
  ) return null;
  return {
    status: record.status,
    at: record.at,
    startedAt: record.startedAt,
    guildCount: record.guildCount,
    pingMs: record.pingMs,
  };
}
