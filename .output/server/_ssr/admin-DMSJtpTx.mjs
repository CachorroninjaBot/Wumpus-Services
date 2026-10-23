import { d as setResponseHeaders, r as createServerFn } from "./ssr.mjs";
import { n as enforceRequestLimit, t as createServerRpc } from "./request-limits.server-D3WMs2Xr.mjs";
import { n as readBotHealth } from "./health.server-CEYWHLwq.mjs";
import { m as sessionSecret, r as SESSION_TOKEN_MAX_LENGTH } from "./session-token-CaBlZnli.mjs";
import { a as number, c as string, o as object, t as _enum } from "../_libs/zod.mjs";
import { c as loadBilling, d as manageDashboardUser, h as requireAdminSession, i as grantDashboardAccess, l as loadBotGuildIds, p as recordDashboardAdminEvent, r as getDashboardAdminState, y as revokeDashboardGrant } from "./session-access.server-BEsHDisY.mjs";
import { r as readRuntime, t as enqueueOutbox } from "./runtime.server-DWU5ehgX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-DMSJtpTx.js
var tokenSchema = object({ token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH) }).strict();
var resyncSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict();
var userActionSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	userId: string().regex(/^\d{17,20}$/),
	action: _enum([
		"suspend",
		"restore",
		"revoke-sessions",
		"save-notes"
	]),
	reason: string().trim().max(300).optional(),
	notes: string().max(2e3).optional()
}).strict();
var grantSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	userId: string().regex(/^\d{17,20}$/),
	username: string().trim().min(1).max(100),
	planId: _enum([
		"essencial",
		"pro",
		"escala"
	]),
	durationDays: number().int().min(1).max(3650),
	reason: string().trim().min(3).max(500)
}).strict();
var revokeGrantSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	grantId: string().uuid()
}).strict();
function privateResponse() {
	setResponseHeaders(new Headers({
		"Cache-Control": "private, no-store",
		Vary: "Cookie"
	}));
}
var getAdminOverview_createServerFn_handler = createServerRpc({
	id: "204c6d0dc498913bd12eb3699ddf923772258e293049e5fa66d53e02bee5510f",
	name: "getAdminOverview",
	filename: "src/lib/wumpus/admin.ts"
}, (opts) => getAdminOverview.__executeServer(opts));
var getAdminOverview = createServerFn({ method: "POST" }).validator((input) => tokenSchema.parse(input)).handler(getAdminOverview_createServerFn_handler, async ({ data }) => {
	enforceRequestLimit("admin-overview", 60, 6e4);
	const actor = await requireAdminSession(data.token);
	privateResponse();
	const [admin, billing, botGuildIds, runtime, health] = await Promise.all([
		getDashboardAdminState(),
		loadBilling(),
		loadBotGuildIds(),
		readRuntime(),
		readBotHealth()
	]);
	const guilds = botGuildIds.map((id) => {
		const config = runtime.guilds[id];
		return {
			id,
			name: config?.name ?? id,
			hasTicketsPanel: Boolean(config?.tickets?.panelChannelId),
			hasFormsPanel: Boolean(config?.forms?.panelChannelId)
		};
	});
	return {
		ok: true,
		adminId: actor.userId,
		members: admin.members,
		sessions: admin.sessions,
		events: admin.events,
		subscriptions: [...billing.subscriptions.map((subscription) => ({
			id: subscription.id,
			username: subscription.discordUsername ?? "Conta sem nome Discord",
			discordUserId: subscription.discordUserId,
			productName: subscription.productName,
			status: subscription.status,
			billingCycle: subscription.billingCycle,
			nextBillingDate: subscription.nextBillingDate,
			startedAt: subscription.startedAt ?? null,
			periodEndsAt: subscription.periodEndsAt ?? null,
			canceledAt: subscription.canceledAt ?? null,
			priceCents: subscription.priceCents,
			manual: false,
			reason: null,
			planId: subscription.planId
		})), ...admin.grants.map((grant) => ({
			id: grant.id,
			username: grant.username,
			discordUserId: grant.userId,
			productName: `Concessão manual · ${grant.planId}`,
			status: grant.revokedAt ? "revoked" : grant.expiresAt <= Date.now() ? "expired" : "active",
			billingCycle: `${Math.ceil(Math.max(0, grant.expiresAt - grant.createdAt) / 864e5)} dias concedidos`,
			nextBillingDate: "",
			startedAt: new Date(grant.createdAt).toISOString(),
			periodEndsAt: new Date(grant.expiresAt).toISOString(),
			canceledAt: grant.revokedAt ? new Date(grant.revokedAt).toISOString() : null,
			priceCents: 0,
			manual: true,
			reason: grant.reason,
			planId: grant.planId
		}))],
		billingAvailable: billing.ok,
		billingError: billing.ok ? null : billing.error ?? "ShardPay indisponível.",
		billingStoreUrl: billing.storeUrl,
		guilds,
		health: health && health.status === "online" && Date.now() - health.at <= 9e4 ? {
			status: "online",
			guildCount: health.guildCount,
			lastSeenAt: health.at,
			pingMs: health.pingMs
		} : {
			status: "offline",
			guildCount: health?.guildCount ?? 0,
			lastSeenAt: health?.at ?? null,
			pingMs: health?.pingMs ?? null
		},
		security: {
			sessionSecretConfigured: Boolean(sessionSecret()),
			shardPayKeyConfigured: Boolean(process.env.SHARDPAY_API_KEY?.trim()),
			discordClientSecretConfigured: Boolean(process.env.DISCORD_CLIENT_SECRET?.trim()),
			ownerIdConfigured: Boolean(process.env.WUMPUS_OWNER_ID?.trim())
		}
	};
});
var grantAdminAccess_createServerFn_handler = createServerRpc({
	id: "6e3b4cddbcf99ad6643c7d95b374042c0a891354d1914fe1511e5756ba2d9357",
	name: "grantAdminAccess",
	filename: "src/lib/wumpus/admin.ts"
}, (opts) => grantAdminAccess.__executeServer(opts));
var grantAdminAccess = createServerFn({ method: "POST" }).validator((input) => grantSchema.parse(input)).handler(grantAdminAccess_createServerFn_handler, async ({ data }) => {
	enforceRequestLimit("admin-grant-access", 20, 6e4);
	const actor = await requireAdminSession(data.token);
	const grant = await grantDashboardAccess({
		actorId: actor.userId,
		userId: data.userId,
		username: data.username,
		planId: data.planId,
		durationDays: data.durationDays,
		reason: data.reason
	});
	privateResponse();
	return {
		ok: true,
		expiresAt: grant.expiresAt
	};
});
var revokeAdminGrant_createServerFn_handler = createServerRpc({
	id: "782f207f17185c8a85a3eee61e959861cbd0af9c8d1f46f99261b97a2340a731",
	name: "revokeAdminGrant",
	filename: "src/lib/wumpus/admin.ts"
}, (opts) => revokeAdminGrant.__executeServer(opts));
var revokeAdminGrant = createServerFn({ method: "POST" }).validator((input) => revokeGrantSchema.parse(input)).handler(revokeAdminGrant_createServerFn_handler, async ({ data }) => {
	enforceRequestLimit("admin-revoke-grant", 30, 6e4);
	const actor = await requireAdminSession(data.token);
	await revokeDashboardGrant({
		actorId: actor.userId,
		grantId: data.grantId
	});
	privateResponse();
	return { ok: true };
});
var manageAdminUser_createServerFn_handler = createServerRpc({
	id: "4253c6f610e625fb4ebed05a04c5eedcbc5074c7d3aea9bdf9a7de23a0e152e5",
	name: "manageAdminUser",
	filename: "src/lib/wumpus/admin.ts"
}, (opts) => manageAdminUser.__executeServer(opts));
var manageAdminUser = createServerFn({ method: "POST" }).validator((input) => userActionSchema.parse(input)).handler(manageAdminUser_createServerFn_handler, async ({ data }) => {
	enforceRequestLimit("admin-user-manage", 30, 6e4);
	const actor = await requireAdminSession(data.token);
	await manageDashboardUser({
		actorId: actor.userId,
		userId: data.userId,
		action: data.action,
		...data.reason !== void 0 ? { reason: data.reason } : {},
		...data.notes !== void 0 ? { notes: data.notes } : {}
	});
	privateResponse();
	return { ok: true };
});
var forceGuildResync_createServerFn_handler = createServerRpc({
	id: "24de73364d1f308dec510650818dea2701f12eeeded6485f0ecfb911fff1b468",
	name: "forceGuildResync",
	filename: "src/lib/wumpus/admin.ts"
}, (opts) => forceGuildResync.__executeServer(opts));
var forceGuildResync = createServerFn({ method: "POST" }).validator((input) => resyncSchema.parse(input)).handler(forceGuildResync_createServerFn_handler, async ({ data }) => {
	enforceRequestLimit("admin-guild-resync", 20, 6e4);
	const actor = await requireAdminSession(data.token);
	const [botGuildIds, runtime] = await Promise.all([loadBotGuildIds(), readRuntime()]);
	if (!botGuildIds.includes(data.guildId)) throw new Error("O Wumpus não está instalado neste servidor.");
	const config = runtime.guilds[data.guildId];
	if (!config) throw new Error("Ainda não há configuração publicada para este servidor.");
	const jobs = [{
		target: "tickets",
		channelRef: String(config.tickets?.panelChannelId ?? "")
	}, {
		target: "forms",
		channelRef: String(config.forms?.panelChannelId ?? "")
	}].filter((job) => job.channelRef.trim().length > 0);
	if (!jobs.length) throw new Error("Este servidor não tem painéis configurados para republicar.");
	const queued = [];
	for (const job of jobs) {
		const row = {
			id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
			guildId: data.guildId,
			kind: "panel",
			target: job.target,
			channelRef: job.channelRef,
			createdAt: Date.now(),
			status: "queued"
		};
		await enqueueOutbox(row);
		queued.push(row.id);
	}
	await recordDashboardAdminEvent({
		actorId: actor.userId,
		action: "guild-resync",
		targetId: data.guildId,
		summary: `${queued.length} painel(is) enviados para republicação.`
	});
	privateResponse();
	return {
		ok: true,
		queued
	};
});
//#endregion
export { forceGuildResync_createServerFn_handler, getAdminOverview_createServerFn_handler, grantAdminAccess_createServerFn_handler, manageAdminUser_createServerFn_handler, revokeAdminGrant_createServerFn_handler };
