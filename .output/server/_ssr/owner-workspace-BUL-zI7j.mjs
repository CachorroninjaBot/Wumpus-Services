import { t as defaultsFor } from "./runtime-validation-DKjJ331C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/owner-workspace-BUL-zI7j.js
/**
* Monta o workspace de quem entrou com Discord.
*
* O que este arquivo fazia de errado, e que deixava o painel sem qualquer
* checagem:
*   - `isAdmin: true` para todo mundo → qualquer login virava admin;
*   - `plan: "pro"` fixo → todo servidor vinha com o plano pago liberado;
*   - `installed: true` fixo → servidor sem o bot aparecia como instalado;
*   - licencas todas `"active"` → nada refletia assinatura real.
*
* Agora quem decide e `resolveEntitlements`, e aqui so montamos o estado a
* partir dessa decisao. Se a pessoa nao tem assinatura ativa, ela entra com a
* lista de servidores VAZIA — nao com tudo liberado.
*/
var MODULES = [
	"servers",
	"tickets",
	"forms",
	"moderation",
	"automod",
	"security",
	"logs",
	"staff",
	"knowledge",
	"statistics",
	"roles"
];
function emptyModules() {
	const out = {};
	for (const key of MODULES) out[key] = {
		enabled: true,
		config: defaultsFor(key)
	};
	return out;
}
function buildWorkspace(user, guilds, entitlements) {
	const allowed = new Set(entitlements.guildIds);
	const entitled = guilds.filter((g) => allowed.has(g.id));
	const plan = entitlements.plan ?? "essencial";
	const list = entitled.map((g) => ({
		id: g.id,
		name: g.name,
		tag: g.name.slice(0, 2).toUpperCase(),
		memberCount: 0,
		online: 0,
		plan,
		preset: "community",
		installed: true,
		region: "Discord",
		iconUrl: g.iconUrl ?? null
	}));
	const modules = {};
	const channels = {};
	const roles = {};
	const formQuestions = {};
	for (const g of list) {
		modules[g.id] = emptyModules();
		channels[g.id] = [];
		roles[g.id] = [{
			id: `owner-${g.id}`,
			name: "Dono",
			color: "#f5d76e",
			position: 50,
			staff: true
		}];
		formQuestions[g.id] = [
			{
				id: "q1",
				label: "Qual o seu nome ou apelido?",
				required: true
			},
			{
				id: "q2",
				label: "Por que quer fazer parte da equipe?",
				required: true
			},
			{
				id: "q3",
				label: "Qual a sua experiência relevante?",
				required: true
			}
		];
	}
	const sessionUser = {
		id: user.id,
		username: user.username,
		globalName: user.globalName,
		isAdmin: entitlements.isOwner,
		signedIn: true,
		avatar: user.avatar ?? null
	};
	const licenses = list.map((g) => ({
		id: `lic-${g.id}`,
		guildName: g.name,
		plan,
		seats: 5,
		expires: "—",
		status: "active"
	}));
	const first = list[0];
	return {
		activeGuildId: first?.id ?? "",
		guilds: list,
		members: first ? [{
			id: user.id,
			guildId: first.id,
			username: user.username,
			displayName: user.globalName,
			hue: 262,
			roleIds: [`owner-${first.id}`],
			joinedAt: Date.now(),
			strikes: 0,
			status: "online",
			accountCreatedAt: Date.now(),
			timedOutUntil: null,
			banned: false
		}] : [],
		tickets: [],
		formQuestions,
		submissions: [],
		cases: [],
		automodHits: [],
		incidents: [],
		articles: [],
		logs: [{
			id: "l-login",
			guildId: first?.id ?? "",
			at: Date.now(),
			actor: user.globalName,
			category: "auth",
			summary: entitlements.isOwner ? "Entrou com Discord. Acesso de dono da plataforma." : `Entrou com Discord. ${entitlements.planName ?? "Sem assinatura"} · ${list.length} servidor(es).`
		}],
		modules,
		channels,
		roles,
		dashboardMembers: [{
			id: user.id,
			username: user.username,
			role: "owner",
			addedAt: Date.now()
		}],
		licenses,
		posts: [],
		publishQueue: [],
		recentMessages: [],
		sessionUser,
		theme: "system"
	};
}
//#endregion
export { buildWorkspace as t };
