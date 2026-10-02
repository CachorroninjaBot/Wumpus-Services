import { t as isPlatformOwner } from "./owner-GgaIkPvQ.mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./createSsrRpc-C1p7zOu_.mjs";
import { a as planById, c as serverLimit } from "./catalog-Bwk5qXYL.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { i as verifySession, n as sessionSecret, r as signSession } from "./session-token-DcjIUwvY.mjs";
import { t as exchangeDiscordCodeDirect } from "./oauth-BRux7pAC.mjs";
import { n as loadBilling } from "./shardpay-eAlUbe5F.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-BIVzXnjV.js
/**
* Em quais servidores o BOT esta de fato.
*
* Faltava esta pergunta. O OAuth devolve os servidores onde a PESSOA e admin,
* nao onde o Wumpus foi instalado — por isso servidor sem o bot aparecia no
* painel e "configurava" coisa que ninguem ia ler.
*
* Consulta a API do Discord com o token do bot (que fica no servidor, nunca no
* cliente). O resultado e cacheado porque a lista muda raramente e isto roda a
* cada carregamento de painel.
*/
async function loadBotGuildIds() {
	const token = process.env.DISCORD_TOKEN || process.env.WUMPUS_DISCORD_TOKEN;
	if (!token) return [];
	const res = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
		headers: { Authorization: `Bot ${token}` },
		signal: AbortSignal.timeout(1e4)
	});
	if (!res.ok) return [];
	const rows = await res.json();
	if (!Array.isArray(rows)) return [];
	return rows.map((row) => row.id).filter((id) => typeof id === "string");
}
createServerFn({ method: "GET" }).handler(createSsrRpc("dc9ef2fc7350036c4a530873848b60e4bfcf8f2fc3510a0a73f5b56239ba0070"));
/**
* Direitos de acesso — quem pode ver o que.
*
* Antes disto o painel nao checava NADA:
*   - `owner-workspace.ts` marcava `isAdmin: true` para todo mundo que logava;
*   - o plano era `"pro"` fixo, entao todo servidor vinha liberado;
*   - `installed: true` fixo, entao servidor sem o bot aparecia igual;
*   - as licencas vinham todas `"active"`.
*
* REGRA ATUAL (por pedido explicito do dono do produto): o painel e de uso
* EXCLUSIVO de quem responde pelo servidor. Na pratica:
*
*   1. a pessoa precisa ser DONA do servidor no Discord (`owner: true`);
*   2. o Wumpus precisa estar instalado naquele servidor;
*   3. ela precisa ter assinatura ativa que cubra aquele servidor.
*
* Ser administrador NAO basta, e ser staff/membro nao da acesso nenhum. Isso e
* proposital: a equipe enxerga o resultado do trabalho no Discord (tickets,
* logs, punicoes), nunca o painel de configuracao — que fica com quem contratou.
*
* As funcoes aqui sao puras de proposito: da para testar cada regra sem rede.
*/
/**
* Status que dao direito de uso.
*
* `past_due` e `canceled` ficam DE FORA de proposito: assinatura com pagamento
* falhando nao deve manter o painel liberado indefinidamente.
*/
var ENTITLED_STATUS = /* @__PURE__ */ new Set([
	"active",
	"trialing",
	"paid",
	"authorized",
	"succeeded"
]);
/** Ordem de grandeza para escolher o melhor plano quando ha mais de um. */
var PLAN_WEIGHT = {
	essencial: 1,
	pro: 2,
	escala: 3,
	vitalicio: 4
};
function normalizeUsername(value) {
	return (value ?? "").trim().toLowerCase().replace(/^@/, "");
}
/**
* A assinatura pertence a esta pessoa?
*
* Casamos por id quando a ShardPay mandar, e por nome de usuario como reserva —
* o nome e o que a API expoe hoje (`discord_username`).
*/
function belongsTo(sub, userId, username) {
	if (sub.discordUserId && sub.discordUserId === userId) return true;
	const a = normalizeUsername(sub.discordUsername);
	const b = normalizeUsername(username);
	return Boolean(a) && a === b;
}
/**
* O melhor plano ATIVO desta pessoa, ou `null` se ela nao tem assinatura valida.
* Devolve o mais alto quando ha mais de um (quem assina Pro e Escala nao perde).
*/
function planForUser(subscriptions, userId, username) {
	const active = subscriptions.filter((sub) => sub.planId && ENTITLED_STATUS.has(sub.status.toLowerCase()) && belongsTo(sub, userId, username));
	if (!active.length) return null;
	const best = active.reduce((winner, sub) => PLAN_WEIGHT[sub.planId] > PLAN_WEIGHT[winner.planId] ? sub : winner);
	return {
		plan: best.planId,
		status: best.status
	};
}
/**
* Resolve tudo de uma vez.
*
* Regras:
*   1. O dono da plataforma passa por cima de tudo (acesso total, sem limite).
*   2. Sem assinatura ativa: nenhum servidor, e o motivo fica explicito para a
*      interface poder dizer POR QUE a tela esta vazia.
*   3. Servidor so entra se o BOT ESTIVER NELE e a pessoa for DONA — os dois.
*   4. O limite do plano corta o excedente; nao escondemos em silencio, o que
*      sobra vai em `overLimitGuildIds` para a interface avisar.
*/
function resolveEntitlements(input) {
	const isOwner = isPlatformOwner(input.discordUserId);
	const bot = new Set(input.botGuildIds);
	const eligible = input.ownedGuildIds.filter((id) => bot.has(id));
	if (isOwner) return {
		isOwner: true,
		plan: "escala",
		planName: planById("escala").name,
		guildIds: eligible,
		overLimitGuildIds: [],
		limit: null,
		reason: "owner"
	};
	const sub = planForUser(input.subscriptions, input.discordUserId, input.discordUsername);
	if (!sub) return {
		isOwner: false,
		plan: null,
		planName: null,
		guildIds: [],
		overLimitGuildIds: [],
		limit: null,
		reason: "no-subscription"
	};
	const limit = serverLimit(sub.plan);
	const allowed = limit === null ? eligible : eligible.slice(0, limit);
	const overLimit = limit === null ? [] : eligible.slice(limit);
	return {
		isOwner: false,
		plan: sub.plan,
		planName: planById(sub.plan).name,
		guildIds: allowed,
		overLimitGuildIds: overLimit,
		limit,
		reason: "subscribed"
	};
}
/**
* Sessao de servidor — onde a decisao de acesso realmente acontece.
*
* Antes disto, o painel montava tudo no cliente: o `userId`, o plano e a lista
* de servidores vinham do localStorage, entao editar o campo `id` para o do
* dono bastava para entrar na area restrita.
*
* Agora:
*   1. `startSession` troca o `code` do Discord e ASSINA a identidade. O
*      `userId` dentro do token veio do Discord — o navegador nao escolhe.
*   2. `resolveAccess` verifica a assinatura e recalcula os direitos a CADA
*      chamada: presenca do bot e assinatura ativa sao relidas do servidor.
*
* Isso importa porque plano vence e bot sai de servidor. Se o direito fosse
* gravado no token, um plano cancelado continuaria valendo ate o token expirar.
*/
var startSession_createServerFn_handler = createServerRpc({
	id: "a024cd76e8fb329ddfcdb1c38889490faa45e6108c073941bd702ae77c295ec9",
	name: "startSession",
	filename: "src/lib/wumpus/session.ts"
}, (opts) => startSession.__executeServer(opts));
var startSession = createServerFn({ method: "POST" }).validator((input) => input).handler(startSession_createServerFn_handler, async ({ data }) => {
	const secret = sessionSecret();
	if (!secret) return {
		ok: false,
		error: "Segredo de sessão ausente no servidor."
	};
	const exchanged = await exchangeDiscordCodeDirect(data.code);
	if (!exchanged.ok) return {
		ok: false,
		error: exchanged.error
	};
	const payload = {
		userId: exchanged.user.id,
		username: exchanged.user.username,
		globalName: exchanged.user.globalName,
		avatar: exchanged.user.avatar ?? null,
		guilds: exchanged.guilds.map((guild) => ({
			id: guild.id,
			name: guild.name,
			iconUrl: guild.iconUrl ?? null,
			owner: guild.owner
		}))
	};
	return {
		ok: true,
		token: await signSession(payload, secret)
	};
});
var resolveAccess_createServerFn_handler = createServerRpc({
	id: "e23c83f0285558e3636ed3183139e0c2c2047f6b3edfcabceda3510897a0ba57",
	name: "resolveAccess",
	filename: "src/lib/wumpus/session.ts"
}, (opts) => resolveAccess.__executeServer(opts));
var resolveAccess = createServerFn({ method: "POST" }).validator((input) => input).handler(resolveAccess_createServerFn_handler, async ({ data }) => {
	const secret = sessionSecret();
	if (!secret) return {
		ok: false,
		error: "Segredo de sessão ausente no servidor."
	};
	const payload = await verifySession(data.token, secret);
	if (!payload) return {
		ok: false,
		error: "Sessão inválida ou expirada. Entre de novo."
	};
	const [botGuildIds, billing] = await Promise.all([loadBotGuildIds().catch(() => []), loadBilling().catch(() => null)]);
	const subscriptions = (billing?.subscriptions ?? []).map((sub) => ({
		status: sub.status,
		planId: sub.planId,
		discordUsername: sub.discordUsername
	}));
	const entitlements = resolveEntitlements({
		discordUserId: payload.userId,
		discordUsername: payload.username,
		ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
		botGuildIds,
		subscriptions
	});
	return {
		ok: true,
		session: {
			id: payload.userId,
			username: payload.username,
			globalName: payload.globalName,
			avatar: payload.avatar
		},
		guilds: payload.guilds,
		entitlements
	};
});
//#endregion
export { resolveAccess_createServerFn_handler, startSession_createServerFn_handler };
