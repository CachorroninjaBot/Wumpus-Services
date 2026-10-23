import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./request-limits.server-D3WMs2Xr.mjs";
import { n as readBotHealth } from "./health.server-CEYWHLwq.mjs";
import { l as planAllows, r as SESSION_TOKEN_MAX_LENGTH, s as monthlyOcrLimit } from "./session-token-CaBlZnli.mjs";
import { a as number, c as string, i as literal, l as union, n as array, o as object, r as boolean, s as record, t as _enum } from "../_libs/zod.mjs";
import { g as requireGuildAccess } from "./session-access.server-BEsHDisY.mjs";
import { a as writeRuntime, i as writeBotCollection, n as readBotCollection, r as readRuntime, t as enqueueOutbox } from "./runtime.server-DWU5ehgX.mjs";
import { i as publishInputSchema } from "./runtime-validation-DKjJ331C.mjs";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime-store-oU0bUdd8.js
var EMPTY = { byGuild: {} };
var writeQueue = Promise.resolve();
function reviewPath() {
	return process.env.WUMPUS_SECURITY_REVIEWS_PATH || join(process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data"), "wumpus-security-reviews.json");
}
async function readState() {
	try {
		const parsed = JSON.parse(await readFile(reviewPath(), "utf8"));
		return parsed.byGuild && typeof parsed.byGuild === "object" ? { byGuild: parsed.byGuild } : EMPTY;
	} catch {
		return EMPTY;
	}
}
async function readReviewedSecurityEvents(guildId) {
	const ids = (await readState()).byGuild[guildId];
	return Array.isArray(ids) ? ids.filter((id) => Number.isSafeInteger(id) && id > 0) : [];
}
async function markSecurityEventReviewed(guildId, eventId) {
	const task = writeQueue.then(async () => {
		const state = await readState();
		const current = state.byGuild[guildId] ?? [];
		state.byGuild[guildId] = [.../* @__PURE__ */ new Set([...current, eventId])].slice(-1e3);
		const path = reviewPath();
		await mkdir(dirname(path), { recursive: true });
		const temporaryPath = `${path}.tmp`;
		await writeFile(temporaryPath, JSON.stringify(state));
		await rename(temporaryPath, path);
	});
	writeQueue = task.catch(() => void 0);
	await task;
}
/**
* Ponte painel -> bot.
*
* O bot roda em outro processo e le `data/wumpus-runtime.json`. Estas server
* functions sao o unico caminho pelo qual o painel escreve esse arquivo.
*
* Estavam definidas e sem nenhum chamador: o painel salvava so no localStorage
* e o bot nunca via configuracao alguma. Era isso que tornava todo campo da
* dashboard decorativo.
*
* O acesso a disco vive em `runtime.server.ts` (server-only); aqui ficam apenas
* os wrappers chamaveis pelo cliente.
*/
var getDiscordGuildResources_createServerFn_handler = createServerRpc({
	id: "606b6fe34d69f69335a74947114d4875fc638b4ec593b8d3ff8db8f8ce0c9ac0",
	name: "getDiscordGuildResources",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getDiscordGuildResources.__executeServer(opts));
var getDiscordGuildResources = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getDiscordGuildResources_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const health = await readBotHealth();
	if (!health || health.status !== "online" || Date.now() - health.at > 9e4) return {
		channels: [],
		roles: []
	};
	return health.guildResources?.[data.guildId] ?? {
		channels: [],
		roles: []
	};
});
var getGuildProtectionReadiness_createServerFn_handler = createServerRpc({
	id: "71815d92c95a10dec3dab1bc883bc97d48dce18efeb200568eab00b12059a146",
	name: "getGuildProtectionReadiness",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildProtectionReadiness.__executeServer(opts));
var getGuildProtectionReadiness = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getGuildProtectionReadiness_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const [health, audit] = await Promise.all([readBotHealth().catch(() => null), readBotCollection("audit")]);
	const lastLockdownEvent = audit.filter((row) => row.guildId === data.guildId && (row.eventType === "security_lockdown_on" || row.eventType === "security_lockdown_off")).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
	const lockdown = lastLockdownEvent ? lastLockdownEvent.eventType === "security_lockdown_on" : null;
	if (!health) return {
		status: "unknown",
		lastSeenAt: null,
		pingMs: null,
		permissions: null,
		lockdown
	};
	const fresh = health.status === "online" && Date.now() - health.at <= 9e4;
	const installed = health.guildIds.includes(data.guildId);
	return {
		status: !fresh ? "offline" : installed ? "online" : "not_installed",
		lastSeenAt: health.at,
		pingMs: health.pingMs,
		permissions: installed ? health.guildResources?.[data.guildId]?.permissions ?? null : null,
		lockdown
	};
});
var getGuildPlanUsage_createServerFn_handler = createServerRpc({
	id: "5c5e8c61427dd867557d23d8c3d79fdd7998d07462639b0217af5b79777a6ef9",
	name: "getGuildPlanUsage",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildPlanUsage.__executeServer(opts));
var getGuildPlanUsage = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getGuildPlanUsage_createServerFn_handler, async ({ data }) => {
	const session = await requireGuildAccess(data.token, data.guildId);
	const plan = session.entitlements.plan;
	if (!plan) throw new Error("Não há plano ativo para esta conta.");
	const accountId = session.userId;
	const month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
	const ocrUsed = (await readBotCollection("ocr-usage")).find((row) => row.accountId === accountId && row.month === month)?.count ?? 0;
	return {
		planId: plan,
		serversUsed: session.entitlements.guildIds.length,
		serverLimit: session.entitlements.limit,
		serversOverLimit: session.guilds.filter((guild) => guild.owner && session.entitlements.overLimitGuildIds.includes(guild.id)).map((guild) => guild.name),
		ocrUsed,
		ocrLimit: monthlyOcrLimit(plan),
		month
	};
});
var SECURITY_INCIDENT_TITLES = {
	security_raid_suspected: "Possível raid detectada",
	security_young_account: "Conta nova entrou no servidor",
	security_quarantine_failed: "Não foi possível isolar uma conta nova",
	security_mass_ban: "Banimentos em sequência",
	security_mass_channel_delete: "Canais apagados em sequência",
	security_mass_role_delete: "Cargos apagados em sequência",
	security_mass_webhook_create: "Webhooks criados em sequência",
	security_mass_invite_create: "Convites criados em sequência",
	security_mass_everyone_mentions: "Menções @everyone em sequência",
	security_auto_timeout_failed: "Timeout automático falhou",
	security_auto_timeout: "Timeout automático aplicado",
	security_repeat_offender_auto_ban_failed: "Banimento automático falhou",
	security_repeat_offender_auto_ban: "Autor de ações destrutivas banido",
	security_auto_response_unconfirmed: "Resposta automática aguarda confirmação",
	security_lockdown_on: "Lockdown ativado",
	security_lockdown_off: "Lockdown encerrado"
};
var getGuildSecurityIncidents_createServerFn_handler = createServerRpc({
	id: "d0386fb61e627f8b02a36730413f8ccd52802233aa1646da0aa2e141729a1871",
	name: "getGuildSecurityIncidents",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildSecurityIncidents.__executeServer(opts));
var getGuildSecurityIncidents = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	limit: number().int().min(1).max(200).default(100)
}).strict().parse(input)).handler(getGuildSecurityIncidents_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const [records, reviewedIds] = await Promise.all([readBotCollection("audit"), readReviewedSecurityEvents(data.guildId)]);
	const acknowledged = new Set(reviewedIds);
	return records.filter((row) => row.guildId === data.guildId && (row.module === "automod" || row.eventType.startsWith("security_") && row.severity !== "info")).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, data.limit).map((row) => ({
		id: row.id,
		module: row.module,
		eventType: row.eventType,
		severity: row.severity,
		title: SECURITY_INCIDENT_TITLES[row.eventType] ?? (row.module === "automod" ? "AutoMod removeu uma mensagem" : row.eventType.replace(/^security_/, "").replaceAll("_", " ")),
		detail: row.module === "automod" ? `Regra ${String(row.data?.rule ?? row.eventType.replace(/^automod_/, "").replaceAll("_", " "))} · ação ${String(row.data?.action ?? "registrada")}` : row.eventType === "security_raid_suspected" && typeof row.data?.count === "number" ? `${row.data.count} entradas em ${typeof row.data.windowMs === "number" ? Math.round(row.data.windowMs / 1e3) : "—"}s. Revise quem entrou recentemente e confirme se o lockdown é necessário.` : row.eventType === "security_young_account" && typeof row.data?.accountAgeHours === "number" ? `Conta com ${row.data.accountAgeHours}h; mínimo configurado: ${String(row.data.minAccountAgeHours ?? "—")}h.` : typeof row.data?.count === "number" && typeof row.data.threshold === "number" ? `${row.data.count} ações detectadas; o alerta começa em ${row.data.threshold}. Revise o autor e o registro de auditoria.` : row.eventType.replace(/^security_/, "").replaceAll("_", " "),
		actorId: row.actorId ?? null,
		targetId: row.targetId ?? null,
		channelId: row.channelId ?? null,
		at: Date.parse(row.at) || 0,
		acknowledged: acknowledged.has(row.id)
	}));
});
var acknowledgeGuildSecurityIncident_createServerFn_handler = createServerRpc({
	id: "258e1c44f287684cfbe21be25fcd1ea359b3a43f52be0a9d6488902d3fb51b00",
	name: "acknowledgeGuildSecurityIncident",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => acknowledgeGuildSecurityIncident.__executeServer(opts));
var acknowledgeGuildSecurityIncident = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	eventId: number().int().positive()
}).strict().parse(input)).handler(acknowledgeGuildSecurityIncident_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	if (!(await readBotCollection("audit")).some((event) => event.guildId === data.guildId && event.id === data.eventId)) throw new Error("O alerta não existe mais no histórico deste servidor.");
	await markSecurityEventReviewed(data.guildId, data.eventId);
	return { ok: true };
});
var groupSchema = array(object({
	id: string().min(1).max(80),
	name: string().trim().min(1).max(80),
	guildIds: array(string().regex(/^\d{17,20}$/)).min(1).max(50),
	resourceMappings: record(string().regex(/^\d{17,20}$/), record(string().min(1).max(160), string().regex(/^\d{17,20}$/))).optional()
}).strict()).max(50);
var getServerGroups_createServerFn_handler = createServerRpc({
	id: "c1c5b6a87876396132bce00be187b354cb998ce9a52642b9397b21619e73a017",
	name: "getServerGroups",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getServerGroups.__executeServer(opts));
var getServerGroups = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getServerGroups_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	return ((await readRuntime()).serverGroups ?? []).filter((group) => group.guildIds.includes(data.guildId));
});
var saveServerGroups_createServerFn_handler = createServerRpc({
	id: "c426bdfea4bb9fba6f4aa4c70a229423803e276176cec6424f6f0fdc75541995",
	name: "saveServerGroups",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => saveServerGroups.__executeServer(opts));
var saveServerGroups = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	groups: groupSchema
}).strict().parse(input)).handler(saveServerGroups_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	for (const group of data.groups) {
		if (!group.guildIds.includes(data.guildId)) throw new Error("Cada grupo precisa incluir o servidor atual.");
		for (const guildId of group.guildIds) await requireGuildAccess(data.token, guildId);
	}
	const runtime = await readRuntime();
	runtime.serverGroups = [...(runtime.serverGroups ?? []).filter((group) => !group.guildIds.includes(data.guildId)), ...data.groups.map((group) => ({
		...group,
		guildIds: [...new Set(group.guildIds)]
	}))];
	runtime.updatedAt = Date.now();
	await writeRuntime(runtime);
	return { ok: true };
});
var getGuildKnowledgeFaqSuggestions_createServerFn_handler = createServerRpc({
	id: "30dda75f3854dd8b6ee6a130550e74ddd6b834b7554cb8af25387a60efad6ad4",
	name: "getGuildKnowledgeFaqSuggestions",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildKnowledgeFaqSuggestions.__executeServer(opts));
var getGuildKnowledgeFaqSuggestions = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getGuildKnowledgeFaqSuggestions_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const [suggestions, statusRows] = await Promise.all([readBotCollection("knowledge-suggestions"), readBotCollection("knowledge-suggestion-status")]);
	const statuses = new Map(statusRows.map((row) => [`${row.guildId}:${row.id}`, row.status]));
	return suggestions.filter((suggestion) => suggestion.guildId === data.guildId && (statuses.get(`${suggestion.guildId}:${suggestion.id}`) ?? "pending") === "pending").sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 100);
});
var updateGuildKnowledgeFaqSuggestion_createServerFn_handler = createServerRpc({
	id: "0a9aedbfe06e78b28ed123caf38fa2920978c412f962f7cd5172fe5cbd5cca2e",
	name: "updateGuildKnowledgeFaqSuggestion",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => updateGuildKnowledgeFaqSuggestion.__executeServer(opts));
var updateGuildKnowledgeFaqSuggestion = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	suggestionId: string().min(1).max(100),
	status: _enum(["dismissed", "converted"])
}).strict().parse(input)).handler(updateGuildKnowledgeFaqSuggestion_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const [suggestions, statusRows] = await Promise.all([readBotCollection("knowledge-suggestions"), readBotCollection("knowledge-suggestion-status")]);
	if (!suggestions.some((suggestion) => suggestion.id === data.suggestionId && suggestion.guildId === data.guildId)) throw new Error("A sugestão de FAQ não existe mais.");
	if (statusRows.findIndex((row) => row.id === data.suggestionId && row.guildId === data.guildId) >= 0) throw new Error("A sugestão de FAQ já foi resolvida.");
	const statusRow = {
		id: data.suggestionId,
		guildId: data.guildId,
		status: data.status
	};
	statusRows.push(statusRow);
	await writeBotCollection("knowledge-suggestion-status", statusRows);
	return { ok: true };
});
var publishGuildRuntime_createServerFn_handler = createServerRpc({
	id: "30a37a9ee6e9b3f9bcacb568570cc71457d80b8808ca78d33d208fee7b93418f",
	name: "publishGuildRuntime",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => publishGuildRuntime.__executeServer(opts));
var publishGuildRuntime = createServerFn({ method: "POST" }).validator((input) => publishInputSchema.parse(input)).handler(publishGuildRuntime_createServerFn_handler, async ({ data }) => {
	const session = await requireGuildAccess(data.token, data.guildId);
	const current = await readRuntime();
	const plan = session.entitlements.plan;
	const modules = structuredClone(data.modules);
	if (!planAllows(plan ?? "essencial", "ai")) {
		if (modules.tickets) modules.tickets.aiSupportEnabled = false;
		if (modules.forms) modules.forms.useAiPreReview = false;
		if (modules.knowledge) modules.knowledge.useAi = false;
	}
	if (!planAllows(plan ?? "essencial", "ocr")) {
		if (modules.automod) modules.automod.scanImages = false;
		if (modules.ocr) modules.ocr.enabled = false;
	}
	if (!planAllows(plan ?? "essencial", "webhooks") && modules.integrations) modules.integrations.allowIncoming = false;
	current.guilds[data.guildId] = {
		...current.guilds[data.guildId],
		...modules,
		...data.name ? { name: data.name } : {}
	};
	if (data.articles) current.articles = {
		...current.articles,
		[data.guildId]: data.articles
	};
	current.updatedAt = Date.now();
	await writeRuntime(current);
	return {
		ok: true,
		updatedAt: current.updatedAt
	};
});
var requestPanelPublish_createServerFn_handler = createServerRpc({
	id: "b5230e82ec52d306c1c899b8f05536cf0e83719f5d257c240dc52d74cb23ad88",
	name: "requestPanelPublish",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => requestPanelPublish.__executeServer(opts));
var requestPanelPublish = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	target: _enum([
		"tickets",
		"forms",
		"security-verification"
	]),
	channelRef: string().trim().min(1).max(100),
	verificationRoleId: string().trim().min(1).max(100).optional()
}).strict().parse(input)).handler(requestPanelPublish_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const job = {
		id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		guildId: data.guildId,
		kind: "panel",
		target: data.target,
		channelRef: data.channelRef,
		...data.verificationRoleId ? { verificationRoleId: data.verificationRoleId } : {},
		createdAt: Date.now(),
		status: "queued"
	};
	await enqueueOutbox(job);
	return {
		ok: true,
		jobId: job.id
	};
});
var requestSecurityRestore_createServerFn_handler = createServerRpc({
	id: "b1afee38b841e12e71119496d9c43a906867e6b9295799889ab2fe4296f64950",
	name: "requestSecurityRestore",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => requestSecurityRestore.__executeServer(opts));
var requestSecurityRestore = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(requestSecurityRestore_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const job = {
		id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		guildId: data.guildId,
		kind: "ticket_action",
		target: "security-verification",
		channelRef: "",
		action: "security_restore",
		createdAt: Date.now(),
		status: "queued"
	};
	await enqueueOutbox(job);
	return {
		ok: true,
		jobId: job.id
	};
});
var requestSecurityLockdown_createServerFn_handler = createServerRpc({
	id: "67674983557718382707e61482f5d459712f482f3ffddc071f57860ebd3afca6",
	name: "requestSecurityLockdown",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => requestSecurityLockdown.__executeServer(opts));
var requestSecurityLockdown = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	enabled: boolean()
}).strict().parse(input)).handler(requestSecurityLockdown_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const job = {
		id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		guildId: data.guildId,
		kind: "ticket_action",
		target: "security",
		channelRef: "",
		action: data.enabled ? "security_lockdown_on" : "security_lockdown_off",
		createdAt: Date.now(),
		status: "queued"
	};
	await enqueueOutbox(job);
	return {
		ok: true,
		jobId: job.id
	};
});
var getGuildSecurityActionStatus_createServerFn_handler = createServerRpc({
	id: "981427b878ee377945b2e56067005274e33d26c23d99ea703fd86d70c19f3e8b",
	name: "getGuildSecurityActionStatus",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildSecurityActionStatus.__executeServer(opts));
var getGuildSecurityActionStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	jobId: string().min(1).max(100)
}).strict().parse(input)).handler(getGuildSecurityActionStatus_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const job = (await readRuntime()).outbox?.find((entry) => entry.id === data.jobId && entry.guildId === data.guildId && (entry.target === "security" || entry.target === "security-verification"));
	return job ? {
		status: job.status,
		detail: job.detail ?? null,
		at: job.at ?? null
	} : {
		status: "missing",
		detail: null,
		at: null
	};
});
var getPublishStatus_createServerFn_handler = createServerRpc({
	id: "b9a31d924c524dddaf890676d785aa8d2a8d9127a7a46441da06dd50c4eef0e6",
	name: "getPublishStatus",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getPublishStatus.__executeServer(opts));
var getPublishStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getPublishStatus_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	return ((await readRuntime()).outbox ?? []).filter((job) => job.guildId === data.guildId && job.kind === "panel").slice(-20).map((job) => ({
		id: job.id,
		target: job.target,
		channelRef: job.channelRef,
		status: job.status,
		...job.detail ? { detail: job.detail } : {},
		...job.channelId ? { channelId: job.channelId } : {},
		...job.messageId ? { messageId: job.messageId } : {},
		createdAt: job.createdAt,
		...job.at ? { at: job.at } : {}
	}));
});
var getGuildTickets_createServerFn_handler = createServerRpc({
	id: "b2912d9d137371b8041f72110b40a1e239d00eb9d444b1be0358ce299b84c579",
	name: "getGuildTickets",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildTickets.__executeServer(opts));
var getGuildTickets = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getGuildTickets_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const [tickets, messages] = await Promise.all([readBotCollection("tickets"), readBotCollection("ticket_messages")]);
	return tickets.filter((ticket) => ticket.guildId === data.guildId).sort((a, b) => b.id - a.id).slice(0, 500).map((ticket) => ({
		id: String(ticket.id),
		guildId: ticket.guildId,
		number: ticket.id,
		openerId: ticket.openerId,
		claimedBy: ticket.claimedBy,
		department: ticket.department ?? "Geral",
		subject: messages.find((message) => message.ticketId === ticket.id && message.authorId === ticket.openerId)?.content.slice(0, 80) || `Atendimento #${ticket.id}`,
		status: ticket.status,
		priority: ticket.priority,
		tags: [],
		channelName: ticket.channelId,
		createdAt: Date.parse(ticket.createdAt) || 0,
		firstResponseAt: ticket.firstResponseAt ? Date.parse(ticket.firstResponseAt) || null : null,
		closedAt: ticket.closedAt ? Date.parse(ticket.closedAt) || null : null,
		feedback: ticket.feedback,
		transcript: null,
		messages: messages.filter((message) => message.ticketId === ticket.id).slice(-500).map((message, index) => ({
			id: `${ticket.id}-${index}`,
			authorId: message.authorId,
			authorName: message.authorName,
			content: message.content,
			at: Date.parse(message.at) || 0,
			kind: message.authorId === ticket.openerId ? "user" : "staff"
		}))
	}));
});
var getGuildFormSubmissions_createServerFn_handler = createServerRpc({
	id: "fe44600c6b57dae1222f424222cf46fd327679e11c94de4f51f76375d49a5145",
	name: "getGuildFormSubmissions",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildFormSubmissions.__executeServer(opts));
var getGuildFormSubmissions = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(getGuildFormSubmissions_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	return (await readBotCollection("forms")).filter((form) => form.guildId === data.guildId).sort((a, b) => b.id - a.id).slice(0, 500).map((form) => ({
		id: String(form.id),
		guildId: form.guildId,
		userId: form.userId,
		answers: Object.fromEntries(form.questions.map((question, index) => [question, form.answers[index] ?? ""])),
		status: form.status,
		createdAt: Date.parse(form.createdAt) || 0,
		reviewedAt: form.reviewedAt ? Date.parse(form.reviewedAt) || null : null,
		reviewerId: form.reviewedBy,
		reason: form.reviewReason ?? "",
		aiNote: null
	}));
});
var requestFormReview_createServerFn_handler = createServerRpc({
	id: "cc4a9e4381f3f2d3f382e19e42aa705323334bfb602f201c612f903c009c178f",
	name: "requestFormReview",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => requestFormReview.__executeServer(opts));
var requestFormReview = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	formId: number().int().positive(),
	actorId: string().regex(/^\d{17,20}$/),
	decision: _enum(["approved", "rejected"]),
	reason: string().max(500).optional()
}).strict().parse(input)).handler(requestFormReview_createServerFn_handler, async ({ data }) => {
	if ((await requireGuildAccess(data.token, data.guildId)).userId !== data.actorId) throw new Error("O revisor informado não corresponde à sessão.");
	const job = {
		id: `form_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		guildId: data.guildId,
		kind: "form_action",
		target: "forms",
		channelRef: "",
		action: data.decision === "approved" ? "approve_form" : "reject_form",
		formId: data.formId,
		actorId: data.actorId,
		...data.reason?.trim() ? { reason: data.reason.trim() } : {},
		createdAt: Date.now(),
		status: "queued"
	};
	await enqueueOutbox(job);
	return { jobId: job.id };
});
var getFormReviewStatus_createServerFn_handler = createServerRpc({
	id: "9af265fac887a2955e3de02d1ca3ecfd4454cce0e9ce35902aa498f8816a10ea",
	name: "getFormReviewStatus",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getFormReviewStatus.__executeServer(opts));
var getFormReviewStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	jobId: string().min(1).max(100)
}).strict().parse(input)).handler(getFormReviewStatus_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const job = (await readRuntime()).outbox?.find((entry) => entry.id === data.jobId && entry.guildId === data.guildId && entry.kind === "form_action");
	return job ? {
		status: job.status,
		detail: job.detail ?? null
	} : {
		status: "missing",
		detail: null
	};
});
var requestTicketAction_createServerFn_handler = createServerRpc({
	id: "dc20c917c72887b051d7da702850b045784fb4db13fc576e57e823398f85712b",
	name: "requestTicketAction",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => requestTicketAction.__executeServer(opts));
var requestTicketAction = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	ticketId: number().int().positive(),
	actorId: string().regex(/^\d{17,20}$/),
	action: _enum([
		"claim",
		"reply",
		"close",
		"priority",
		"transfer",
		"escalate"
	]),
	content: string().trim().min(1).max(2e3).optional(),
	reason: string().trim().max(500).optional(),
	targetStaffId: string().regex(/^\d{17,20}$/).optional(),
	priority: _enum([
		"low",
		"normal",
		"high",
		"urgent"
	]).optional()
}).strict().superRefine((input, ctx) => {
	if (input.action === "reply" && !input.content) ctx.addIssue({
		code: "custom",
		message: "A resposta não pode ficar vazia."
	});
	if (input.action === "priority" && !input.priority) ctx.addIssue({
		code: "custom",
		message: "Escolha uma prioridade válida."
	});
	if (input.action === "transfer" && !input.targetStaffId) ctx.addIssue({
		code: "custom",
		message: "Escolha um atendente para transferir o ticket."
	});
}).parse(input)).handler(requestTicketAction_createServerFn_handler, async ({ data }) => {
	if ((await requireGuildAccess(data.token, data.guildId)).userId !== data.actorId) throw new Error("O atendente informado não corresponde à sessão.");
	const job = {
		id: `ticket_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		guildId: data.guildId,
		kind: "ticket_action",
		target: "tickets",
		channelRef: "",
		action: data.action,
		ticketId: data.ticketId,
		actorId: data.actorId,
		...data.content ? { content: data.content } : {},
		...data.reason ? { reason: data.reason } : {},
		...data.targetStaffId ? { targetStaffId: data.targetStaffId } : {},
		...data.priority ? { priority: data.priority } : {},
		createdAt: Date.now(),
		status: "queued"
	};
	await enqueueOutbox(job);
	return { jobId: job.id };
});
var getTicketActionStatus_createServerFn_handler = createServerRpc({
	id: "5a310377f10a793a6609a5227d479019ea4831e454e5c1d5317bba33a59172e8",
	name: "getTicketActionStatus",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getTicketActionStatus.__executeServer(opts));
var getTicketActionStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	jobId: string().min(1).max(100)
}).strict().parse(input)).handler(getTicketActionStatus_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const job = (await readRuntime()).outbox?.find((entry) => entry.id === data.jobId && entry.guildId === data.guildId && entry.kind === "ticket_action");
	return job ? {
		status: job.status,
		detail: job.detail ?? null
	} : {
		status: "missing",
		detail: null
	};
});
var getGuildActivity_createServerFn_handler = createServerRpc({
	id: "91ec17e334fa434f071540e215f473cc9a206c4ed8dbc9c8b95bb1034c1ca535",
	name: "getGuildActivity",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildActivity.__executeServer(opts));
var getGuildActivity = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	periodDays: union([
		literal(7),
		literal(30),
		literal(90)
	]).optional(),
	slaGoalMinutes: number().int().min(0).max(10080).optional()
}).strict().parse(input)).handler(getGuildActivity_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	const periodDays = data.periodDays ?? 7;
	const slaGoalMinutes = data.slaGoalMinutes ?? 60;
	const [ticketRows, dailyRows, moderationRows, auditRows, formRows, health] = await Promise.all([
		readBotCollection("tickets"),
		readBotCollection("statistics"),
		readBotCollection("moderation"),
		readBotCollection("audit"),
		readBotCollection("forms"),
		readBotHealth().catch(() => null)
	]);
	const guildTickets = ticketRows.filter((row) => row.guildId === data.guildId);
	const guildDailyRows = dailyRows.filter((row) => row.guildId === data.guildId);
	const guildModerationRows = moderationRows.filter((row) => row.guildId === data.guildId);
	const guildAuditRows = auditRows.filter((row) => row.guildId === data.guildId);
	const guildForms = formRows.filter((row) => row.guildId === data.guildId);
	const byDate = (rows, dateOf) => {
		const result = /* @__PURE__ */ new Map();
		for (const row of rows) {
			const date = dateOf(row)?.slice(0, 10);
			if (!date) continue;
			const bucket = result.get(date);
			if (bucket) bucket.push(row);
			else result.set(date, [row]);
		}
		return result;
	};
	const ticketsByCreatedDay = byDate(guildTickets, (row) => row.createdAt);
	const ticketsByClosedDay = byDate(guildTickets, (row) => row.closedAt);
	const activityByDay = byDate(guildDailyRows, (row) => row.day);
	const moderationByDay = byDate(guildModerationRows, (row) => row.createdAt);
	const automodByDay = byDate(guildAuditRows.filter((row) => row.module === "automod"), (row) => row.at);
	const today = /* @__PURE__ */ new Date();
	today.setUTCHours(0, 0, 0, 0);
	const end = today.toISOString().slice(0, 10);
	const startDate = new Date(today);
	startDate.setUTCDate(startDate.getUTCDate() - (periodDays - 1));
	const start = startDate.toISOString().slice(0, 10);
	const previousEndDate = new Date(startDate);
	previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
	const previousEnd = previousEndDate.toISOString().slice(0, 10);
	const previousStartDate = new Date(previousEndDate);
	previousStartDate.setUTCDate(previousStartDate.getUTCDate() - (periodDays - 1));
	const previousStart = previousStartDate.toISOString().slice(0, 10);
	const within = (value, from, to) => Boolean(value && value.slice(0, 10) >= from && value.slice(0, 10) <= to);
	const summarize = (from, to) => {
		const rangeTickets = guildTickets.filter((row) => within(row.createdAt, from, to));
		const resolved = guildTickets.filter((row) => within(row.closedAt, from, to));
		const responded = rangeTickets.flatMap((row) => {
			const created = Date.parse(row.createdAt);
			const response = row.firstResponseAt ? Date.parse(row.firstResponseAt) : NaN;
			return Number.isFinite(created) && Number.isFinite(response) && response >= created ? [{
				minutes: (response - created) / 6e4,
				row
			}] : [];
		});
		const responseTimes = responded.map((row) => row.minutes).sort((a, b) => a - b);
		const medianResponseMinutes = responseTimes.length ? responseTimes.length % 2 ? responseTimes[(responseTimes.length - 1) / 2] : (responseTimes[responseTimes.length / 2 - 1] + responseTimes[responseTimes.length / 2]) / 2 : null;
		const rated = resolved.flatMap((row) => row.feedback && row.feedback.rating >= 1 && row.feedback.rating <= 5 ? [row.feedback.rating] : []);
		const metSla = responded.filter((row) => row.minutes <= slaGoalMinutes).length;
		const overdueWithoutResponse = slaGoalMinutes > 0 ? rangeTickets.filter((row) => {
			const created = Date.parse(row.createdAt);
			return !row.firstResponseAt && Number.isFinite(created) && Date.now() - created > slaGoalMinutes * 6e4;
		}).length : 0;
		const slaDenominator = responded.length + overdueWithoutResponse;
		const byDepartment = /* @__PURE__ */ new Map();
		for (const row of rangeTickets) {
			const key = row.department?.trim() || "Geral";
			byDepartment.set(key, {
				opened: (byDepartment.get(key)?.opened ?? 0) + 1,
				closed: byDepartment.get(key)?.closed ?? 0
			});
		}
		for (const row of resolved) {
			const key = row.department?.trim() || "Geral";
			byDepartment.set(key, {
				opened: byDepartment.get(key)?.opened ?? 0,
				closed: (byDepartment.get(key)?.closed ?? 0) + 1
			});
		}
		return {
			opened: rangeTickets.length,
			closed: resolved.length,
			medianResponseMinutes,
			responseCount: responded.length,
			slaMet: slaGoalMinutes > 0 && slaDenominator ? Math.round(metSla / slaDenominator * 100) : null,
			slaCount: slaGoalMinutes > 0 ? slaDenominator : 0,
			csat: rated.length ? rated.reduce((sum, score) => sum + score, 0) / rated.length : null,
			csatCount: rated.length,
			departments: [...byDepartment.entries()].map(([department, counts]) => ({
				department,
				...counts
			})).sort((a, b) => b.opened - a.opened).slice(0, 8),
			automod: guildAuditRows.filter((row) => row.module === "automod" && within(row.at, from, to)).length,
			moderation: guildModerationRows.filter((row) => within(row.createdAt, from, to)).length
		};
	};
	const days = Array.from({ length: periodDays }, (_, index) => {
		const date = new Date(startDate);
		date.setUTCDate(date.getUTCDate() + index);
		const day = date.toISOString().slice(0, 10);
		const existing = activityByDay.get(day)?.[0];
		const tickets = ticketsByCreatedDay.get(day)?.length ?? 0;
		const closed = ticketsByClosedDay.get(day)?.length ?? 0;
		const automod = automodByDay.get(day)?.length ?? 0;
		const moderation = moderationByDay.get(day)?.length ?? 0;
		return {
			day,
			label: day === end ? "hoje" : new Intl.DateTimeFormat("pt-BR", periodDays > 7 ? {
				day: "2-digit",
				month: "short",
				timeZone: "UTC"
			} : {
				weekday: "short",
				timeZone: "UTC"
			}).format(date).replace(".", ""),
			messages: existing?.messages ?? 0,
			joins: existing?.joins ?? 0,
			tickets,
			closed,
			automod,
			moderation
		};
	});
	const currentSummary = summarize(start, end);
	const previousSummary = summarize(previousStart, previousEnd);
	const unanswered = guildTickets.filter((row) => (row.status === "open" || row.status === "claimed") && !row.firstResponseAt).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
	const healthForGuild = health?.guildIds.includes(data.guildId) ? health : null;
	const botStatus = !healthForGuild ? "unavailable" : healthForGuild.status === "online" && Date.now() - healthForGuild.at <= 9e4 ? "online" : "offline";
	return {
		days,
		range: {
			start,
			end,
			...currentSummary
		},
		previousRange: {
			start: previousStart,
			end: previousEnd,
			...previousSummary
		},
		currentOpen: guildTickets.filter((row) => row.status === "open" || row.status === "claimed").length,
		oldestUnanswered: unanswered ? {
			id: unanswered.id,
			department: unanswered.department ?? "Geral",
			createdAt: Date.parse(unanswered.createdAt) || 0
		} : null,
		refreshedAt: Date.now(),
		bot: {
			status: botStatus,
			lastSeenAt: healthForGuild?.at ?? null,
			pingMs: healthForGuild?.pingMs ?? null
		},
		pendingForms: guildForms.filter((row) => row.status === "pending").length,
		recentEvents: guildAuditRows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6).map((row) => ({
			id: row.id,
			module: row.module,
			eventType: row.eventType,
			actorId: row.actorId ?? null,
			severity: row.severity,
			at: Date.parse(row.at) || 0
		})),
		totals: days.reduce((total, row) => ({
			messages: total.messages + row.messages,
			joins: total.joins + row.joins,
			tickets: total.tickets + row.tickets,
			automod: total.automod + row.automod,
			moderation: total.moderation + row.moderation
		}), {
			messages: 0,
			joins: 0,
			tickets: 0,
			automod: 0,
			moderation: 0
		})
	};
});
var getGuildAudit_createServerFn_handler = createServerRpc({
	id: "c0334f5407256a1465c25d9206c318c157fd8fc515e41b1efe991259a7c6c018",
	name: "getGuildAudit",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getGuildAudit.__executeServer(opts));
var getGuildAudit = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	limit: number().int().min(1).max(500).default(200)
}).strict().parse(input)).handler(getGuildAudit_createServerFn_handler, async ({ data }) => {
	await requireGuildAccess(data.token, data.guildId);
	return (await readBotCollection("audit")).filter((row) => row.guildId === data.guildId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, data.limit).map((row) => ({
		id: row.id,
		category: row.module,
		eventType: row.eventType,
		actorId: row.actorId ?? null,
		targetId: row.targetId ?? null,
		channelId: row.channelId ?? null,
		severity: row.severity,
		summary: typeof row.data?.summary === "string" ? row.data.summary : row.eventType.replaceAll("_", " "),
		at: Date.parse(row.at) || 0
	}));
});
//#endregion
export { acknowledgeGuildSecurityIncident_createServerFn_handler, getDiscordGuildResources_createServerFn_handler, getFormReviewStatus_createServerFn_handler, getGuildActivity_createServerFn_handler, getGuildAudit_createServerFn_handler, getGuildFormSubmissions_createServerFn_handler, getGuildKnowledgeFaqSuggestions_createServerFn_handler, getGuildPlanUsage_createServerFn_handler, getGuildProtectionReadiness_createServerFn_handler, getGuildSecurityActionStatus_createServerFn_handler, getGuildSecurityIncidents_createServerFn_handler, getGuildTickets_createServerFn_handler, getPublishStatus_createServerFn_handler, getServerGroups_createServerFn_handler, getTicketActionStatus_createServerFn_handler, publishGuildRuntime_createServerFn_handler, requestFormReview_createServerFn_handler, requestPanelPublish_createServerFn_handler, requestSecurityLockdown_createServerFn_handler, requestSecurityRestore_createServerFn_handler, requestTicketAction_createServerFn_handler, saveServerGroups_createServerFn_handler, updateGuildKnowledgeFaqSuggestion_createServerFn_handler };
