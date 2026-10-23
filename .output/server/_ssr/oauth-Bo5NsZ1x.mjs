import { r as createServerFn } from "./ssr.mjs";
import { n as enforceRequestLimit, t as createServerRpc } from "./request-limits.server-D3WMs2Xr.mjs";
import { o as setOAuthStateCookie } from "./session-cookie.server-D0OzyQJ-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/oauth-Bo5NsZ1x.js
var CLIENT_ID = () => process.env.DISCORD_CLIENT_ID || "1187601667559002225";
var CLIENT_SECRET = () => process.env.DISCORD_CLIENT_SECRET || "";
var REDIRECT_URI = () => process.env.DISCORD_REDIRECT_URI || "https://wumpus-dashboard.shardweb.app/auth/discord/callback";
function discordAuthorizeUrl(state) {
	return `https://discord.com/api/oauth2/authorize?${new URLSearchParams({
		client_id: CLIENT_ID(),
		response_type: "code",
		scope: "identify guilds",
		redirect_uri: REDIRECT_URI(),
		state,
		prompt: "consent"
	})}`;
}
var getDiscordLoginUrl_createServerFn_handler = createServerRpc({
	id: "2100c9bd45e20d4160606b2c28cd31067d4ed526907470941477a8eb4339333d",
	name: "getDiscordLoginUrl",
	filename: "src/lib/discord/oauth.ts"
}, (opts) => getDiscordLoginUrl.__executeServer(opts));
var getDiscordLoginUrl = createServerFn({ method: "GET" }).handler(getDiscordLoginUrl_createServerFn_handler, async () => {
	enforceRequestLimit("discord-oauth-start", 10, 6e5);
	if (!CLIENT_SECRET()) return {
		ok: false,
		error: "DISCORD_CLIENT_SECRET ausente na Shard Cloud."
	};
	const state = crypto.randomUUID();
	setOAuthStateCookie(state);
	return {
		ok: true,
		url: discordAuthorizeUrl(state),
		state
	};
});
//#endregion
export { getDiscordLoginUrl_createServerFn_handler };
