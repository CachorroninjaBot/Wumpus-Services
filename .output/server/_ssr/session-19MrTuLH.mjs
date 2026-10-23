import { r as createServerFn } from "./ssr.mjs";
import { g as verifySession, h as signSession, m as sessionSecret } from "./session-token-CaBlZnli.mjs";
import { c as string, o as object } from "../_libs/zod.mjs";
import { n as enforceRequestLimit, t as createServerRpc } from "./request-limits.server-D3WMs2Xr.mjs";
import { a as setDashboardSessionCookie, i as markPrivateResponse, n as consumeOAuthStateCookie, r as getDashboardSessionCookie, t as clearDashboardSessionCookie } from "./session-cookie.server-D0OzyQJ-.mjs";
import { t as inspectBotHealth } from "./health.server-CEYWHLwq.mjs";
import { a as isDashboardAccountSuspended, b as verifySignedSession, c as loadBilling, f as recordDashboardActivity, l as loadBotGuildIds, m as recordDashboardLogin, n as configuredLifetimeSubscriptions, o as isPlatformOwner, t as closeDashboardSession, u as loadManualSubscriptionRows, v as resolveEntitlements } from "./session-access.server-BEsHDisY.mjs";
import { t as exchangeDiscordCodeDirect } from "./oauth-r8HMGInj.mjs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/session-19MrTuLH.js
var writes = Promise.resolve();
function licensePath() {
	return process.env.WUMPUS_LICENSE_PATH || join(process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data"), "wumpus-entitlements.json");
}
async function readGuildLicenses() {
	try {
		const parsed = JSON.parse(await readFile(licensePath(), "utf8"));
		return {
			updatedAt: Number(parsed.updatedAt) || 0,
			byGuild: parsed.byGuild && typeof parsed.byGuild === "object" ? parsed.byGuild : {}
		};
	} catch {
		return {
			updatedAt: 0,
			byGuild: {}
		};
	}
}
/** Serialize account syncs from dashboard and bot against the shared file. */
async function mutateGuildLicenses(mutator) {
	const next = writes.then(async () => {
		const current = await readGuildLicenses();
		const updated = mutator(current) ?? current;
		const path = licensePath();
		await mkdir(dirname(path), { recursive: true });
		const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
		await writeFile(temp, JSON.stringify(updated, null, 2));
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
		return updated;
	});
	writes = next.catch(() => void 0);
	return next;
}
/** Atualiza a licença por servidor após validar dono, assinatura e presença do bot. */
async function syncGuildEntitlements(input) {
	const owned = new Set(input.ownedGuildIds);
	const bot = new Set(input.botGuildIds);
	const allowed = new Set(input.allowedGuildIds);
	const guildIds = [...owned].filter((id) => bot.has(id));
	if (!guildIds.length) return;
	await mutateGuildLicenses((current) => {
		const now = Date.now();
		for (const [priority, guildId] of guildIds.entries()) {
			const active = allowed.has(guildId) && input.planId !== null;
			current.byGuild[guildId] = {
				status: active ? "active" : "inactive",
				planId: input.planId,
				accountId: input.accountId,
				discordUsername: input.discordUsername,
				updatedAt: now,
				priority,
				...!active ? { reason: input.planId ? "server_limit" : "no_subscription" } : {}
			};
		}
		current.updatedAt = now;
		return current;
	});
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
function subscriptionRows(billing) {
	return [...billing.subscriptions.map((sub) => ({
		status: sub.status,
		planId: sub.planId,
		discordUsername: sub.discordUsername,
		discordUserId: sub.discordUserId
	})), ...configuredLifetimeSubscriptions()];
}
/** Entra com o `code` do Discord e devolve um token assinado. */
var startSession_createServerFn_handler = createServerRpc({
	id: "a024cd76e8fb329ddfcdb1c38889490faa45e6108c073941bd702ae77c295ec9",
	name: "startSession",
	filename: "src/lib/wumpus/session.ts"
}, (opts) => startSession.__executeServer(opts));
var startSession = createServerFn({ method: "POST" }).validator((input) => object({
	code: string().min(1).max(2048),
	state: string().regex(/^[0-9a-f-]{36}$/i)
}).strict().parse(input)).handler(startSession_createServerFn_handler, async ({ data }) => {
	enforceRequestLimit("discord-login", 10, 6e5);
	if (!consumeOAuthStateCookie(data.state)) return {
		ok: false,
		error: "A validação do login expirou. Volte ao início e tente novamente."
	};
	const secret = sessionSecret();
	if (!secret) return {
		ok: false,
		error: "A configuração segura de sessão está incompleta."
	};
	let exchanged;
	try {
		exchanged = await exchangeDiscordCodeDirect(data.code);
	} catch (error) {
		console.error("Falha de rede durante autenticação Discord.", error);
		return {
			ok: false,
			error: "Não foi possível concluir o login com o Discord. Tente novamente."
		};
	}
	if (!exchanged.ok) return {
		ok: false,
		error: exchanged.error
	};
	if (await isDashboardAccountSuspended(exchanged.user.id)) return {
		ok: false,
		error: "Esta conta está suspensa. Fale com o suporte da plataforma."
	};
	const payload = {
		sessionId: randomUUID(),
		userId: exchanged.user.id,
		username: exchanged.user.username,
		globalName: exchanged.user.globalName,
		avatar: exchanged.user.avatar ?? null,
		mfaEnabled: exchanged.user.mfaEnabled,
		guilds: exchanged.guilds.map((guild) => ({
			id: guild.id,
			name: guild.name,
			iconUrl: guild.iconUrl ?? null,
			owner: guild.owner
		}))
	};
	const token = await signSession(payload, secret);
	try {
		await recordDashboardLogin({
			id: payload.userId,
			username: payload.username
		}, payload.sessionId, payload.guilds);
	} catch (error) {
		console.error("Não foi possível registrar a sessão autenticada.", error);
		return {
			ok: false,
			error: error instanceof Error && error.message.includes("suspensa") ? error.message : "Não foi possível registrar a sessão com segurança. Tente novamente."
		};
	}
	setDashboardSessionCookie(token);
	return { ok: true };
});
var resolveAccess_createServerFn_handler = createServerRpc({
	id: "e23c83f0285558e3636ed3183139e0c2c2047f6b3edfcabceda3510897a0ba57",
	name: "resolveAccess",
	filename: "src/lib/wumpus/session.ts"
}, (opts) => resolveAccess.__executeServer(opts));
var resolveAccess = createServerFn({ method: "POST" }).validator((input) => object({ token: string().max(64).optional() }).strict().parse(input)).handler(resolveAccess_createServerFn_handler, async () => {
	enforceRequestLimit("resolve-access", 60, 6e4);
	markPrivateResponse();
	if (!sessionSecret()) return {
		ok: false,
		error: "Segredo de sessão ausente no servidor."
	};
	let payload;
	try {
		payload = await verifySignedSession("");
	} catch (error) {
		if (error instanceof Error && /sessão inválida|encerrada ou revogada/i.test(error.message)) clearDashboardSessionCookie();
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Sessão inválida ou expirada. Entre de novo."
		};
	}
	const [botGuildIds, billing, manualSubscriptions] = await Promise.all([
		loadBotGuildIds(),
		loadBilling(),
		loadManualSubscriptionRows()
	]);
	const subscriptions = [...subscriptionRows(billing), ...manualSubscriptions];
	const entitlements = resolveEntitlements({
		discordUserId: payload.userId,
		discordUsername: payload.username,
		ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
		manageableGuildIds: payload.guilds.map((guild) => guild.id),
		botGuildIds,
		subscriptions
	});
	if (billing.ok || entitlements.isOwner || manualSubscriptions.some((sub) => sub.discordUserId === payload.userId) || configuredLifetimeSubscriptions().some((sub) => sub.discordUserId === payload.userId)) await syncGuildEntitlements({
		accountId: payload.userId,
		discordUsername: payload.username,
		planId: entitlements.plan,
		botGuildIds,
		ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
		allowedGuildIds: entitlements.guildIds
	});
	return {
		ok: true,
		session: {
			id: payload.userId,
			username: payload.username,
			globalName: payload.globalName,
			avatar: payload.avatar,
			mfaEnabled: payload.mfaEnabled
		},
		guilds: payload.guilds,
		entitlements
	};
});
var getOwnerGuildDiagnostics_createServerFn_handler = createServerRpc({
	id: "c489afc464e3276614b23adecc854fd377eab555a42946d9716a8544cd8a33c3",
	name: "getOwnerGuildDiagnostics",
	filename: "src/lib/wumpus/session.ts"
}, (opts) => getOwnerGuildDiagnostics.__executeServer(opts));
var getOwnerGuildDiagnostics = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(getOwnerGuildDiagnostics_createServerFn_handler, async () => {
	enforceRequestLimit("owner-guild-diagnostics", 20, 6e4);
	const session = await verifySignedSession("");
	if (!isPlatformOwner(session.userId)) throw new Error("Diagnóstico disponível apenas para o dono da plataforma.");
	const checkedAt = Date.now();
	const health = await inspectBotHealth();
	const healthAgeSeconds = health.record ? Math.max(0, Math.floor((checkedAt - health.record.at) / 1e3)) : null;
	const manageableGuildCount = session.guilds.length;
	const botGuildIds = new Set(health.record?.guildIds ?? []);
	const matchingGuildCount = session.guilds.filter((guild) => botGuildIds.has(guild.id)).length;
	let issue = "none";
	let recommendation = "A conexão do bot está saudável. Se a lista continuar vazia, atualize a página e verifique os logs do painel.";
	if (health.state === "missing") {
		issue = "health-file";
		recommendation = "O painel não encontrou o arquivo de saúde. Verifique se bot e painel compartilham o volume e se WUMPUS_HEALTH_PATH aponta para o mesmo arquivo nos dois serviços.";
	} else if (health.state === "invalid") {
		issue = "health-invalid";
		recommendation = "O arquivo de saúde existe, mas está inválido. Reinicie o bot para ele gerar um novo heartbeat.";
	} else if (health.state === "unreadable") {
		issue = "health-unreadable";
		recommendation = "O painel não consegue ler o arquivo de saúde. Confira o caminho e as permissões de leitura do serviço.";
	} else if (healthAgeSeconds !== null && healthAgeSeconds > 90) {
		issue = "health-stale";
		recommendation = "O heartbeat está antigo. Verifique se o bot continua ligado e se consegue gravar no volume compartilhado.";
	} else if (health.record?.status !== "online") {
		issue = "bot-offline";
		recommendation = "O último heartbeat informa que o bot está offline. Reinicie o processo do bot e confira os logs dele.";
	} else if (health.record.guildIds.length === 0) {
		issue = "bot-no-guilds";
		recommendation = "O bot reportou zero servidores. Confira a conexão do bot com o Discord e reinicie-o.";
	} else if (manageableGuildCount === 0) {
		issue = "discord-guilds";
		recommendation = "A sessão não tem servidores administráveis registrados. Use “Atualizar conexão com o Discord” para autorizar novamente com a conta correta.";
	} else if (matchingGuildCount === 0) {
		issue = "guild-mismatch";
		recommendation = "O bot está ativo, mas não aparece em nenhum servidor administrável por esta conta. Confirme se esta é a conta Discord correta e se o bot foi adicionado a um dos seus servidores.";
	}
	const diagnostics = {
		checkedAt,
		healthPath: process.env.WUMPUS_HEALTH_PATH?.trim() || "data/wumpus-health.json (padrão relativo a process.cwd())",
		manageableGuildCount,
		healthState: health.state,
		healthPathSource: health.pathSource,
		healthStatus: health.record?.status ?? null,
		healthAgeSeconds,
		healthGuildCount: health.record?.guildIds.length ?? 0,
		matchingGuildCount,
		...health.errorCode ? { errorCode: health.errorCode } : {},
		issue,
		recommendation
	};
	console.info("[owner-guild-diagnostics]", JSON.stringify({
		checkedAt: diagnostics.checkedAt,
		manageableGuildCount: diagnostics.manageableGuildCount,
		healthState: diagnostics.healthState,
		healthPathSource: diagnostics.healthPathSource,
		healthStatus: diagnostics.healthStatus,
		healthAgeSeconds: diagnostics.healthAgeSeconds,
		healthGuildCount: diagnostics.healthGuildCount,
		matchingGuildCount: diagnostics.matchingGuildCount,
		errorCode: diagnostics.errorCode,
		issue: diagnostics.issue,
		recommendation: diagnostics.recommendation
	}));
	return diagnostics;
});
var heartbeatDashboardSession_createServerFn_handler = createServerRpc({
	id: "82dcb7d190fb62369162b71fa08803341f25217c7cc205b4bffe8de747a746d7",
	name: "heartbeatDashboardSession",
	filename: "src/lib/wumpus/session.ts"
}, (opts) => heartbeatDashboardSession.__executeServer(opts));
var heartbeatDashboardSession = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(heartbeatDashboardSession_createServerFn_handler, async () => {
	try {
		const payload = await verifySignedSession("");
		await recordDashboardActivity(payload.sessionId);
		return { ok: true };
	} catch (error) {
		if (error instanceof Error && /sessão inválida|encerrada ou revogada/i.test(error.message)) {
			clearDashboardSessionCookie();
			return {
				ok: false,
				reason: "expired"
			};
		}
		throw error;
	}
});
var logoutDashboardSession_createServerFn_handler = createServerRpc({
	id: "b256f5c8d8234a219db62b31cdaabd5ffb4657f4558c521b424cd1dab11afe1d",
	name: "logoutDashboardSession",
	filename: "src/lib/wumpus/session.ts"
}, (opts) => logoutDashboardSession.__executeServer(opts));
var logoutDashboardSession = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(logoutDashboardSession_createServerFn_handler, async () => {
	const raw = getDashboardSessionCookie();
	const secret = sessionSecret();
	if (raw && secret) {
		const payload = await verifySession(raw, secret);
		if (payload) await closeDashboardSession(payload.sessionId);
	}
	clearDashboardSessionCookie();
	return { ok: true };
});
//#endregion
export { getOwnerGuildDiagnostics_createServerFn_handler, heartbeatDashboardSession_createServerFn_handler, logoutDashboardSession_createServerFn_handler, resolveAccess_createServerFn_handler, startSession_createServerFn_handler };
