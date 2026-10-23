import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { PlanId } from "./catalog.ts";

export type GuildLicense = {
  status: "active" | "inactive";
  planId: PlanId | null;
  accountId: string;
  discordUsername: string;
  updatedAt: number;
  priority: number;
  reason?: "server_limit" | "no_subscription";
};

export type LicenseFile = { updatedAt: number; byGuild: Record<string, GuildLicense> };

let writes: Promise<unknown> = Promise.resolve();

function licensePath(): string {
  return process.env.WUMPUS_LICENSE_PATH || join(process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data"), "wumpus-entitlements.json");
}

export async function readGuildLicenses(): Promise<LicenseFile> {
  try {
    const parsed = JSON.parse(await readFile(licensePath(), "utf8")) as Partial<LicenseFile>;
    return {
      updatedAt: Number(parsed.updatedAt) || 0,
      byGuild: parsed.byGuild && typeof parsed.byGuild === "object" ? parsed.byGuild : {},
    };
  } catch {
    return { updatedAt: 0, byGuild: {} };
  }
}

/** Serialize account syncs from dashboard and bot against the shared file. */
export async function mutateGuildLicenses(mutator: (current: LicenseFile) => LicenseFile | void): Promise<LicenseFile> {
  const next = writes.then(async () => {
    const current = await readGuildLicenses();
    const updated = mutator(current) ?? current;
    const path = licensePath();
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(updated, null, 2));
    try {
      await rename(temp, path);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EEXIST" && code !== "EACCES") throw error;
      await rm(path, { force: true });
      await rename(temp, path);
    } finally {
      await rm(temp, { force: true });
    }
    return updated;
  });
  writes = next.catch(() => undefined);
  return next;
}

/** Atualiza a licença por servidor após validar dono, assinatura e presença do bot. */
export async function syncGuildEntitlements(input: {
  accountId: string;
  discordUsername: string;
  planId: PlanId | null;
  botGuildIds: string[];
  ownedGuildIds: string[];
  allowedGuildIds: string[];
}): Promise<void> {
  const owned = new Set(input.ownedGuildIds);
  const bot = new Set(input.botGuildIds);
  const allowed = new Set(input.allowedGuildIds);
  const guildIds = [...owned].filter((id) => bot.has(id));
  if (!guildIds.length) return;

  await mutateGuildLicenses((current) => {
    const now = Date.now();
    for (const [priority, guildId] of guildIds.entries()) {
      const active = allowed.has(guildId) && input.planId !== null;
      current.byGuild[guildId] = {
        status: active ? "active" : "inactive",
        planId: input.planId,
        accountId: input.accountId,
        discordUsername: input.discordUsername,
        updatedAt: now,
        priority,
        ...(!active ? { reason: input.planId ? "server_limit" as const : "no_subscription" as const } : {}),
      };
    }
    current.updatedAt = now;
    return current;
  });
}
