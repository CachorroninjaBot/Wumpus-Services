import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createServerFn } from "@tanstack/react-start";

export type RuntimeGuild = {
  name?: string;
  tickets?: Record<string, unknown>;
  forms?: Record<string, unknown>;
  automod?: Record<string, unknown>;
  security?: Record<string, unknown>;
  servers?: Record<string, unknown>;
  moderation?: Record<string, unknown>;
};

export type RuntimeFile = {
  updatedAt: number;
  guilds: Record<string, RuntimeGuild>;
};

function filePath() {
  return process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");
}

export async function readRuntime(): Promise<RuntimeFile> {
  try {
    const raw = await readFile(filePath(), "utf8");
    return JSON.parse(raw) as RuntimeFile;
  } catch {
    return { updatedAt: 0, guilds: {} };
  }
}

export async function writeRuntime(next: RuntimeFile) {
  const path = filePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2));
}

export const publishGuildRuntime = createServerFn({ method: "POST" })
  .validator(
    (input: { guildId: string; name?: string; modules: RuntimeGuild }) => input,
  )
  .handler(async ({ data }) => {
    const cur = await readRuntime();
    cur.guilds[data.guildId] = { ...cur.guilds[data.guildId], ...data.modules, name: data.name };
    cur.updatedAt = Date.now();
    await writeRuntime(cur);
    return { ok: true as const, updatedAt: cur.updatedAt };
  });

export const readGuildRuntime = createServerFn({ method: "GET" }).handler(async () => {
  return readRuntime();
});
