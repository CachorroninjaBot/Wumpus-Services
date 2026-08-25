import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "huborder_admin_session";
const durationSeconds = 60 * 60 * 8;

type AdminSession = { username: string; expiresAt: number; nonce: string };

function secret() {
  const value = process.env.DASHBOARD_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("DASHBOARD_SESSION_SECRET must contain at least 32 characters.");
  return value;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function encode(session: AdminSession) {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return body + "." + sign(body);
}

function decode(value: string): AdminSession | null {
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra || !safeEqual(signature, sign(body))) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSession;
    return typeof session.username === "string" && typeof session.expiresAt === "number" && typeof session.nonce === "string" ? session : null;
  } catch {
    return null;
  }
}

function secureCookie() {
  if (process.env.DASHBOARD_COOKIE_SECURE === "true") return true;
  if (process.env.DASHBOARD_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function authenticateAdmin(username: string, password: string) {
  const expectedUsername = process.env.DASHBOARD_USERNAME ?? "";
  const expectedPassword = process.env.DASHBOARD_PASSWORD ?? "";
  if (!expectedUsername || !expectedPassword || !safeEqual(username, expectedUsername) || !safeEqual(password, expectedPassword)) return false;
  const session: AdminSession = { username: expectedUsername, expiresAt: Date.now() + durationSeconds * 1000, nonce: randomBytes(16).toString("base64url") };
  const store = await cookies();
  store.set(cookieName, encode(session), { httpOnly: true, sameSite: "strict", secure: secureCookie(), path: "/", maxAge: durationSeconds });
  return true;
}

export async function getAdminSession() {
  const store = await cookies();
  const session = decode(store.get(cookieName)?.value ?? "");
  if (!session || session.expiresAt <= Date.now()) return null;
  return session;
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(cookieName);
}
