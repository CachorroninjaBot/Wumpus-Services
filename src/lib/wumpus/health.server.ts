import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type BotHealthRecord = {
  status: "online" | "offline";
  at: number;
  startedAt: number;
  guildCount: number;
  guildIds: string[];
  guildResources?: Record<string, {
    channels: Array<{ id: string; name: string; type: "text" | "category" }>;
    roles: Array<{ id: string; name: string; color: string; position: number }>;
    permissions?: {
      manageMessages: boolean;
      manageChannels: boolean;
      manageRoles: boolean;
      moderateMembers: boolean;
      viewAuditLog: boolean;
      banMembers: boolean;
    } | null;
  }>;
  pingMs: number | null;
};

export type BotHealthInspection = {
  state: "available" | "missing" | "invalid" | "unreadable";
  pathSource: "configured" | "default";
  record: BotHealthRecord | null;
  errorCode?: string;
};

function configuredHealthPath(): string | null {
  return process.env.WUMPUS_HEALTH_PATH?.trim() || null;
}

function healthPath(): string {
  return configuredHealthPath() ?? join(process.cwd(), "data", "wumpus-health.json");
}

export async function writeBotHealth(record: BotHealthRecord): Promise<void> {
  const path = healthPath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(record));
  await rename(tmp, path);
}

function parseBotHealth(value: unknown): BotHealthRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<BotHealthRecord>;
  if (
    (record.status !== "online" && record.status !== "offline") ||
    typeof record.at !== "number" ||
    typeof record.startedAt !== "number" ||
    typeof record.guildCount !== "number" ||
    (record.guildIds !== undefined && (!Array.isArray(record.guildIds) || !record.guildIds.every((id) => typeof id === "string"))) ||
    (typeof record.pingMs !== "number" && record.pingMs !== null)
  ) return null;
  return {
    status: record.status,
    at: record.at,
    startedAt: record.startedAt,
    guildCount: record.guildCount,
    guildIds: Array.isArray(record.guildIds) ? record.guildIds.filter((id): id is string => typeof id === "string" && /^\d{17,20}$/.test(id)) : [],
    guildResources: record.guildResources && typeof record.guildResources === "object" ? record.guildResources : {},
    pingMs: record.pingMs,
  };
}

export async function inspectBotHealth(): Promise<BotHealthInspection> {
  const path = healthPath();
  const pathSource = configuredHealthPath() ? "configured" : "default";
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { state: "missing", pathSource, record: null };
    return { state: "unreadable", pathSource, record: null, errorCode: code ?? "UNKNOWN" };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return { state: "invalid", pathSource, record: null, errorCode: "INVALID_JSON" };
  }
  const record = parseBotHealth(value);
  return record
    ? { state: "available", pathSource, record }
    : { state: "invalid", pathSource, record: null, errorCode: "INVALID_RECORD" };
}

export async function readBotHealth(): Promise<BotHealthRecord | null> {
  const inspection = await inspectBotHealth();
  if (inspection.state === "unreadable") {
    throw new Error(`Não foi possível ler o arquivo de saúde do Wumpus (${inspection.errorCode}).`);
  }
  return inspection.record;
}
