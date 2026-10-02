import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

export type DashboardMemberRecord = {
  id: string;
  username: string;
  firstSeenAt: number;
  lastSeenAt: number;
};

const memberSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1).max(100),
  firstSeenAt: z.number().finite(),
  lastSeenAt: z.number().finite(),
}).strict();

function membersPath(): string {
  return process.env.WUMPUS_MEMBERS_PATH || join(process.cwd(), "data", "wumpus-dashboard-members.json");
}

async function readMembers(): Promise<DashboardMemberRecord[]> {
  let raw: string;
  try {
    raw = await readFile(membersPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const parsed: unknown = JSON.parse(raw);
  const rows = z.array(memberSchema).safeParse(parsed);
  if (!rows.success) throw new Error("O cadastro de membros da dashboard está inválido.");
  return rows.data;
}

export async function recordDashboardLogin(member: { id: string; username: string }): Promise<void> {
  const safeMember = memberSchema.pick({ id: true, username: true }).parse(member);
  const current = await readMembers();
  const now = Date.now();
  const previous = current.find((row) => row.id === safeMember.id);
  const next = current.filter((row) => row.id !== safeMember.id);
  next.unshift({
    ...safeMember,
    firstSeenAt: previous?.firstSeenAt ?? now,
    lastSeenAt: now,
  });

  const path = membersPath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(next.slice(0, 1000), null, 2));
  await rename(tmp, path);
}

export async function listDashboardMembers(): Promise<DashboardMemberRecord[]> {
  return readMembers();
}
