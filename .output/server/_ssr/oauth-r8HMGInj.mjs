import { r as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/oauth-r8HMGInj.js
/** Manage Server may be granted directly or implicitly through Administrator. */
function canManageDiscordGuild(permissionValue) {
	try {
		return (BigInt(permissionValue) & (1n << 5n | 1n << 3n)) !== 0n;
	} catch {
		return false;
	}
}
function parseDiscordGuilds(value) {
	if (!Array.isArray(value)) return null;
	const validGuilds = [];
	let missingPermissions = 0;
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const row = item;
		if (typeof row.id !== "string" || !/^\d{17,20}$/.test(row.id) || typeof row.name !== "string") continue;
		const permissions = typeof row.permissions === "string" ? row.permissions : null;
		if (!permissions && row.owner !== true) missingPermissions += 1;
		validGuilds.push({
			id: row.id,
			name: row.name.slice(0, 100),
			icon: typeof row.icon === "string" ? row.icon : null,
			owner: row.owner === true,
			permissions
		});
	}
	const manageableByPermissions = validGuilds.filter((guild) => guild.permissions !== null && canManageDiscordGuild(guild.permissions)).length;
	return {
		guilds: validGuilds.filter((guild) => guild.owner || guild.permissions !== null && canManageDiscordGuild(guild.permissions)).map(({ permissions: _permissions, ...guild }) => guild),
		stats: {
			received: value.length,
			valid: validGuilds.length,
			owners: validGuilds.filter((guild) => guild.owner).length,
			withPermissions: validGuilds.filter((guild) => guild.permissions !== null).length,
			manageableByPermissions,
			missingPermissions
		}
	};
}
var CLIENT_ID = () => process.env.DISCORD_CLIENT_ID || "1187601667559002225";
var CLIENT_SECRET = () => process.env.DISCORD_CLIENT_SECRET || "";
var REDIRECT_URI = () => process.env.DISCORD_REDIRECT_URI || "https://wumpus-dashboard.shardweb.app/auth/discord/callback";
function discordIconUrl(id, icon) {
	if (!icon) return null;
	return `https://cdn.discordapp.com/icons/${id}/${icon}.${icon.startsWith("a_") ? "gif" : "png"}?size=128`;
}
var getDiscordLoginUrl = createServerFn({ method: "GET" }).handler(createSsrRpc("2100c9bd45e20d4160606b2c28cd31067d4ed526907470941477a8eb4339333d"));
/**
* Troca o `code` do Discord pelos dados do usuario.
*
* Fica como funcao comum exportada para que OUTRO handler de servidor possa
* reaproveitar — o de sessao precisa disto para assinar o token com dados que
* vieram do Discord, nunca do navegador. O `createServerFn` abaixo e so a
* porta de entrada do cliente.
*/
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
		body,
		signal: AbortSignal.timeout(1e4)
	});
	if (!tokenRes.ok) return {
		ok: false,
		error: `Discord recusou o código (${tokenRes.status}).`
	};
	const token = await tokenRes.json();
	if (typeof token.access_token !== "string" || token.access_token.length < 1 || token.access_token.length > 4096) return {
		ok: false,
		error: "A resposta de autenticação do Discord é inválida."
	};
	const meRes = await fetch("https://discord.com/api/users/@me", {
		headers: { Authorization: `Bearer ${token.access_token}` },
		signal: AbortSignal.timeout(1e4)
	});
	if (!meRes.ok) return {
		ok: false,
		error: "Não deu para ler o usuário."
	};
	const me = await meRes.json();
	if (typeof me.id !== "string" || !/^\d{17,20}$/.test(me.id) || typeof me.username !== "string" || !me.username.trim()) return {
		ok: false,
		error: "O Discord retornou uma identidade inválida."
	};
	const guildsRes = await fetch("https://discord.com/api/users/@me/guilds?limit=200", {
		headers: { Authorization: `Bearer ${token.access_token}` },
		signal: AbortSignal.timeout(1e4)
	});
	if (!guildsRes.ok) {
		console.error("[discord-oauth-guilds] Discord recusou a consulta de servidores.", JSON.stringify({ status: guildsRes.status }));
		return {
			ok: false,
			error: "Não foi possível validar os servidores da conta Discord."
		};
	}
	const parsedGuilds = parseDiscordGuilds(await guildsRes.json());
	if (!parsedGuilds) {
		console.error("[discord-oauth-guilds] Discord retornou uma lista de servidores inválida.");
		return {
			ok: false,
			error: "O Discord retornou uma lista de servidores inválida."
		};
	}
	const managed = parsedGuilds.guilds;
	console.info("[discord-oauth-guilds]", JSON.stringify({
		...parsedGuilds.stats,
		manageable: managed.length
	}));
	return {
		ok: true,
		user: {
			id: me.id,
			username: me.username.slice(0, 100),
			globalName: typeof me.global_name === "string" && me.global_name ? me.global_name.slice(0, 100) : me.username.slice(0, 100),
			avatar: typeof me.avatar === "string" ? me.avatar : null,
			mfaEnabled: me.mfa_enabled === true
		},
		guilds: managed.map((guild) => ({
			id: guild.id,
			name: guild.name,
			owner: guild.owner,
			iconUrl: discordIconUrl(guild.id, guild.icon)
		}))
	};
}
//#endregion
export { getDiscordLoginUrl as n, exchangeDiscordCodeDirect as t };
