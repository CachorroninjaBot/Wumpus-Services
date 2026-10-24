import { timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, getRequestHeader, getRequestUrl, setCookie, setResponseHeaders } from "@tanstack/react-start/server";

export const SESSION_COOKIE = "wumpus_session";
export const OAUTH_STATE_COOKIE = "wumpus_oauth_state";
const COOKIE_SESSION_MARKER = "cookie-session";
// Persistent browser session: up to 30 days, with a shorter server-side idle timeout.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || getRequestUrl().protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function setDashboardSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE));
}

export function getDashboardSessionCookie(): string | undefined {
  return getCookie(SESSION_COOKIE);
}

export function getDashboardSessionCredential(fallback = ""): string {
  const authorization = getRequestHeader("authorization");
  const bearer = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (bearer && bearer.length <= 16_384) return bearer;
  if (fallback && fallback !== COOKIE_SESSION_MARKER && fallback.length <= 16_384) return fallback;
  return getDashboardSessionCookie() ?? "";
}

export function clearDashboardSessionCookie(): void {
  deleteCookie(SESSION_COOKIE, cookieOptions(0));
}

export function setOAuthStateCookie(state: string): void {
  setCookie(OAUTH_STATE_COOKIE, state, cookieOptions(5 * 60));
}

export function consumeOAuthStateCookie(expected: string): boolean {
  const state = getCookie(OAUTH_STATE_COOKIE);
  deleteCookie(OAUTH_STATE_COOKIE, cookieOptions(0));
  if (!state || !expected) return false;
  const supplied = Buffer.from(state);
  const candidate = Buffer.from(expected);
  return supplied.length === candidate.length && timingSafeEqual(supplied, candidate);
}

export function markPrivateResponse(): void {
  setResponseHeaders(new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie" }));
}
