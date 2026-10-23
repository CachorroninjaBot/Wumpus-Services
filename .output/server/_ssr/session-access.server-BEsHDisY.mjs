import { a as checkoutUrl, d as planIdFromName, f as plans, g as verifySession, i as SHARD_STORE, l as planAllows, m as sessionSecret, p as serverLimit, t as CYCLE_DISCOUNTS, u as planById } from "./session-token-CaBlZnli.mjs";
import { a as number, c as string, n as array, o as object, r as boolean, t as _enum } from "../_libs/zod.mjs";
import { n as enforceRequestLimit } from "./request-limits.server-D3WMs2Xr.mjs";
import { i as markPrivateResponse, r as getDashboardSessionCookie } from "./session-cookie.server-D0OzyQJ-.mjs";
import { n as readBotHealth } from "./health.server-CEYWHLwq.mjs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/session-access.server-BEsHDisY.js
var memberSchema = object({
	id: string().regex(/^\d{17,20}$/),
	username: string().min(1).max(100),
	firstSeenAt: number().finite(),
	lastSeenAt: number().finite(),
	loginCount: number().int().nonnegative().default(1),
	suspended: boolean().default(false),
	suspensionReason: string().max(300).nullable().default(null),
	notes: string().max(2e3).default("")
}).strict();
var sessionSchema = object({
	id: string().uuid(),
	userId: string().regex(/^\d{17,20}$/),
	username: string().min(1).max(100),
	guilds: array(object({
		id: string().regex(/^\d{17,20}$/),
		name: string().max(100),
		iconUrl: string().max(300).nullable(),
		owner: boolean()
	}).strict()).default([]),
	startedAt: number().finite(),
	lastSeenAt: number().finite(),
	endedAt: number().finite().nullable(),
	revokedAt: number().finite().nullable()
}).strict();
var eventSchema = object({
	id: string().uuid(),
	at: number().finite(),
	actorId: string().regex(/^\d{17,20}$/),
	action: string().min(1).max(40),
	targetId: string().min(1).max(64),
	summary: string().min(1).max(500)
}).strict();
var grantSchema = object({
	id: string().uuid(),
	userId: string().regex(/^\d{17,20}$/),
	username: string().min(1).max(100),
	planId: _enum([
		"essencial",
		"pro",
		"escala",
		"vitalicio"
	]),
	createdAt: number().finite(),
	expiresAt: number().finite(),
	createdBy: string().regex(/^\d{17,20}$/),
	reason: string().min(1).max(500),
	revokedAt: number().finite().nullable()
}).strict();
var writes = Promise.resolve();
var cache = null;
var CACHE_MS = 2e3;
var SESSION_IDLE_TIMEOUT_MS = 12096e5;
var SESSION_ABSOLUTE_TIMEOUT_MS = 2592e6;
function storePath() {
	return process.env.WUMPUS_MEMBERS_PATH || join(process.cwd(), "data", "wumpus-dashboard-members.json");
}
function emptyState() {
	return {
		members: [],
		sessions: [],
		events: [],
		grants: []
	};
}
function parseState(value) {
	if (Array.isArray(value)) {
		const members = array(memberSchema).safeParse(value.map((row) => ({
			...row,
			loginCount: 1,
			suspended: false,
			suspensionReason: null,
			notes: ""
		})));
		if (!members.success) throw new Error("O cadastro de membros da dashboard está inválido.");
		return {
			...emptyState(),
			members: members.data
		};
	}
	const parsed = object({
		members: array(memberSchema),
		sessions: array(sessionSchema),
		events: array(eventSchema),
		grants: array(grantSchema).default([])
	}).strict().safeParse(value);
	if (!parsed.success) throw new Error("O cadastro administrativo da dashboard está inválido.");
	return parsed.data;
}
async function readState(force = false) {
	if (!force && cache && Date.now() - cache.at < CACHE_MS) return structuredClone(cache.state);
	try {
		const state = parseState(JSON.parse(await readFile(storePath(), "utf8")));
		cache = {
			state,
			at: Date.now()
		};
		return structuredClone(state);
	} catch (error) {
		if (error.code === "ENOENT") return emptyState();
		throw error;
	}
}
async function persist(state) {
	const path = storePath();
	await mkdir(dirname(path), {
		recursive: true,
		mode: 448
	});
	const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
	await writeFile(temp, JSON.stringify(state, null, 2), { mode: 384 });
	try {
		await rename(temp, path);
	} catch (error) {
		const code = error.code;
		if (code !== "EPERM" && code !== "EEXIST" && code !== "EACCES") throw error;
		await rm(path, { force: true });
		await rename(temp, path);
	} finally {
		await rm(temp, { force: true });
	}
	cache = {
		state: structuredClone(state),
		at: Date.now()
	};
}
async function mutateState(fn) {
	const next = writes.then(async () => {
		const state = await readState(true);
		const result = fn(state);
		await persist(state);
		return result;
	});
	writes = next.catch(() => void 0);
	return next;
}
function addEvent(state, actorId, action, targetId, summary) {
	state.events.unshift({
		id: randomUUID(),
		at: Date.now(),
		actorId,
		action,
		targetId,
		summary
	});
	state.events.length = Math.min(state.events.length, 1e3);
}
async function recordDashboardLogin(member, sessionId, guilds) {
	const safeMember = memberSchema.pick({
		id: true,
		username: true
	}).parse(member);
	const safeSessionId = string().uuid().parse(sessionId);
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
				notes: ""
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
			revokedAt: null
		});
		state.sessions.length = Math.min(state.sessions.length, 5e3);
	});
}
async function getDashboardSessionGuilds(sessionId, userId) {
	const session = (await readState()).sessions.find((row) => row.id === sessionId && row.userId === userId);
	return session ? structuredClone(session.guilds) : null;
}
async function recordDashboardActivity(sessionId) {
	const safeId = string().uuid().parse(sessionId);
	await mutateState((state) => {
		const session = state.sessions.find((row) => row.id === safeId);
		if (!session || session.endedAt || session.revokedAt) return;
		const now = Date.now();
		if (now - session.lastSeenAt < 3e4) return;
		session.lastSeenAt = now;
		const member = state.members.find((row) => row.id === session.userId);
		if (member) member.lastSeenAt = now;
	});
}
async function closeDashboardSession(sessionId, revoked = false) {
	const safeId = string().uuid().parse(sessionId);
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
async function dashboardSessionIsUsable(sessionId, userId) {
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
async function isDashboardAccountSuspended(userId) {
	const state = await readState();
	return Boolean(state.members.find((row) => row.id === userId)?.suspended);
}
async function getDashboardAdminState() {
	return readState();
}
async function manageDashboardUser(input) {
	const data = object({
		actorId: string().regex(/^\d{17,20}$/),
		userId: string().regex(/^\d{17,20}$/),
		action: _enum([
			"suspend",
			"restore",
			"revoke-sessions",
			"save-notes"
		]),
		reason: string().trim().max(300).optional(),
		notes: string().max(2e3).optional()
	}).strict().parse(input);
	if (data.actorId === data.userId) throw new Error("A administração não pode alterar a própria conta.");
	await mutateState((state) => {
		const member = state.members.find((row) => row.id === data.userId);
		if (!member) throw new Error("Esta conta ainda não apareceu nos acessos registrados.");
		const now = Date.now();
		if (data.action === "suspend") {
			member.suspended = true;
			member.suspensionReason = data.reason || "Acesso suspenso pelo administrador.";
			for (const session of state.sessions) if (session.userId === data.userId && !session.endedAt) {
				session.endedAt = now;
				session.revokedAt = now;
				session.guilds = [];
			}
			addEvent(state, data.actorId, data.action, data.userId, `Conta suspensa. ${member.suspensionReason}`);
		} else if (data.action === "restore") {
			member.suspended = false;
			member.suspensionReason = null;
			addEvent(state, data.actorId, data.action, data.userId, "Acesso da conta restaurado.");
		} else if (data.action === "revoke-sessions") {
			for (const session of state.sessions) if (session.userId === data.userId && !session.endedAt) {
				session.endedAt = now;
				session.revokedAt = now;
				session.guilds = [];
			}
			addEvent(state, data.actorId, data.action, data.userId, "Sessões ativas revogadas.");
		} else {
			member.notes = data.notes ?? "";
			addEvent(state, data.actorId, data.action, data.userId, "Nota administrativa atualizada.");
		}
	});
}
async function recordDashboardAdminEvent(input) {
	const safe = object({
		actorId: string().regex(/^\d{17,20}$/),
		action: string().min(1).max(40),
		targetId: string().min(1).max(64),
		summary: string().min(1).max(500)
	}).strict().parse(input);
	await mutateState((state) => addEvent(state, safe.actorId, safe.action, safe.targetId, safe.summary));
}
async function grantDashboardAccess(input) {
	const data = object({
		actorId: string().regex(/^\d{17,20}$/),
		userId: string().regex(/^\d{17,20}$/),
		username: string().trim().min(1).max(100),
		planId: _enum([
			"essencial",
			"pro",
			"escala"
		]),
		durationDays: number().int().min(1).max(3650),
		reason: string().trim().min(3).max(500)
	}).strict().parse(input);
	if (data.actorId === data.userId) throw new Error("A administração não pode alterar a própria conta por esta ação.");
	return mutateState((state) => {
		const now = Date.now();
		const current = state.grants.find((grant) => grant.userId === data.userId && !grant.revokedAt && grant.expiresAt > now);
		if (current) {
			current.revokedAt = now;
			addEvent(state, data.actorId, "grant-replaced", data.userId, `Concessão anterior encerrada para substituir o acesso manual.`);
		}
		const member = state.members.find((row) => row.id === data.userId);
		if (member?.suspended) throw new Error("Restaure a conta antes de conceder acesso.");
		const grant = {
			id: randomUUID(),
			userId: data.userId,
			username: member?.username ?? data.username,
			planId: data.planId,
			createdAt: now,
			expiresAt: now + data.durationDays * 24 * 60 * 6e4,
			createdBy: data.actorId,
			reason: data.reason,
			revokedAt: null
		};
		state.grants.unshift(grant);
		state.grants.length = Math.min(state.grants.length, 2e3);
		addEvent(state, data.actorId, "grant-access", data.userId, `Acesso manual ${data.planId} concedido por ${data.durationDays} dia(s). Motivo: ${data.reason.slice(0, 350)}`);
		return grant;
	});
}
async function revokeDashboardGrant(input) {
	const data = object({
		actorId: string().regex(/^\d{17,20}$/),
		grantId: string().uuid()
	}).strict().parse(input);
	await mutateState((state) => {
		const grant = state.grants.find((row) => row.id === data.grantId);
		if (!grant) throw new Error("A concessão manual não foi encontrada.");
		if (grant.revokedAt) return;
		grant.revokedAt = Date.now();
		addEvent(state, data.actorId, "revoke-grant", grant.userId, `Acesso manual ${grant.planId} revogado.`);
	});
}
async function listDashboardGrants() {
	return (await readState()).grants;
}
/**
* Em quais servidores o BOT esta de fato.
*
* Faltava esta pergunta. O OAuth devolve os servidores onde a PESSOA e admin,
* nao onde o Wumpus foi instalado — por isso servidor sem o bot aparecia no
* painel e "configurava" coisa que ninguem ia ler.
*
* A lista e publicada pelo processo do bot no arquivo compartilhado de saúde.
* O token do bot não oferece uma lista de guildas por essa rota OAuth: ela
* exige um token de usuário com o escopo `guilds`.
*/
async function loadBotGuildIds() {
	const health = await readBotHealth();
	if (!health || health.status !== "online" || Date.now() - health.at > 9e4) return [];
	return health.guildIds;
}
/** Fallback legado; em produção, configure WUMPUS_OWNER_ID. */
var OWNER_DISCORD_ID = "928871447940710480";
/**
* Lê o dono no servidor sem incluir valores de ambiente no bundle do cliente.
* O nome minúsculo continua aceito para instalações que já o configuraram.
*/
function configuredOwnerIds() {
	const env = globalThis.process?.env;
	const raw = [env?.WUMPUS_OWNER_ID, env?.wumpus_owner_id].find((value) => Boolean(value?.trim()))?.trim();
	if (!raw) return null;
	return raw.split(/[\s,;]+/).map((value) => value.trim()).filter((value) => /^\d{17,20}$/.test(value));
}
function isPlatformOwner(id) {
	if (!id) return false;
	const configured = configuredOwnerIds();
	return configured ? configured.includes(id) : id === OWNER_DISCORD_ID;
}
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
/** IDs de compradores Vitalício verificados manualmente no painel da loja. */
function configuredLifetimeSubscriptions(value = process.env.WUMPUS_LIFETIME_DISCORD_IDS) {
	const ids = (value ?? "").split(/[\s,;]+/).filter((id) => /^\d{17,20}$/.test(id));
	return [...new Set(ids)].map((discordUserId) => ({
		status: "active",
		planId: "vitalicio",
		discordUsername: null,
		discordUserId
	}));
}
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
	const active = subscriptions.filter((sub) => sub.planId && ENTITLED_STATUS.has(sub.status.toLowerCase()) && (sub.expiresAt == null || sub.expiresAt > Date.now()) && belongsTo(sub, userId, username));
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
	const ownerEligible = (input.manageableGuildIds ?? input.ownedGuildIds).filter((id) => bot.has(id));
	if (isOwner) return {
		isOwner: true,
		plan: "escala",
		planName: planById("escala").name,
		guildIds: ownerEligible,
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
var ENDPOINT = "https://shardpay.app/api/mcp";
async function apiKey() {
	return process.env.SHARDPAY_API_KEY?.trim() ?? "";
}
function brl(cents, recurring) {
	const value = (cents / 100).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL"
	});
	return recurring ? `${value}/mês` : value;
}
function dateString(value) {
	const milliseconds = typeof value === "number" ? value < 1e10 ? value * 1e3 : value : typeof value === "string" && value.trim() ? Date.parse(value) : NaN;
	return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : void 0;
}
async function mcpCall(key, session, body) {
	const headers = {
		Authorization: `Bearer ${key}`,
		"Content-Type": "application/json",
		Accept: "application/json, text/event-stream"
	};
	if (session) headers["mcp-session-id"] = session;
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(12e3)
	});
	const next = res.headers.get("mcp-session-id") ?? session;
	if (!res.ok && res.status !== 202) throw new Error(`ShardPay respondeu ${res.status}.`);
	const text = await res.text();
	const json = text ? JSON.parse(text) : null;
	if (json?.error) throw new Error(json.error.message || "Erro na ShardPay.");
	return {
		session: next,
		json
	};
}
function structured(result) {
	if (!result || typeof result !== "object") return null;
	const row = result;
	if (row.structuredContent !== void 0) return row.structuredContent;
	const text = row.content?.[0]?.text;
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
function offline() {
	return {
		ok: false,
		error: "ShardPay indisponível. Mostrando a vitrine WumPlus salva.",
		storeName: SHARD_STORE.name,
		storeUrl: SHARD_STORE.url,
		plans,
		subscriptions: [],
		discounts: CYCLE_DISCOUNTS.map((c) => ({
			label: c.label,
			discount: c.discount
		}))
	};
}
/**
* Le assinaturas e planos da ShardPay. Funcao plana para que o handler de
* sessao possa chamar sem aninhar `createServerFn`.
*/
async function loadBilling() {
	const key = await apiKey();
	if (!key) return {
		...offline(),
		error: "Chave da ShardPay não configurada neste ambiente."
	};
	try {
		let { session } = await mcpCall(key, null, {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-03-26",
				capabilities: {},
				clientInfo: {
					name: "wumpus",
					version: "2.0.0"
				}
			}
		});
		await mcpCall(key, session, {
			jsonrpc: "2.0",
			method: "notifications/initialized"
		});
		const call = async (name, args, id) => {
			const next = await mcpCall(key, session, {
				jsonrpc: "2.0",
				id,
				method: "tools/call",
				params: {
					name,
					arguments: args
				}
			});
			session = next.session;
			return structured(next.json?.result);
		};
		const productsRaw = await call("list_products", { store_id: SHARD_STORE.id }, 2);
		const plansRaw = await call("list_recurring_plans", { store_id: SHARD_STORE.id }, 3);
		const subsRaw = await call("list_recurring_subscriptions", { store_id: SHARD_STORE.id }, 4);
		const products = Array.isArray(productsRaw?.products) ? productsRaw.products : [];
		const live = /* @__PURE__ */ new Map();
		for (const product of products) {
			const name = typeof product.name === "string" ? product.name : "";
			const id = planIdFromName(name);
			if (!id || typeof product.id !== "string") continue;
			const cents = typeof product.price_cents === "number" ? product.price_cents : 0;
			const base = plans.find((p) => p.id === id);
			const recurring = Boolean(product.recurring_plan_id) || id !== "vitalicio";
			live.set(id, {
				id,
				productId: product.id,
				name: base?.name ?? name,
				priceCents: cents,
				recurring,
				price: brl(cents, recurring),
				blurb: base?.blurb ?? "",
				features: base?.features ?? [],
				highlight: base?.highlight,
				checkoutUrl: checkoutUrl(product.id)
			});
		}
		const merged = plans.map((plan) => live.get(plan.id) ?? plan);
		const cycles = Array.isArray(plansRaw) ? plansRaw : [];
		const discounts = CYCLE_DISCOUNTS.map((cycle) => {
			const found = cycles.flatMap((p) => p.cycles ?? []).find((c) => c.billing_cycle === cycle.id);
			return {
				label: cycle.label,
				discount: found?.discount_percentage ?? cycle.discount
			};
		});
		const subscriptions = (subsRaw?.subscriptions ?? []).map((sub) => {
			const productName = (sub.product ?? {}).name ?? "Plano";
			return {
				id: String(sub.id ?? ""),
				status: String(sub.status ?? ""),
				productName,
				planId: planIdFromName(productName),
				discordUsername: typeof sub.discord_username === "string" ? sub.discord_username : null,
				discordUserId: typeof sub.discord_user_id === "string" ? sub.discord_user_id : typeof sub.discordUserId === "string" ? sub.discordUserId : null,
				billingCycle: String(sub.billing_cycle ?? ""),
				nextBillingDate: String(sub.next_billing_date ?? ""),
				startedAt: dateString(sub.started_at ?? sub.start_date ?? sub.created_at ?? sub.createdAt),
				periodEndsAt: dateString(sub.current_period_end ?? sub.period_ends_at ?? sub.ends_at ?? sub.end_date),
				canceledAt: dateString(sub.canceled_at ?? sub.cancelled_at),
				priceCents: typeof sub.price_cents === "number" ? sub.price_cents : 0
			};
		});
		return {
			ok: true,
			storeName: SHARD_STORE.name,
			storeUrl: SHARD_STORE.url,
			plans: merged,
			subscriptions,
			discounts
		};
	} catch (error) {
		return {
			...offline(),
			error: error instanceof Error ? error.message : "Falha ao falar com a ShardPay."
		};
	}
}
var guildAccessCache = null;
/** Lê identidade apenas do cookie assinado e confere a sessão revogável no servidor. */
async function verifySignedSession(_legacyToken) {
	const secret = sessionSecret();
	if (!secret) throw new Error("A configuração segura de sessão está incompleta.");
	markPrivateResponse();
	const payload = await verifySession(getDashboardSessionCookie() ?? "", secret);
	if (!payload || !await dashboardSessionIsUsable(payload.sessionId, payload.userId)) throw new Error("Sessão inválida, encerrada ou revogada. Entre novamente.");
	await recordDashboardActivity(payload.sessionId);
	const guilds = await getDashboardSessionGuilds(payload.sessionId, payload.userId);
	return guilds?.length ? {
		...payload,
		guilds
	} : payload;
}
async function requireAdminSession(token) {
	const payload = await verifySignedSession(token);
	if (!isPlatformOwner(payload.userId)) throw new Error("Acesso restrito ao dono da plataforma.");
	if (!payload.mfaEnabled) throw new Error("Ative a autenticação de dois fatores na conta Discord autorizada e entre novamente.");
	return payload;
}
function subscriptionsFor(billing) {
	return [...billing.subscriptions.map((subscription) => ({
		status: subscription.status,
		planId: subscription.planId,
		discordUsername: subscription.discordUsername,
		discordUserId: subscription.discordUserId
	})), ...configuredLifetimeSubscriptions()];
}
async function loadManualSubscriptionRows() {
	const now = Date.now();
	return (await listDashboardGrants()).filter((grant) => !grant.revokedAt && grant.expiresAt > now).map((grant) => ({
		status: "active",
		planId: grant.planId,
		discordUsername: grant.username,
		discordUserId: grant.userId,
		expiresAt: grant.expiresAt
	}));
}
async function requireGuildAccess(token, guildId) {
	const payload = await verifySignedSession(token);
	enforceRequestLimit("guild-api", 300, 6e4, payload.userId);
	const canManageGuild = payload.guilds.some((guild) => guild.id === guildId && guild.owner);
	const platformOwnerCanManageGuild = isPlatformOwner(payload.userId) && payload.guilds.some((guild) => guild.id === guildId);
	if (!canManageGuild && !platformOwnerCanManageGuild) throw new Error("Você não administra este servidor no Discord.");
	if (!guildAccessCache || guildAccessCache.userId !== payload.userId || guildAccessCache.expiresAt < Date.now()) {
		const [botGuildIds, billing, manualSubscriptions] = await Promise.all([
			loadBotGuildIds(),
			loadBilling(),
			loadManualSubscriptionRows()
		]);
		const entitlements = resolveEntitlements({
			discordUserId: payload.userId,
			discordUsername: payload.username,
			ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
			manageableGuildIds: payload.guilds.map((guild) => guild.id),
			botGuildIds,
			subscriptions: [...subscriptionsFor(billing), ...manualSubscriptions]
		});
		guildAccessCache = {
			userId: payload.userId,
			guildIds: new Set(entitlements.guildIds),
			entitlements,
			expiresAt: Date.now() + 3e4
		};
	}
	if (!guildAccessCache.guildIds.has(guildId) && !isPlatformOwner(payload.userId)) throw new Error("Este servidor não está incluído na sua assinatura ou o Wumpus não está instalado.");
	if (!guildAccessCache.guildIds.has(guildId)) throw new Error("O Wumpus não está instalado neste servidor.");
	return {
		...payload,
		entitlements: guildAccessCache.entitlements
	};
}
/** Valida também as funcionalidades do plano em chamadas diretas à API. */
async function requireGuildFeature(token, guildId, feature) {
	const session = await requireGuildAccess(token, guildId);
	const plan = session.entitlements.plan;
	if (!plan || !planAllows(plan, feature)) throw new Error(`Seu plano não inclui ${{
		forms: "formulários",
		ai: "recursos de IA",
		multiDepartment: "múltiplos departamentos",
		antiNuke: "anti-nuke",
		transcripts: "transcrições",
		ocr: "OCR",
		webhooks: "webhooks"
	}[feature]}. Faça upgrade para continuar.`);
	return session;
}
//#endregion
export { requireGuildFeature as _, isDashboardAccountSuspended as a, verifySignedSession as b, loadBilling as c, manageDashboardUser as d, recordDashboardActivity as f, requireGuildAccess as g, requireAdminSession as h, grantDashboardAccess as i, loadBotGuildIds as l, recordDashboardLogin as m, configuredLifetimeSubscriptions as n, isPlatformOwner as o, recordDashboardAdminEvent as p, getDashboardAdminState as r, listDashboardGrants as s, closeDashboardSession as t, loadManualSubscriptionRows as u, resolveEntitlements as v, revokeDashboardGrant as y };
