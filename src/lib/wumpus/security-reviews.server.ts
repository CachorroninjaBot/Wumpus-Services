import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type ReviewState = { byGuild: Record<string, number[]> };
const EMPTY: ReviewState = { byGuild: {} };
let writeQueue: Promise<void> = Promise.resolve();

function reviewPath() {
  return process.env.WUMPUS_SECURITY_REVIEWS_PATH
    || join(process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data"), "wumpus-security-reviews.json");
}

async function readState(): Promise<ReviewState> {
  try {
    const parsed = JSON.parse(await readFile(reviewPath(), "utf8")) as Partial<ReviewState>;
    return parsed.byGuild && typeof parsed.byGuild === "object" ? { byGuild: parsed.byGuild } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function readReviewedSecurityEvents(guildId: string): Promise<number[]> {
  const state = await readState();
  const ids = state.byGuild[guildId];
  return Array.isArray(ids) ? ids.filter((id): id is number => Number.isSafeInteger(id) && id > 0) : [];
}

export async function markSecurityEventReviewed(guildId: string, eventId: number): Promise<void> {
  const task = writeQueue.then(async () => {
    const state = await readState();
    const current = state.byGuild[guildId] ?? [];
    state.byGuild[guildId] = [...new Set([...current, eventId])].slice(-1000);
    const path = reviewPath();
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state));
    await rename(temporaryPath, path);
  });
  writeQueue = task.catch(() => undefined);
  await task;
}
