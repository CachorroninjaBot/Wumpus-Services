import { d as setResponseHeaders, l as setCookie$1, o as deleteCookie$1, s as getCookie } from "./ssr.mjs";
import { timingSafeEqual } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/session-cookie.server-D0OzyQJ-.js
var SESSION_COOKIE = "wumpus_session";
var OAUTH_STATE_COOKIE = "wumpus_oauth_state";
var SESSION_MAX_AGE = 2592e3;
function cookieOptions(maxAge) {
	return {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge
	};
}
function setDashboardSessionCookie(token) {
	setCookie$1(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE));
}
function getDashboardSessionCookie() {
	return getCookie(SESSION_COOKIE);
}
function clearDashboardSessionCookie() {
	deleteCookie$1(SESSION_COOKIE, cookieOptions(0));
}
function setOAuthStateCookie(state) {
	setCookie$1(OAUTH_STATE_COOKIE, state, cookieOptions(300));
}
function consumeOAuthStateCookie(expected) {
	const state = getCookie(OAUTH_STATE_COOKIE);
	deleteCookie$1(OAUTH_STATE_COOKIE, cookieOptions(0));
	if (!state || !expected) return false;
	const supplied = Buffer.from(state);
	const candidate = Buffer.from(expected);
	return supplied.length === candidate.length && timingSafeEqual(supplied, candidate);
}
function markPrivateResponse() {
	setResponseHeaders(new Headers({
		"Cache-Control": "private, no-store",
		Vary: "Cookie"
	}));
}
//#endregion
export { setDashboardSessionCookie as a, markPrivateResponse as i, consumeOAuthStateCookie as n, setOAuthStateCookie as o, getDashboardSessionCookie as r, clearDashboardSessionCookie as t };
