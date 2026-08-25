import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createDatabase, type JsonObject } from "@huborder/database";

const stateCookieName = "huborder_wumpus_oauth";
const sessionCookieName = "huborder_wumpus_session";
const sessionDurationMs = 1000 * 60 * 60 * 8;
const stateDurationMs = 1000 * 60 * 10;

export type DiscordManagedGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export type WumpusSession = {
  user: { id: string; username: string; globalName: string | null; avatar: string | null };
  guilds: DiscordManagedGuild[];
  expiresAt: number;
};

type SignedPayload<T> = { payload: T; signature: string };
type SessionReference = { sessionId: string };

let database: ReturnType<typeof createDatabase> | null = null;

function sessionDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for Wumpus dashboard sessions.");
  database ??= createDatabase(connectionString);
  return database;
}

function secret() {
  const value = process.env.DASHBOARD_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("DASHBOARD_SESSION_SECRET must contain at least 32 characters.");
  return value;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode<T>(payload: T): string {
  const body = toBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function decode<T>(token: string): SignedPayload<T> | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const expected = sign(body);
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  try {
    return { payload: JSON.parse(fromBase64Url(body)) as T, signature };
  } catch {
    return null;
  }
}

function useSecureCookies() {
  if (process.env.DASHBOARD_COOKIE_SECURE === "true") return true;
  if (process.env.DASHBOARD_COOKIE_SECURE === "false") return false;
  return process.env.WUMPUS_OAUTH_REDIRECT_URI?.startsWith("https://") ?? process.env.NODE_ENV === "production";
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: useSecureCookies(), path: "/", maxAge };
}

function isManagedGuild(value: JsonObject): value is JsonObject & DiscordManagedGuild {
  return typeof value.id === "string" && typeof value.name === "string" && (typeof value.icon === "string" || value.icon === null) &&
    typeof value.owner === "boolean" && typeof value.permissions === "string";
}

function sessionReference() {
  const store = cookies();
  return store.then((resolved) => ({ store: resolved, reference: decode<SessionReference>(resolved.get(sessionCookieName)?.value ?? "")?.payload ?? null }));
}

export async function createOAuthState() {
  const nonce = randomBytes(24).toString("base64url");
  const issuedAt = Date.now();
  const store = await cookies();
  store.set(stateCookieName, encode({ nonce, issuedAt }), cookieOptions(Math.ceil(stateDurationMs / 1000)));
  return encode({ nonce, issuedAt });
}

export async function consumeOAuthState(token: string) {
  const fromState = decode<{ nonce: string; issuedAt: number }>(token)?.payload;
  const store = await cookies();
  const fromCookie = decode<{ nonce: string; issuedAt: number }>(store.get(stateCookieName)?.value ?? "")?.payload;
  store.delete(stateCookieName);
  if (!fromState || !fromCookie || fromState.nonce !== fromCookie.nonce || fromState.issuedAt !== fromCookie.issuedAt) return false;
  return Date.now() - fromState.issuedAt >= 0 && Date.now() - fromState.issuedAt <= stateDurationMs;
}

export async function setWumpusSession(input: Omit<WumpusSession, "expiresAt">) {
  const session: WumpusSession = { ...input, expiresAt: Date.now() + sessionDurationMs };
  const sessionId = randomBytes(32).toString("base64url");
  await sessionDatabase().saveWumpusDashboardSession({
    sessionId,
    userId: session.user.id,
    username: session.user.username,
    globalName: session.user.globalName,
    avatar: session.user.avatar,
    guilds: session.guilds.map((guild) => ({ ...guild })),
    expiresAt: new Date(session.expiresAt)
  });
  const store = await cookies();
  store.set(sessionCookieName, encode({ sessionId }), cookieOptions(Math.ceil(sessionDurationMs / 1000)));
}

export async function getWumpusSession(): Promise<WumpusSession | null> {
  const { reference } = await sessionReference();
  if (!reference?.sessionId) return null;
  const saved = await sessionDatabase().getWumpusDashboardSession(reference.sessionId);
  if (!saved || !Array.isArray(saved.guilds)) return null;
  const ownerId = process.env.WUMPUS_OWNER_DISCORD_ID;
  const license = saved.userId === ownerId ? null : await sessionDatabase().getWumpusLicense(saved.userId);
  if (saved.userId !== ownerId && (!license || license.status !== "active" || (license.expiresAt && license.expiresAt.getTime() <= Date.now()))) return null;
  const managedGuilds = saved.guilds.filter(isManagedGuild).map((guild) => ({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    owner: guild.owner,
    permissions: guild.permissions
  }));
  const guilds = license ? managedGuilds.slice(0, license.maxServers) : managedGuilds;
  return {
    user: { id: saved.userId, username: saved.username, globalName: saved.globalName, avatar: saved.avatar },
    guilds,
    expiresAt: saved.expiresAt.getTime()
  };
}

export async function clearWumpusSession() {
  const { store, reference } = await sessionReference();
  if (reference?.sessionId) await sessionDatabase().deleteWumpusDashboardSession(reference.sessionId);
  store.delete(sessionCookieName);
}
