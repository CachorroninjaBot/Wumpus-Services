import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/oauth-Bd_iqpaO.js
var CLIENT_ID = () => process.env.DISCORD_CLIENT_ID || "1187601667559002225";
var CLIENT_SECRET = () => process.env.DISCORD_CLIENT_SECRET || "";
var REDIRECT_URI = () => process.env.DISCORD_REDIRECT_URI || "https://wumpus-dashboard.shardweb.app/auth/discord/callback";
function discordIconUrl(id, icon) {
	if (!icon) return null;
	return `https://cdn.discordapp.com/icons/${id}/${icon}.${icon.startsWith("a_") ? "gif" : "png"}?size=128`;
}
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
	if (!CLIENT_SECRET()) return {
		ok: false,
		error: "DISCORD_CLIENT_SECRET ausente na Shard Cloud."
	};
	const state = crypto.randomUUID();
	return {
		ok: true,
		url: discordAuthorizeUrl(state),
		state
	};
});
async function exchangeDiscordCodeDirect(code) {
	const secret = CLIENT_SECRET();
	if (!secret) return {
		ok: false,
		error: "DISCORD_CLIENT_SECRET ausente."
	};
	const body = new URLSearchParams({
		client_id: CLIENT_ID(),
		client_secret: secret,
		grant_type: "authorization_code",
		code,
		redirect_uri: REDIRECT_URI()
	});
	const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body
	});
	if (!tokenRes.ok) return {
		ok: false,
		error: `Discord recusou o código (${tokenRes.status}).`
	};
	const token = await tokenRes.json();
	if (!token.access_token) return {
		ok: false,
		error: "Sem access_token."
	};
	const meRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` } });
	if (!meRes.ok) return {
		ok: false,
		error: "Não deu para ler o usuário."
	};
	const me = await meRes.json();
	const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", { headers: { Authorization: `Bearer ${token.access_token}` } });
	const managed = (guildsRes.ok ? await guildsRes.json() : []).filter((g) => g.owner || (BigInt(g.permissions) & 32n) === 32n);
	return {
		ok: true,
		user: {
			id: me.id,
			username: me.username,
			globalName: me.global_name || me.username,
			avatar: me.avatar
		},
		guilds: managed.slice(0, 25).map((g) => ({
			id: g.id,
			name: g.name,
			owner: g.owner,
			iconUrl: discordIconUrl(g.id, g.icon)
		}))
	};
}
var exchangeDiscordCode_createServerFn_handler = createServerRpc({
	id: "e3ff6f93018f69ff6e0fba5a77225b4f52a16d74a6ff0ce6af19cfbbd62e838b",
	name: "exchangeDiscordCode",
	filename: "src/lib/discord/oauth.ts"
}, (opts) => exchangeDiscordCode.__executeServer(opts));
var exchangeDiscordCode = createServerFn({ method: "POST" }).validator((input) => input).handler(exchangeDiscordCode_createServerFn_handler, async ({ data }) => exchangeDiscordCodeDirect(data.code));
//#endregion
export { exchangeDiscordCode_createServerFn_handler, getDiscordLoginUrl_createServerFn_handler };
