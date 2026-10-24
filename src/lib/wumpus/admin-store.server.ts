import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { PlanId } from "./catalog";
import type { SessionGuild } from "./session-token";
import { isDatabaseConfigured, mutatePersistentState, readPersistentState } from "./database.server.ts";

export type DashboardMemberRecord = {
  id: string;
  username: string;
  firstSeenAt: number;
  lastSeenAt: number;
  loginCount: number;
  suspended: boolean;
  suspensionReason: string | null;
  notes: string;
};

export type DashboardSessionRecord = {
  id: string;
  userId: string;
  username: string;
  guilds: SessionGuild[];
  startedAt: number;
  lastSeenAt: number;
  endedAt: number | null;
  revokedAt: number | null;
};

export type DashboardAdminEvent = {
  id: string;
  at: number;
  actorId: string;
  action: string;
  targetId: string;
  summary: string;
};

export type DashboardManualGrant = {
  id: string;
  userId: string;
  username: string;
  planId: PlanId;
  createdAt: number;
  expiresAt: number | null;
  createdBy: string;
  reason: string;
  revokedAt: number | null;
};

export type DashboardAdminState = {
  members: DashboardMemberRecord[];
  sessions: DashboardSessionRecord[];
  events: DashboardAdminEvent[];
  grants: DashboardManualGrant[];
  guildSelectionsByUser: Record<string, string[]>;
};

const memberSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1).max(100),
  firstSeenAt: z.number().finite(),
  lastSeenAt: z.number().finite(),
  loginCount: z.number().int().nonnegative().default(1),
  suspended: z.boolean().default(false),
  suspensionReason: z.string().max(300).nullable().default(null),
  notes: z.string().max(2000).default(""),
}).strict();

const sessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1).max(100),
  guilds: z.array(z.object({
    id: z.string().regex(/^\d{17,20}$/),
    name: z.string().max(100),
    iconUrl: z.string().max(300).nullable(),
    owner: z.boolean(),
  }).strict()).default([]),
  startedAt: z.number().finite(),
  lastSeenAt: z.number().finite(),
  endedAt: z.number().finite().nullable(),
  revokedAt: z.number().finite().nullable(),
}).strict();

const eventSchema = z.object({
  id: z.string().uuid(),
  at: z.number().finite(),
  actorId: z.string().regex(/^\d{17,20}$/),
  action: z.string().min(1).max(40),
  targetId: z.string().min(1).max(64),
  summary: z.string().min(1).max(500),
}).strict();
const grantSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1).max(100),
  planId: z.enum(["essencial", "pro", "escala", "vitalicio"]),
  createdAt: z.number().finite(),
  expiresAt: z.number().finite().nullable(),
  createdBy: z.string().regex(/^\d{17,20}$/),
  reason: z.string().min(1).max(500),
  revokedAt: z.number().finite().nullable(),
}).strict();

let writes: Promise<unknown> = Promise.resolve();
let cache: { state: DashboardAdminState; at: number } | null = null;
const CACHE_MS = 2_000;
const SESSION_IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60_000;
const SESSION_ABSOLUTE_TIMEOUT_MS = 30 * 24 * 60 * 60_000;

function storePath(): string {
  return process.env.WUMPUS_MEMBERS_PATH || join(process.cwd(), "data", "wumpus-dashboard-members.json");
}

function emptyState(): DashboardAdminState {
  return { members: [], sessions: [], events: [], grants: [], guildSelectionsByUser: {} };
}

function parseState(value: unknown): DashboardAdminState {
  // Migration from the previous file format, which stored only the member list.
  if (Array.isArray(value)) {
    const members = z.array(memberSchema).safeParse(value.map((row) => ({ ...row, loginCount: 1, suspended: false, suspensionReason: null, notes: "" })));
    if (!members.success) throw new Error("O cadastro de membros da dashboard está inválido.");
    return { ...emptyState(), members: members.data };
  }
  const parsed = z.object({
    members: z.array(memberSchema),
    sessions: z.array(sessionSchema),
    events: z.array(eventSchema),
    grants: z.array(grantSchema).default([]),
    guildSelectionsByUser: z.record(z.string().regex(/^\d{17,20}$/), z.array(z.string().regex(/^\d{17,20}$/))).default({}),
  }).strict().safeParse(value);
  if (!parsed.success) throw new Error("O cadastro administrativo da dashboard está inválido.");
  return parsed.data;
}

async function readState(force = false): Promise<DashboardAdminState> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return structuredClone(cache.state);
  if (isDatabaseConfigured()) {
    const state = parseState((await readPersistentState<unknown>("dashboard-admin")) ?? emptyState());
    cache = { state, at: Date.now() };
    return structuredClone(state);
  }
  try {
    const state = parseState(JSON.parse(await readFile(storePath(), "utf8")) as unknown);
    cache = { state, at: Date.now() };
    return structuredClone(state);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }
}

async function persist(state: DashboardAdminState): Promise<void> {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
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
  cache = { state: structuredClone(state), at: Date.now() };
}

async function mutateState<T>(fn: (state: DashboardAdminState) => T): Promise<T> {
  if (isDatabaseConfigured()) {
    let result!: T;
    let committedState!: DashboardAdminState;
    await mutatePersistentState<DashboardAdminState>(
      "dashboard-admin",
      emptyState,
      (current) => {
        const state = parseState(current);
        result = fn(state);
        committedState = state;
        return state;
      },
    );
    cache = { state: committedState, at: Date.now() };
    return result;
  }

  const next = writes.then(async () => {
    const state = await readState(true);
    const result = fn(state);
    await persist(state);
    return result;
  });
  writes = next.catch(() => undefined);
  return next;
}

function addEvent(state: DashboardAdminState, actorId: string, action: string, targetId: string, summary: string): void {
  state.events.unshift({ id: randomUUID(), at: Date.now(), actorId, action, targetId, summary });
  state.events.length = Math.min(state.events.length, 1000);
}

export async function recordDashboardLogin(
  member: { id: string; username: string },
  sessionId: string,
  guilds: SessionGuild[],
): Promise<void> {
  const safeMember = memberSchema.pick({ id: true, username: true }).parse(member);
  const safeSessionId = z.string().uuid().parse(sessionId);
  const safeGuilds = sessionSchema.shape.guilds.parse(guilds);
  await mutateState((state) => {
    const now = Date.now();
    let previous = state.members.find((row) => row.id === safeMember.id);
    if (previous?.suspended) throw new Error("Esta conta está suspensa. Fale com o suporte da plataforma.");
    if (!previous) {
      previous = {
        ...safeMember,
        firstSeenAt: now,
        lastSeenAt: now,
        loginCount: 0,
        suspended: false,
        suspensionReason: null,
        notes: "",
      };
      state.members.unshift(previous);
    }
    previous.username = safeMember.username;
    previous.lastSeenAt = now;
    previous.loginCount += 1;
    state.sessions.unshift({
      id: safeSessionId,
      userId: safeMember.id,
      username: safeMember.username,
      guilds: safeGuilds,
      startedAt: now,
      lastSeenAt: now,
      endedAt: null,
      revokedAt: null,
    });
    state.sessions.length = Math.min(state.sessions.length, 5000);
  });
}

export async function getDashboardSessionGuilds(sessionId: string, userId: string): Promise<SessionGuild[] | null> {
  const state = await readState();
  const session = state.sessions.find((row) => row.id === sessionId && row.userId === userId);
  return session ? structuredClone(session.guilds) : null;
}

export async function recordDashboardActivity(sessionId: string): Promise<void> {
  const safeId = z.string().uuid().parse(sessionId);
  await mutateState((state) => {
    const session = state.sessions.find((row) => row.id === safeId);
    if (!session || session.endedAt || session.revokedAt) return;
    const now = Date.now();
    // Heartbeats arrive every minute; avoiding writes within 30 seconds keeps
    // session tracking useful without doing needless disk I/O.
    if (now - session.lastSeenAt < 30_000) return;
    session.lastSeenAt = now;
    const member = state.members.find((row) => row.id === session.userId);
    if (member) member.lastSeenAt = now;
  });
}

export async function closeDashboardSession(sessionId: string, revoked = false): Promise<void> {
  const safeId = z.string().uuid().parse(sessionId);
  await mutateState((state) => {
    const session = state.sessions.find((row) => row.id === safeId);
    if (!session) return;
    const now = Date.now();
    session.endedAt ??= now;
    if (revoked) session.revokedAt ??= now;
    session.lastSeenAt = Math.max(session.lastSeenAt, now);
    session.guilds = [];
  });
}

export async function dashboardSessionIsUsable(sessionId: string, userId: string): Promise<boolean> {
  const state = await readState();
  const session = state.sessions.find((row) => row.id === sessionId && row.userId === userId);
  if (!session || session.endedAt || session.revokedAt) return false;
  if (state.members.find((row) => row.id === userId)?.suspended) return false;

  const now = Date.now();
  const idleExpired = now - session.lastSeenAt >= SESSION_IDLE_TIMEOUT_MS;
  const absoluteExpired = now - session.startedAt >= SESSION_ABSOLUTE_TIMEOUT_MS;
  if (!idleExpired && !absoluteExpired) return true;

  await mutateState((current) => {
    const expired = current.sessions.find((row) => row.id === sessionId && row.userId === userId);
    if (expired && !expired.endedAt) {
      expired.endedAt = now;
      expired.guilds = [];
    }
  });
  return false;
}

export async function isDashboardAccountSuspended(userId: string): Promise<boolean> {
  const state = await readState();
  return Boolean(state.members.find((row) => row.id === userId)?.suspended);
}

export async function getDashboardAdminState(): Promise<DashboardAdminState> {
  return readState();
}

export async function manageDashboardUser(input: {
  actorId: string;
  userId: string;
  action: "suspend" | "restore" | "revoke-sessions" | "save-notes" | "remove";
  reason?: string;
  notes?: string;
}): Promise<void> {
  const data = z.object({
    actorId: z.string().regex(/^\d{17,20}$/),
    userId: z.string().regex(/^\d{17,20}$/),
    action: z.enum(["suspend", "restore", "revoke-sessions", "save-notes", "remove"]),
    reason: z.string().trim().max(300).optional(),
    notes: z.string().max(2000).optional(),
  }).strict().parse(input);
  if (data.actorId === data.userId) throw new Error("A administração não pode alterar a própria conta.");

  await mutateState((state) => {
    const member = state.members.find((row) => row.id === data.userId);
    if (!member) throw new Error("Esta conta ainda não apareceu nos acessos registrados.");
    const now = Date.now();
    if (data.action === "suspend") {
      member.suspended = true;
      member.suspensionReason = data.reason || "Acesso suspenso pelo administrador.";
      for (const session of state.sessions) {
        if (session.userId === data.userId && !session.endedAt) {
          session.endedAt = now;
          session.revokedAt = now;
          session.guilds = [];
        }
      }
      addEvent(state, data.actorId, data.action, data.userId, `Conta suspensa. ${member.suspensionReason}`);
    } else if (data.action === "restore") {
      member.suspended = false;
      member.suspensionReason = null;
      addEvent(state, data.actorId, data.action, data.userId, "Acesso da conta restaurado.");
    } else if (data.action === "revoke-sessions") {
      for (const session of state.sessions) {
        if (session.userId === data.userId && !session.endedAt) {
          session.endedAt = now;
          session.revokedAt = now;
          session.guilds = [];
        }
      }
      addEvent(state, data.actorId, data.action, data.userId, "Sessões ativas revogadas.");
    } else if (data.action === "save-notes") {
      member.notes = data.notes ?? "";
      addEvent(state, data.actorId, data.action, data.userId, "Nota administrativa atualizada.");
    } else {
      for (const session of state.sessions) {
        if (session.userId === data.userId && !session.endedAt) {
          session.endedAt = now;
          session.revokedAt = now;
          session.guilds = [];
        }
      }
      let revokedGrants = 0;
      for (const grant of state.grants) {
        if (grant.userId === data.userId && !grant.revokedAt) {
          grant.revokedAt = now;
          revokedGrants += 1;
        }
      }
      state.members = state.members.filter((row) => row.id !== data.userId);
      addEvent(
        state,
        data.actorId,
        "remove-user",
        data.userId,
        `Cadastro de ${member.username} removido; sessões encerradas, ${revokedGrants} concessão(ões) manual(is) revogada(s). Histórico de auditoria preservado.`,
      );
    }
  });
}

export async function recordDashboardAdminEvent(input: Omit<DashboardAdminEvent, "id" | "at">): Promise<void> {
  const safe = z.object({
    actorId: z.string().regex(/^\d{17,20}$/),
    action: z.string().min(1).max(40),
    targetId: z.string().min(1).max(64),
    summary: z.string().min(1).max(500),
  }).strict().parse(input);
  await mutateState((state) => addEvent(state, safe.actorId, safe.action, safe.targetId, safe.summary));
}

export async function grantDashboardAccess(input: {
  actorId: string;
  userId: string;
  username: string;
  planId: PlanId;
  durationDays: number | null;
  reason: string;
}): Promise<DashboardManualGrant> {
  const data = z.object({
    actorId: z.string().regex(/^\d{17,20}$/),
    userId: z.string().regex(/^\d{17,20}$/),
    username: z.string().trim().min(1).max(100),
    planId: z.enum(["essencial", "pro", "escala", "vitalicio"]),
    durationDays: z.number().int().min(1).max(3650).nullable(),
    reason: z.string().trim().min(3).max(500),
  }).strict().superRefine((value, context) => {
    if ((value.planId === "vitalicio") !== (value.durationDays === null)) {
      context.addIssue({ code: "custom", message: "O plano Vitalício não expira; os demais planos exigem duração." });
    }
  }).parse(input);
  if (data.actorId === data.userId) throw new Error("A administração não pode alterar a própria conta por esta ação.");

  return mutateState((state) => {
    const now = Date.now();
    const current = state.grants.find((grant) => grant.userId === data.userId && !grant.revokedAt && (grant.expiresAt === null || grant.expiresAt > now));
    if (current) {
      current.revokedAt = now;
      addEvent(state, data.actorId, "grant-replaced", data.userId, `Concessão anterior encerrada para substituir o acesso manual.`);
    }
    const member = state.members.find((row) => row.id === data.userId);
    if (member?.suspended) throw new Error("Restaure a conta antes de conceder acesso.");
    const grant: DashboardManualGrant = {
      id: randomUUID(),
      userId: data.userId,
      username: member?.username ?? data.username,
      planId: data.planId,
      createdAt: now,
      expiresAt: data.durationDays === null ? null : now + data.durationDays * 24 * 60 * 60_000,
      createdBy: data.actorId,
      reason: data.reason,
      revokedAt: null,
    };
    state.grants.unshift(grant);
    state.grants.length = Math.min(state.grants.length, 2000);
    addEvent(state, data.actorId, "grant-access", data.userId, `Acesso manual ${data.planId} concedido${data.durationDays === null ? " sem expiração" : ` por ${data.durationDays} dia(s)`}. Motivo: ${data.reason.slice(0, 350)}`);
    return grant;
  });
}

export async function addDashboardUserWithGrant(input: {
  actorId: string;
  userId: string;
  username: string;
  planId: PlanId;
  durationDays: number | null;
  reason: string;
}): Promise<DashboardManualGrant> {
  const data = z.object({
    actorId: z.string().regex(/^\d{17,20}$/),
    userId: z.string().regex(/^\d{17,20}$/),
    username: z.string().trim().min(1).max(100),
    planId: z.enum(["essencial", "pro", "escala", "vitalicio"]),
    durationDays: z.number().int().min(1).max(3650).nullable(),
    reason: z.string().trim().min(3).max(500),
  }).strict().superRefine((value, context) => {
    if ((value.planId === "vitalicio") !== (value.durationDays === null)) {
      context.addIssue({ code: "custom", message: "O plano Vitalício não expira; os demais planos exigem duração." });
    }
  }).parse(input);
  if (data.actorId === data.userId) throw new Error("A administração não pode cadastrar a própria conta por esta ação.");

  return mutateState((state) => {
    if (state.members.some((member) => member.id === data.userId)) {
      throw new Error("Esta conta já está cadastrada. Selecione-a na lista para atribuir um plano.");
    }
    if (state.grants.some((grant) => grant.userId === data.userId && !grant.revokedAt && (grant.expiresAt === null || grant.expiresAt > Date.now()))) {
      throw new Error("Esta conta já possui uma concessão manual ativa.");
    }

    const now = Date.now();
    const grant: DashboardManualGrant = {
      id: randomUUID(),
      userId: data.userId,
      username: data.username,
      planId: data.planId,
      createdAt: now,
      expiresAt: data.durationDays === null ? null : now + data.durationDays * 24 * 60 * 60_000,
      createdBy: data.actorId,
      reason: data.reason,
      revokedAt: null,
    };
    state.members.unshift({
      id: data.userId,
      username: data.username,
      firstSeenAt: now,
      lastSeenAt: now,
      loginCount: 0,
      suspended: false,
      suspensionReason: null,
      notes: "",
    });
    state.grants.unshift(grant);
    state.grants.length = Math.min(state.grants.length, 2000);
    addEvent(state, data.actorId, "add-user-with-plan", data.userId, `${data.username} cadastrado com plano manual ${data.planId}${data.durationDays === null ? " sem expiração" : ` por ${data.durationDays} dia(s)`}. Motivo: ${data.reason.slice(0, 350)}`);
    return grant;
  });
}

export async function revokeDashboardGrant(input: { actorId: string; grantId: string }): Promise<void> {
  const data = z.object({ actorId: z.string().regex(/^\d{17,20}$/), grantId: z.string().uuid() }).strict().parse(input);
  await mutateState((state) => {
    const grant = state.grants.find((row) => row.id === data.grantId);
    if (!grant) throw new Error("A concessão manual não foi encontrada.");
    if (grant.revokedAt) return;
    grant.revokedAt = Date.now();
    addEvent(state, data.actorId, "revoke-grant", grant.userId, `Acesso manual ${grant.planId} revogado.`);
  });
}

export async function listDashboardGrants(): Promise<DashboardManualGrant[]> {
  return (await readState()).grants;
}

export async function getDashboardGuildSelection(userId: string): Promise<string[]> {
  const safeId = z.string().regex(/^\d{17,20}$/).parse(userId);
  return (await readState()).guildSelectionsByUser[safeId] ?? [];
}

export async function saveDashboardGuildSelection(input: {
  actorId: string;
  guildIds: string[];
}): Promise<void> {
  const data = z.object({
    actorId: z.string().regex(/^\d{17,20}$/),
    guildIds: z.array(z.string().regex(/^\d{17,20}$/)).max(200),
  }).strict().parse(input);
  const guildIds = [...new Set(data.guildIds)];
  await mutateState((state) => {
    state.guildSelectionsByUser[data.actorId] = guildIds;
    addEvent(state, data.actorId, "guild-selection", data.actorId, `${guildIds.length} servidor(es) selecionado(s) para a dashboard.`);
  });
}

/** Mantém o contrato antigo para telas que só precisam da lista de membros. */
export async function listDashboardMembers(): Promise<DashboardMemberRecord[]> {
  return (await readState()).members;
}
