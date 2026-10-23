import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, r as Slot, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as lazyRouteComponent, d as Scripts, f as HeadContent, g as Outlet, h as createRouter, p as useRouterState, v as createFileRoute, y as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as DialogOverlay, i as DialogDescription, n as DialogClose, o as DialogPortal, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { r as createServerFn } from "./ssr.mjs";
import { c as normalizePlan, l as planAllows, o as getStoredSessionToken, r as SESSION_TOKEN_MAX_LENGTH } from "./session-token-CaBlZnli.mjs";
import { a as number, c as string, i as literal, l as union, n as array, o as object, r as boolean, s as record, t as _enum } from "../_libs/zod.mjs";
import { i as publishInputSchema, n as moduleDefaults$2, r as presets, t as defaultsFor } from "./runtime-validation-DKjJ331C.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { $ as ArrowRight, A as LockKeyhole, G as ChevronDown, H as CircleCheck, K as Check, L as Eye, T as MessageSquareWarning, U as CircleAlert, W as ChevronRight, X as BadgeCheck, g as ShieldAlert, h as ShieldCheck, nt as Activity, o as TriangleAlert, p as Siren, t as X, x as RefreshCw, y as Search } from "../_libs/lucide-react.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/@radix-ui/react-switch+[...].mjs";
import { i as Trigger, n as List, r as Root2, t as Content } from "../_libs/radix-ui__react-tabs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-C3TeCVcz.js
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
/** Entra com o `code` do Discord e devolve um token assinado. */
var startSession = createServerFn({ method: "POST" }).validator((input) => object({
	code: string().min(1).max(2048),
	state: string().regex(/^[0-9a-f-]{36}$/i)
}).strict().parse(input)).handler(createSsrRpc("a024cd76e8fb329ddfcdb1c38889490faa45e6108c073941bd702ae77c295ec9"));
/**
* Resolve o que esta pessoa pode ver AGORA.
*
* Nao confia em nada que o cliente mandou alem do token assinado. Sem token
* valido devolve erro — nunca um acesso "vazio mas liberado".
*/
var resolveAccess = createServerFn({ method: "POST" }).validator((input) => object({ token: string().max(64).optional() }).strict().parse(input)).handler(createSsrRpc("e23c83f0285558e3636ed3183139e0c2c2047f6b3edfcabceda3510897a0ba57"));
var getOwnerGuildDiagnostics = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(createSsrRpc("c489afc464e3276614b23adecc854fd377eab555a42946d9716a8544cd8a33c3"));
var heartbeatDashboardSession = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(createSsrRpc("82dcb7d190fb62369162b71fa08803341f25217c7cc205b4bffe8de747a746d7"));
var logoutDashboardSession = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(createSsrRpc("b256f5c8d8234a219db62b31cdaabd5ffb4657f4558c521b424cd1dab11afe1d"));
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/utils-H16dNBFI.js
function cn(...inputs) {
	return twMerge(inputs.filter(Boolean).join(" "));
}
function formatRelative(ts, now = Date.now()) {
	const diff = Math.max(0, now - ts);
	const min = Math.floor(diff / 6e4);
	if (min < 1) return "agora";
	if (min < 60) return `há ${min} min`;
	const h = Math.floor(min / 60);
	if (h < 24) return `há ${h}h`;
	const d = Math.floor(h / 24);
	if (d < 7) return `há ${d}d`;
	return new Date(ts).toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "short"
	});
}
function formatTime(ts) {
	return new Date(ts).toLocaleString("pt-BR", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function uid(prefix = "id") {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
function hoursAgo(hours, from = Date.now()) {
	return from - hours * 36e5;
}
function minutesAgo(minutes, from = Date.now()) {
	return from - minutes * 6e4;
}
function initials(name) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "W";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/store-BhldozOx.js
var INVITE_RE = /(?:discord\.gg|discord\.com\/invite)\/[a-z0-9-]+/i;
var URL_RE = /https?:\/\/[^\s]+/i;
var DOMAIN_RE = /https?:\/\/(?:www\.)?([^/\s]+)/i;
function asString(v, fallback = "") {
	return typeof v === "string" ? v : fallback;
}
function asNumber(v, fallback = 0) {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asBool(v, fallback = false) {
	return typeof v === "boolean" ? v : fallback;
}
function asList(v) {
	return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function scanMessage(config, text, author) {
	const ignoredRoles = asList(config.ignoredRoleIds);
	if (author.roleIds.some((id) => ignoredRoles.includes(id))) return {
		ok: true,
		detail: "Autor ignorado (cargo da equipe)."
	};
	const trimmed = text.trim();
	const minLen = asNumber(config.minLength, 0);
	const maxLen = asNumber(config.maxLength, 0);
	if (minLen > 0 && trimmed.length < minLen) return fail("tamanho mínimo", `Mensagem com ${trimmed.length} caracteres (mínimo ${minLen}).`);
	if (maxLen > 0 && trimmed.length > maxLen) return fail("tamanho máximo", `Mensagem com ${trimmed.length} caracteres (máximo ${maxLen}).`);
	if (asBool(config.blockInvites, true) && INVITE_RE.test(text)) return fail("convite", "Convite de outro servidor detectado.");
	const blockedTerms = asList(config.blockedTerms).map((t) => t.toLowerCase()).filter(Boolean);
	const lower = text.toLowerCase();
	const hitTerm = blockedTerms.find((t) => lower.includes(t));
	if (hitTerm) return fail("termo bloqueado", `Contém “${hitTerm}”.`);
	const urlMatch = text.match(DOMAIN_RE);
	if (urlMatch) {
		const domain = urlMatch[1].toLowerCase();
		if (asList(config.blockedDomains).map((d) => d.toLowerCase()).some((d) => domain === d || domain.endsWith(`.${d}`))) return fail("domínio bloqueado", domain);
		if (asBool(config.blockLinks, false)) {
			if (!asList(config.allowedDomains).map((d) => d.toLowerCase()).some((d) => domain === d || domain.endsWith(`.${d}`))) return fail("link", `Link para ${domain} não está na lista permitida.`);
		}
	} else if (asBool(config.blockLinks, false) && URL_RE.test(text)) return fail("link", "Link detectado.");
	const mentionLimit = asNumber(config.mentionLimit, 8);
	const mentions = (text.match(/@\w+/g) ?? []).length;
	if (mentionLimit > 0 && mentions > mentionLimit) return fail("menções", `${mentions} menções (limite ${mentionLimit}).`);
	const capsPct = asNumber(config.capsThresholdPercent, 80);
	const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
	if (capsPct > 0 && capsPct < 100 && letters.length >= 8) {
		const upper = letters.replace(/[^A-ZÁÉÍÓÚÃÕÂÊÔÇ]/g, "").length;
		const pct = Math.round(upper / letters.length * 100);
		if (pct >= capsPct) return fail("caps", `${pct}% em maiúsculas (limite ${capsPct}%).`);
	}
	if (asBool(config.antiGhostPing, true)) {
		const mentions = text.match(/@[\w.]+/g) ?? [];
		const stripped = text.replace(/@[\w.]+/g, "").trim();
		if (mentions.length > 0 && stripped.length === 0) return fail("ghost ping", "Mensagem só com menções.");
	}
	return { ok: true };
	function fail(rule, detail) {
		return {
			ok: false,
			rule,
			action: asString(config.action, "delete"),
			detail
		};
	}
}
function scanBurst(config, history, userId, text, now = Date.now()) {
	const windowMs = Math.max(1, asNumber(config.windowSeconds, 10)) * 1e3;
	const mine = history.filter((m) => m.userId === userId && now - m.at <= windowMs);
	const limit = asNumber(config.messageLimit, 6);
	if (limit > 0 && mine.length + 1 > limit) return {
		ok: false,
		rule: "flood",
		action: asString(config.action, "delete"),
		detail: `${mine.length + 1} mensagens em ${asNumber(config.windowSeconds, 10)}s (limite ${limit}).`
	};
	const dupLimit = asNumber(config.duplicateLimit, 3);
	const same = mine.filter((m) => m.content.trim().toLowerCase() === text.trim().toLowerCase()).length;
	if (dupLimit > 0 && same + 1 > dupLimit) return {
		ok: false,
		rule: "duplicata",
		action: asString(config.action, "delete"),
		detail: `A mesma mensagem ${same + 1} vezes (limite ${dupLimit}).`
	};
	return null;
}
function evaluateRaid(joins, config) {
	const mode = asString(config.raidMode, "smart");
	const threshold = Math.max(2, asNumber(config.raidJoinThreshold, 12));
	const windowSec = asNumber(config.raidWindowSeconds, 60);
	if (joins < threshold) return {
		triggered: false,
		lockdown: false,
		detail: `${joins} entradas em ${windowSec}s. O limiar é ${threshold}.`
	};
	if (mode === "passive") return {
		triggered: true,
		lockdown: false,
		detail: `${joins} entradas. Modo passivo: só alerta, sem lockdown.`
	};
	const lockdown = mode === "strict" || joins >= Math.ceil(threshold * 1.5);
	return {
		triggered: true,
		lockdown,
		detail: lockdown ? `${joins} entradas em ${windowSec}s. Lockdown aplicado.` : `${joins} entradas em ${windowSec}s. Alerta enviado, sem lockdown (modo inteligente).`
	};
}
function evaluateNuke(actions, config, antiNuke) {
	const threshold = Math.max(2, asNumber(config.nukeActionThreshold, 5));
	const windowSec = asNumber(config.nukeWindowSeconds, 30);
	if (actions < threshold) return {
		triggered: false,
		lockdown: false,
		detail: `${actions} ações em ${windowSec}s. O limiar é ${threshold}.`
	};
	if (!antiNuke) return {
		triggered: true,
		lockdown: false,
		detail: `Limiar de nuke estourou, mas este plano só registra o alerta.`
	};
	return {
		triggered: true,
		lockdown: true,
		detail: `${actions} ações destrutivas em ${windowSec}s. Lockdown e incidente abertos.`
	};
}
function lastActivity(ticket) {
	return ticket.messages.reduce((max, message) => Math.max(max, message.at), ticket.createdAt);
}
function shouldAutoClose(ticket, config, now = Date.now()) {
	if (ticket.status !== "open" && ticket.status !== "claimed") return false;
	const hours = asNumber(config.autoCloseInactiveHours, 0);
	if (hours <= 0) return false;
	return now - lastActivity(ticket) >= hours * 36e5;
}
function effectiveStrikes(stored, cases, targetId, expiryDays, now = Date.now()) {
	if (expiryDays <= 0) return stored;
	const cutoff = now - expiryDays * 864e5;
	const expired = cases.filter((c) => c.targetId === targetId && c.createdAt < cutoff && (c.action === "warn" || c.action === "timeout")).length;
	return Math.max(0, stored - expired);
}
function ticketSla(ticket, config, now = Date.now()) {
	if (ticket.status === "closed" || ticket.status === "archived") return "ok";
	const minutes = asNumber(config.slaWarningMinutes, 60);
	if (minutes <= 0) return "ok";
	const elapsed = (now - ticket.createdAt) / 6e4;
	if (ticket.firstResponseAt) {
		const responseMin = (ticket.firstResponseAt - ticket.createdAt) / 6e4;
		if (responseMin > minutes * 2) return "breach";
		if (responseMin > minutes) return "warning";
		return "ok";
	}
	if (elapsed > minutes * 2) return "breach";
	if (elapsed > minutes) return "warning";
	return "ok";
}
function nextModerationAction(strikes, config) {
	const escalate = asNumber(config.escalateAfterStrikes, 3);
	const banAt = asNumber(config.maxStrikesBeforeBan, 5);
	if (strikes + 1 >= banAt) return {
		action: "ban",
		note: `Após ${banAt} advertências o membro é banido.`
	};
	if (strikes + 1 >= escalate) return {
		action: "timeout",
		note: `Após ${escalate} advertências aplica-se timeout de ${asNumber(config.defaultTimeoutMinutes, 60)} min.`
	};
	return {
		action: "warn",
		note: "Ainda abaixo do limiar de escalonamento."
	};
}
function renderTemplate(template, vars) {
	return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
function channelNameFor(pattern, username) {
	return (pattern || "atendimento-{user}").replace(/\{user\}/g, username.toLowerCase()).slice(0, 90).replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
}
var knowledgeStopwords = /* @__PURE__ */ new Set([
	"a",
	"o",
	"as",
	"os",
	"de",
	"da",
	"do",
	"das",
	"dos",
	"e",
	"em",
	"um",
	"uma",
	"para",
	"por",
	"com",
	"que",
	"como",
	"se",
	"no",
	"na",
	"nos",
	"nas",
	"ao",
	"aos",
	"the",
	"of",
	"is",
	"it",
	"to",
	"and",
	"my",
	"me",
	"eu",
	"meu",
	"minha",
	"tem",
	"voce",
	"voces",
	"posso",
	"quero",
	"fazer",
	"onde",
	"qual",
	"quais"
]);
var normalizeKnowledgeText = (value) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ");
var knowledgeTokens = (value) => normalizeKnowledgeText(value).split(/\s+/).filter((word) => word.length > 2 && !knowledgeStopwords.has(word));
function scoreKnowledgeArticle(article, query) {
	const words = knowledgeTokens(query);
	if (!words.length) return 0;
	const title = new Set(knowledgeTokens(article.title));
	const tags = new Set(article.tags.flatMap(knowledgeTokens));
	const examples = new Set((article.exampleQuestions ?? []).flatMap(knowledgeTokens));
	const category = new Set(knowledgeTokens(article.category ?? ""));
	const body = new Set(knowledgeTokens(article.body));
	return words.reduce((total, word) => total + (title.has(word) ? 3 : tags.has(word) || examples.has(word) || category.has(word) ? 2 : body.has(word) ? 1 : 0), 0) / (words.length * 3);
}
function searchArticles(query, articles, requireApproved, minScore = .25) {
	if (normalizeKnowledgeText(query.trim()).length < 2) return [];
	return articles.filter((article) => !requireApproved || article.approved).map((article) => ({
		article,
		score: scoreKnowledgeArticle(article, query)
	})).filter((result) => result.score >= minScore).sort((a, b) => b.score - a.score).map((result) => result.article);
}
/**
* Merge de defaults dos modulos.
*
* O hydrate fazia `set({ ...base, ...parsed })`. Como `parsed.modules`
* substitui `base.modules` INTEIRO, toda chave nova de padrao ficava invisivel
* para quem ja tinha estado salvo no navegador: o campo nascia so para quem
* abrisse a dashboard pela primeira vez.
*
* Foi exatamente o que aconteceu com `fields` no formulario — o construtor
* novo gravava, mas o estado antigo nao tinha a chave, entao o bot caia no
* fallback e a tela parecia nao ter efeito.
*
* Aqui o padrao entra POR BAIXO do que esta salvo: chave nova aparece, e o
* valor que o cliente configurou continua ganhando.
*/
var MODULE_KEYS = Object.keys(moduleDefaults$2);
/**
* Normaliza um servidor: todo modulo conhecido existe, com o padrao preenchido
* e o que foi salvo por cima.
*
* O merge e raso de proposito. `config` guarda listas e objetos que o cliente
* monta inteiros (as perguntas do formulario, por exemplo) — mesclar dentro
* deles produziria listas misturadas, que e pior que substituir.
*/
function mergeGuildModules(saved) {
	const out = {};
	for (const key of MODULE_KEYS) {
		const current = saved?.[key];
		out[key] = {
			enabled: current?.enabled !== false,
			config: {
				...defaultsFor(key),
				...current?.config ?? {}
			}
		};
	}
	return out;
}
/** Normaliza todos os servidores de uma vez. */
function mergeModuleDefaults(saved) {
	if (!saved) return {};
	const out = {};
	for (const [guildId, modules] of Object.entries(saved)) out[guildId] = mergeGuildModules(modules);
	return out;
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
var getDiscordGuildResources = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("606b6fe34d69f69335a74947114d4875fc638b4ec593b8d3ff8db8f8ce0c9ac0"));
var getGuildProtectionReadiness = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("71815d92c95a10dec3dab1bc883bc97d48dce18efeb200568eab00b12059a146"));
/** Uso mensal do plano, calculado no servidor e agregado pela assinatura. */
var getGuildPlanUsage = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("5c5e8c61427dd867557d23d8c3d79fdd7998d07462639b0217af5b79777a6ef9"));
var getGuildSecurityIncidents = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	limit: number().int().min(1).max(200).default(100)
}).strict().parse(input)).handler(createSsrRpc("d0386fb61e627f8b02a36730413f8ccd52802233aa1646da0aa2e141729a1871"));
var acknowledgeGuildSecurityIncident = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	eventId: number().int().positive()
}).strict().parse(input)).handler(createSsrRpc("258e1c44f287684cfbe21be25fcd1ea359b3a43f52be0a9d6488902d3fb51b00"));
var groupSchema = array(object({
	id: string().min(1).max(80),
	name: string().trim().min(1).max(80),
	guildIds: array(string().regex(/^\d{17,20}$/)).min(1).max(50),
	resourceMappings: record(string().regex(/^\d{17,20}$/), record(string().min(1).max(160), string().regex(/^\d{17,20}$/))).optional()
}).strict()).max(50);
var getServerGroups = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("c1c5b6a87876396132bce00be187b354cb998ce9a52642b9397b21619e73a017"));
var saveServerGroups = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	groups: groupSchema
}).strict().parse(input)).handler(createSsrRpc("c426bdfea4bb9fba6f4aa4c70a229423803e276176cec6424f6f0fdc75541995"));
var getGuildKnowledgeFaqSuggestions = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("30dda75f3854dd8b6ee6a130550e74ddd6b834b7554cb8af25387a60efad6ad4"));
var updateGuildKnowledgeFaqSuggestion = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	suggestionId: string().min(1).max(100),
	status: _enum(["dismissed", "converted"])
}).strict().parse(input)).handler(createSsrRpc("0a9aedbfe06e78b28ed123caf38fa2920978c412f962f7cd5172fe5cbd5cca2e"));
var publishGuildRuntime = createServerFn({ method: "POST" }).validator((input) => publishInputSchema.parse(input)).handler(createSsrRpc("30a37a9ee6e9b3f9bcacb568570cc71457d80b8808ca78d33d208fee7b93418f"));
/**
* Leitura do runtime pelo painel: NAO existe de proposito.
*
* Duas razoes concretas, ambas descobertas tentando:
*   - uma funcao comum nao pode importar `*.server.*` — o import-protection do
*     TanStack barra no bundle do cliente (so `createServerFn` atravessa);
*   - `Record<string, unknown>` nao passa no validador de serializacao dele.
*
* E nao faz falta: quem le o runtime e o bot, direto do disco. Se um dia o
* painel precisar, o caminho e declarar um tipo serializavel de verdade.
*/
/**
* Pede ao bot que publique um painel num canal de verdade.
*
* Isto substitui o `publishPanel` antigo, que so escrevia um registro no estado
* local da dashboard: a tela dizia "publicado" e nada chegava ao Discord.
*
* Aqui o pedido vai para o arquivo que o bot le. Quem publica de fato e o bot,
* porque e ele que tem conexao com o gateway — o painel roda em outro processo.
*/
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
}).strict().parse(input)).handler(createSsrRpc("b5230e82ec52d306c1c899b8f05536cf0e83719f5d257c240dc52d74cb23ad88"));
var requestSecurityRestore = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("b1afee38b841e12e71119496d9c43a906867e6b9295799889ab2fe4296f64950"));
var requestSecurityLockdown = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	enabled: boolean()
}).strict().parse(input)).handler(createSsrRpc("67674983557718382707e61482f5d459712f482f3ffddc071f57860ebd3afca6"));
var getGuildSecurityActionStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	jobId: string().min(1).max(100)
}).strict().parse(input)).handler(createSsrRpc("981427b878ee377945b2e56067005274e33d26c23d99ea703fd86d70c19f3e8b"));
/**
* Status das publicacoes recentes de um servidor.
*
* Existe para o painel parar de mentir: antes ele mostrava "publicado" no
* instante do clique, sem nada ter chegado ao Discord. Aqui o usuario ve o que
* o BOT fez de fato — incluindo o motivo da falha, quando falha.
*
* Devolve apenas campos serializaveis: o validador do TanStack recusa
* `Record<string, unknown>` cru.
*/
var getPublishStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("b9a31d924c524dddaf890676d785aa8d2a8d9127a7a46441da06dd50c4eef0e6"));
/** Real tickets are read from the bot's persisted collections, never localStorage. */
var getGuildTickets = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("b2912d9d137371b8041f72110b40a1e239d00eb9d444b1be0358ce299b84c579"));
/** Formulários recebidos de verdade pelo bot, convertidos para o modelo da caixa. */
var getGuildFormSubmissions = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict().parse(input)).handler(createSsrRpc("fe44600c6b57dae1222f424222cf46fd327679e11c94de4f51f76375d49a5145"));
/** Envia uma decisão de revisão ao processo do bot pelo runtime compartilhado. */
var requestFormReview = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	formId: number().int().positive(),
	actorId: string().regex(/^\d{17,20}$/),
	decision: _enum(["approved", "rejected"]),
	reason: string().max(500).optional()
}).strict().parse(input)).handler(createSsrRpc("cc4a9e4381f3f2d3f382e19e42aa705323334bfb602f201c612f903c009c178f"));
var getFormReviewStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	jobId: string().min(1).max(100)
}).strict().parse(input)).handler(createSsrRpc("9af265fac887a2955e3de02d1ca3ecfd4454cce0e9ce35902aa498f8816a10ea"));
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
}).parse(input)).handler(createSsrRpc("dc20c917c72887b051d7da702850b045784fb4db13fc576e57e823398f85712b"));
var getTicketActionStatus = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	jobId: string().min(1).max(100)
}).strict().parse(input)).handler(createSsrRpc("5a310377f10a793a6609a5227d479019ea4831e454e5c1d5317bba33a59172e8"));
/** Actual bot activity for the overview chart, aggregated before crossing the server boundary. */
var getGuildActivity = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	periodDays: union([
		literal(7),
		literal(30),
		literal(90)
	]).optional(),
	slaGoalMinutes: number().int().min(0).max(10080).optional()
}).strict().parse(input)).handler(createSsrRpc("91ec17e334fa434f071540e215f473cc9a206c4ed8dbc9c8b95bb1034c1ca535"));
var getGuildAudit = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	limit: number().int().min(1).max(500).default(200)
}).strict().parse(input)).handler(createSsrRpc("c0334f5407256a1465c25d9206c318c157fd8fc515e41b1efe991259a7c6c018"));
var DEMO_GUILD = "g_aurora";
var DEMO_RP = "g_nexus";
var sessionUser = {
	id: "u_luna",
	username: "luna",
	globalName: "Luna",
	isAdmin: false
};
var roles = {
	[DEMO_GUILD]: [
		{
			id: "role_owner",
			name: "Dona",
			color: "#f5d76e",
			position: 50,
			staff: true
		},
		{
			id: "role_staff",
			name: "Staff",
			color: "#7c5cff",
			position: 40,
			staff: true
		},
		{
			id: "role_suporte",
			name: "Suporte",
			color: "#5b8def",
			position: 30,
			staff: true
		},
		{
			id: "role_mod",
			name: "Moderação",
			color: "#ef5d6a",
			position: 20,
			staff: true
		},
		{
			id: "role_cliente",
			name: "Cliente",
			color: "#3ecf8e",
			position: 10
		},
		{
			id: "role_membro",
			name: "Membro",
			color: "#9aa0ad",
			position: 1
		}
	],
	[DEMO_RP]: [
		{
			id: "role_owner",
			name: "Fundação",
			color: "#f5d76e",
			position: 50,
			staff: true
		},
		{
			id: "role_staff",
			name: "Staff",
			color: "#7c5cff",
			position: 40,
			staff: true
		},
		{
			id: "role_mod",
			name: "Fiscal",
			color: "#ef5d6a",
			position: 20,
			staff: true
		},
		{
			id: "role_membro",
			name: "Cidadão",
			color: "#9aa0ad",
			position: 1
		}
	]
};
var channels = {
	[DEMO_GUILD]: [
		{
			id: "cat_info",
			name: "Informações",
			type: "category",
			parentId: null
		},
		{
			id: "ch_regras",
			name: "regras",
			type: "text",
			parentId: "cat_info"
		},
		{
			id: "ch_geral",
			name: "geral",
			type: "text",
			parentId: "cat_info"
		},
		{
			id: "cat_tickets",
			name: "Atendimento",
			type: "category",
			parentId: null
		},
		{
			id: "ch_atendimento",
			name: "abrir-ticket",
			type: "text",
			parentId: "cat_tickets"
		},
		{
			id: "ch_forms",
			name: "candidaturas",
			type: "text",
			parentId: "cat_tickets"
		},
		{
			id: "cat_staff",
			name: "Equipe",
			type: "category",
			parentId: null
		},
		{
			id: "ch_staff",
			name: "staff",
			type: "text",
			parentId: "cat_staff"
		},
		{
			id: "ch_mod",
			name: "mod-log",
			type: "text",
			parentId: "cat_staff"
		},
		{
			id: "ch_logs",
			name: "auditoria",
			type: "text",
			parentId: "cat_staff"
		},
		{
			id: "ch_transcripts",
			name: "transcrições",
			type: "text",
			parentId: "cat_staff"
		},
		{
			id: "ch_alerts",
			name: "alertas",
			type: "text",
			parentId: "cat_staff"
		}
	],
	[DEMO_RP]: [
		{
			id: "ch_geral",
			name: "cidade",
			type: "text",
			parentId: null
		},
		{
			id: "ch_atendimento",
			name: "whitelist",
			type: "text",
			parentId: null
		},
		{
			id: "ch_mod",
			name: "staff-log",
			type: "text",
			parentId: null
		},
		{
			id: "ch_logs",
			name: "auditoria",
			type: "text",
			parentId: null
		},
		{
			id: "ch_alerts",
			name: "emergencia",
			type: "text",
			parentId: null
		}
	]
};
var guilds = [{
	id: DEMO_GUILD,
	name: "Aurora Store",
	tag: "AS",
	memberCount: 1842,
	online: 214,
	plan: "pro",
	preset: "shop",
	installed: true,
	region: "Brasil"
}, {
	id: DEMO_RP,
	name: "Nexus RP",
	tag: "NX",
	memberCount: 6204,
	online: 891,
	plan: "escala",
	preset: "rp",
	installed: true,
	region: "Brasil"
}];
function modulesFor(preset) {
	const list = [
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
	const out = {};
	for (const key of list) out[key] = {
		enabled: true,
		config: defaultsFor(key)
	};
	out.tickets.config = {
		...out.tickets.config,
		panelChannelId: "ch_atendimento",
		categoryId: "cat_tickets",
		staffRoleIds: ["role_staff", "role_suporte"],
		transcriptChannelId: "ch_transcripts",
		logChannelId: "ch_logs"
	};
	out.forms.config = {
		...out.forms.config,
		reviewChannelId: "ch_forms",
		reviewerRoleIds: ["role_staff"]
	};
	out.servers.config = {
		...out.servers.config,
		announceJoinChannelId: "ch_geral",
		announceLeaveChannelId: "ch_logs"
	};
	out.roles.config = {
		...out.roles.config,
		defaultRoleIds: ["role_membro"]
	};
	out.logs.config = {
		...out.logs.config,
		channelId: "ch_logs"
	};
	if (preset === "shop") {
		out.automod.config = {
			...out.automod.config,
			blockLinks: true,
			allowedDomains: [
				"aurora.store",
				"mercadopago.com",
				"stripe.com"
			],
			slaWarningMinutes: 30
		};
		out.tickets.config = {
			...out.tickets.config,
			slaWarningMinutes: 30,
			departments: [
				"Compras",
				"Suporte",
				"Reembolso"
			]
		};
		out.security.config = {
			...out.security.config,
			raidMode: "strict",
			raidJoinThreshold: 8,
			minAccountAgeHours: 48
		};
	} else {
		out.automod.config = {
			...out.automod.config,
			action: "warn",
			capsThresholdPercent: 100,
			mentionLimit: 12
		};
		out.tickets.config = {
			...out.tickets.config,
			panelTitle: "Whitelist e denúncias",
			departments: [
				"Denúncia",
				"Whitelist",
				"Staff"
			],
			slaWarningMinutes: 45
		};
		out.security.config = {
			...out.security.config,
			raidMode: "strict",
			quarantineNewMembers: true
		};
	}
	return out;
}
var modules = {
	[DEMO_GUILD]: modulesFor("shop"),
	[DEMO_RP]: modulesFor("rp")
};
var members = [
	m(DEMO_GUILD, "u_luna", "luna", "Luna", 262, ["role_owner", "role_staff"], 400, "online", 0),
	m(DEMO_GUILD, "u_theo", "theo", "Theo", 210, ["role_staff", "role_suporte"], 280, "online", 0),
	m(DEMO_GUILD, "u_maya", "maya", "Maya", 330, ["role_staff"], 210, "idle", 0),
	m(DEMO_GUILD, "u_rico", "rico", "Rico", 12, ["role_mod"], 180, "dnd", 0),
	m(DEMO_GUILD, "u_bia", "bia", "Bia", 140, ["role_cliente", "role_membro"], 90, "online", 0),
	m(DEMO_GUILD, "u_davi", "davi", "Davi", 28, ["role_membro"], 40, "online", 2),
	m(DEMO_GUILD, "u_nanda", "nanda", "Nanda", 300, ["role_cliente", "role_membro"], 70, "offline", 0),
	m(DEMO_GUILD, "u_kai", "kai", "Kai", 18, ["role_membro"], 12, "online", 4),
	m(DEMO_RP, "u_luna", "luna", "Luna", 262, ["role_owner", "role_staff"], 800, "online", 0),
	m(DEMO_RP, "u_gael", "gael", "Gael", 190, ["role_staff"], 120, "online", 0),
	m(DEMO_RP, "u_iris", "iris", "Íris", 40, ["role_membro"], 20, "idle", 1)
];
function m(guildId, id, username, displayName, hue, roleIds, joinedDaysAgo, status, strikes) {
	return {
		id,
		guildId,
		username,
		displayName,
		hue,
		roleIds,
		joinedAt: hoursAgo(joinedDaysAgo * 24),
		strikes,
		status,
		accountCreatedAt: hoursAgo((joinedDaysAgo + 200) * 24),
		timedOutUntil: null,
		banned: false
	};
}
var tickets = [
	{
		id: "t_101",
		guildId: DEMO_GUILD,
		number: 184,
		openerId: "u_bia",
		claimedBy: null,
		department: "Compras",
		subject: "Pagamento aprovado, produto não liberado",
		status: "open",
		priority: "urgent",
		tags: ["produto", "liberação"],
		channelName: "atendimento-bia",
		createdAt: minutesAgo(95),
		firstResponseAt: null,
		closedAt: null,
		transcript: null,
		feedback: null,
		messages: [msg("u_bia", "user", "Paguei o pack Aurora Pro há 2 horas e o cargo não caiu. Comprovante no e-mail.", minutesAgo(95)), msg("system", "system", "Ticket aberto no departamento Compras. SLA 30 min.", minutesAgo(95))]
	},
	{
		id: "t_102",
		guildId: DEMO_GUILD,
		number: 185,
		openerId: "u_nanda",
		claimedBy: "u_theo",
		department: "Suporte",
		subject: "Não consigo acessar o painel do produto",
		status: "claimed",
		priority: "high",
		tags: ["acesso"],
		channelName: "atendimento-nanda",
		createdAt: minutesAgo(40),
		firstResponseAt: minutesAgo(28),
		closedAt: null,
		transcript: null,
		feedback: null,
		messages: [
			msg("u_nanda", "user", "O login da área de membros volta erro 403.", minutesAgo(40)),
			msg("system", "system", "Theo assumiu o atendimento.", minutesAgo(28)),
			msg("u_theo", "staff", "Vi aqui — o e-mail da compra está diferente do Discord. Me confirma o e-mail usado no checkout?", minutesAgo(28)),
			msg("u_nanda", "user", "Usei nanda.loja@gmail.com", minutesAgo(18))
		]
	},
	{
		id: "t_103",
		guildId: DEMO_GUILD,
		number: 176,
		openerId: "u_davi",
		claimedBy: "u_maya",
		department: "Reembolso",
		subject: "Quero reembolso da chave errada",
		status: "closed",
		priority: "normal",
		tags: ["reembolso"],
		channelName: "atendimento-davi",
		createdAt: hoursAgo(30),
		firstResponseAt: hoursAgo(29.4),
		closedAt: hoursAgo(26),
		transcript: "Davi: Comprei a chave e veio de outro jogo.\nMaya: Vou reemitir. Pedido #A-2041.\nDavi: Recebi, obrigado.",
		feedback: {
			rating: 5,
			comment: "Rápido e sem enrolação."
		},
		messages: [
			msg("u_davi", "user", "Comprei a chave e veio de outro jogo.", hoursAgo(30)),
			msg("u_maya", "staff", "Vou reemitir. Pedido #A-2041.", hoursAgo(29.4)),
			msg("u_davi", "user", "Recebi, obrigado.", hoursAgo(27)),
			msg("system", "system", "Atendimento encerrado por Maya. Transcrição enviada.", hoursAgo(26))
		]
	},
	{
		id: "t_104",
		guildId: DEMO_GUILD,
		number: 162,
		openerId: "u_kai",
		claimedBy: "u_rico",
		department: "Suporte",
		subject: "Cargo de cliente sumiu",
		status: "archived",
		priority: "low",
		tags: ["cargo"],
		channelName: "atendimento-kai",
		createdAt: hoursAgo(90),
		firstResponseAt: hoursAgo(88),
		closedAt: hoursAgo(80),
		transcript: "Kai: Perdi o cargo.\nRico: Reapliquei o cargo Cliente.",
		feedback: {
			rating: 3,
			comment: "Resolveu, demorou um pouco."
		},
		messages: [
			msg("u_kai", "user", "Perdi o cargo de cliente depois de sair e voltar.", hoursAgo(90)),
			msg("u_rico", "staff", "Reapliquei o cargo Cliente.", hoursAgo(88)),
			msg("system", "system", "Arquivado automaticamente após 7 dias.", hoursAgo(10))
		]
	},
	{
		id: "t_201",
		guildId: DEMO_RP,
		number: 44,
		openerId: "u_iris",
		claimedBy: null,
		department: "Whitelist",
		subject: "Pedido de whitelist",
		status: "open",
		priority: "normal",
		tags: ["wl"],
		channelName: "atendimento-iris",
		createdAt: minutesAgo(50),
		firstResponseAt: null,
		closedAt: null,
		transcript: null,
		feedback: null,
		messages: [msg("u_iris", "user", "Quero entrar na cidade. Já li as regras.", minutesAgo(50)), msg("system", "system", "Ticket aberto no departamento Whitelist.", minutesAgo(50))]
	}
];
function msg(authorId, kind, content, at) {
	return {
		id: uid("m"),
		authorId,
		kind,
		content,
		at
	};
}
var formQuestions = {
	[DEMO_GUILD]: [
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
	],
	[DEMO_RP]: [
		{
			id: "q1",
			label: "Idade e fuso horário",
			required: true
		},
		{
			id: "q2",
			label: "História do personagem (curta)",
			required: true
		},
		{
			id: "q3",
			label: "Já jogou em outra cidade? Qual?",
			required: false
		}
	]
};
var submissions = [
	{
		id: "s_1",
		guildId: DEMO_GUILD,
		userId: "u_bia",
		answers: {
			q1: "Bia",
			q2: "Já atendo a loja como cliente há 8 meses e quero ajudar no suporte.",
			q3: "Dois anos de Discord staff em servidor de 3k."
		},
		status: "pending",
		createdAt: hoursAgo(6),
		reviewedAt: null,
		reviewerId: null,
		reason: "",
		aiNote: null
	},
	{
		id: "s_2",
		guildId: DEMO_GUILD,
		userId: "u_davi",
		answers: {
			q1: "Davi",
			q2: "Quero o cargo de staff.",
			q3: "Nenhuma."
		},
		status: "pending",
		createdAt: hoursAgo(20),
		reviewedAt: null,
		reviewerId: null,
		reason: "",
		aiNote: "Pouca substância nas respostas. Sem evidência de experiência. Sugerir rejeitar com pedido para tentar de novo em 30 dias."
	},
	{
		id: "s_3",
		guildId: DEMO_GUILD,
		userId: "u_nanda",
		answers: {
			q1: "Nanda",
			q2: "Posso cobrir o plantão da madrugada e já vendi no Mercado Livre.",
			q3: "Atendimento em e-commerce, 4 anos."
		},
		status: "approved",
		createdAt: hoursAgo(80),
		reviewedAt: hoursAgo(70),
		reviewerId: "u_luna",
		reason: "Perfil forte para compras. Cargo Suporte aplicado.",
		aiNote: null
	},
	{
		id: "s_4",
		guildId: DEMO_RP,
		userId: "u_iris",
		answers: {
			q1: "19, GMT-3",
			q2: "Médica civil, formada na Cruz Vermelha da cidade.",
			q3: "Sim, Harmony RP por 6 meses."
		},
		status: "pending",
		createdAt: hoursAgo(3),
		reviewedAt: null,
		reviewerId: null,
		reason: "",
		aiNote: null
	}
];
var cases = [
	{
		id: "c_1",
		guildId: DEMO_GUILD,
		targetId: "u_kai",
		actorId: "u_rico",
		action: "warn",
		reason: "Divulgação de loja concorrente no #geral.",
		evidence: "Print da mensagem com link.",
		createdAt: hoursAgo(8)
	},
	{
		id: "c_2",
		guildId: DEMO_GUILD,
		targetId: "u_kai",
		actorId: "u_rico",
		action: "warn",
		reason: "Reincidência: convite de servidor.",
		evidence: "discord.gg/xxxx",
		createdAt: hoursAgo(5)
	},
	{
		id: "c_3",
		guildId: DEMO_GUILD,
		targetId: "u_davi",
		actorId: "u_maya",
		action: "timeout",
		reason: "Flood de menções após aviso.",
		evidence: "6 mensagens em 20s",
		createdAt: hoursAgo(14),
		durationMinutes: 60
	}
];
var automodHits = [{
	id: "h_1",
	guildId: DEMO_GUILD,
	userId: "u_kai",
	content: "entra no meu server discord.gg/nitrofree",
	rule: "convite",
	action: "delete",
	at: hoursAgo(5)
}, {
	id: "h_2",
	guildId: DEMO_GUILD,
	userId: "u_davi",
	content: "FREE NITRO GEN!!!!",
	rule: "termo bloqueado",
	action: "delete",
	at: hoursAgo(14)
}];
var incidents = [{
	id: "i_1",
	guildId: DEMO_GUILD,
	kind: "raid",
	title: "Pico de entradas",
	detail: "9 contas com menos de 2 dias em 40 segundos. Quarentena aplicada em 4.",
	status: "contained",
	at: hoursAgo(36)
}, {
	id: "i_2",
	guildId: DEMO_RP,
	kind: "nuke",
	title: "Tentativa de apagar canais",
	detail: "Cargo mal configurado em um bot de música. Revertido, cargo removido.",
	status: "closed",
	at: hoursAgo(120)
}];
var articles = [
	{
		id: "a_1",
		guildId: DEMO_GUILD,
		title: "Como recebo o produto depois do pagamento?",
		body: "O cargo Cliente é aplicado automaticamente em até 5 minutos. Se não cair, abra um ticket em Compras com o e-mail da nota.",
		tags: ["compras", "produto"],
		approved: true,
		updatedAt: hoursAgo(40)
	},
	{
		id: "a_2",
		guildId: DEMO_GUILD,
		title: "Política de reembolso",
		body: "Reembolso integral em até 7 dias se a chave não foi resgatada. Depois disso, avaliamos caso a caso no departamento Reembolso.",
		tags: ["reembolso"],
		approved: true,
		updatedAt: hoursAgo(200)
	},
	{
		id: "a_3",
		guildId: DEMO_GUILD,
		title: "Horário da equipe",
		body: "Plantão das 10h às 22h (Brasília), segunda a sábado. Fora disso o ticket fica na fila e o SLA pausa.",
		tags: ["equipe"],
		approved: true,
		updatedAt: hoursAgo(10)
	},
	{
		id: "a_4",
		guildId: DEMO_RP,
		title: "Como fazer whitelist",
		body: "Abra um ticket em Whitelist, envie idade, história curta e disponibilidade. Resposta em até 24h.",
		tags: ["whitelist"],
		approved: true,
		updatedAt: hoursAgo(12)
	}
];
var logs = [
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: minutesAgo(5),
		actor: "Wumpus",
		category: "automod",
		summary: "Mensagem apagada em #geral (convite)."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: minutesAgo(28),
		actor: "Theo",
		category: "tickets",
		summary: "Assumiu o ticket #185."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: minutesAgo(95),
		actor: "Bia",
		category: "tickets",
		summary: "Abriu ticket #184 em Compras."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: hoursAgo(5),
		actor: "Rico",
		category: "moderation",
		summary: "Advertência em Kai — convite."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: hoursAgo(6),
		actor: "Bia",
		category: "forms",
		summary: "Enviou candidatura à equipe."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: hoursAgo(14),
		actor: "Maya",
		category: "moderation",
		summary: "Timeout de 60 min em Davi."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: hoursAgo(26),
		actor: "Maya",
		category: "tickets",
		summary: "Encerrou #176 e publicou transcrição."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: hoursAgo(36),
		actor: "Wumpus",
		category: "security",
		summary: "Incidente de raid contido."
	},
	{
		id: uid("l"),
		guildId: DEMO_GUILD,
		at: hoursAgo(70),
		actor: "Luna",
		category: "forms",
		summary: "Aprovou candidatura de Nanda."
	}
];
var dashboardMembers = [
	{
		id: "u_luna",
		username: "luna",
		role: "owner",
		addedAt: hoursAgo(900)
	},
	{
		id: "u_theo",
		username: "theo",
		role: "admin",
		addedAt: hoursAgo(400)
	},
	{
		id: "u_maya",
		username: "maya",
		role: "viewer",
		addedAt: hoursAgo(200)
	}
];
var licenses = [{
	id: "lic_1",
	guildName: "Aurora Store",
	plan: "pro",
	seats: 5,
	expires: "2026-12-01",
	status: "active"
}, {
	id: "lic_2",
	guildName: "Nexus RP",
	plan: "escala",
	seats: 8,
	expires: "2027-03-12",
	status: "active"
}];
function cloneSeed() {
	return {
		guilds: structuredClone(guilds),
		members: structuredClone(members),
		tickets: structuredClone(tickets),
		formQuestions: structuredClone(formQuestions),
		submissions: structuredClone(submissions),
		cases: structuredClone(cases),
		automodHits: structuredClone(automodHits),
		incidents: structuredClone(incidents),
		articles: structuredClone(articles),
		logs: structuredClone(logs),
		modules: structuredClone(modules),
		channels: structuredClone(channels),
		roles: structuredClone(roles),
		dashboardMembers: structuredClone(dashboardMembers),
		licenses: structuredClone(licenses),
		sessionUser: { ...sessionUser }
	};
}
var KEY = "wumpus-demo-v2";
var THEME_KEY_PREFIX = "wumpus-theme-v1:";
function pick(s) {
	return {
		activeGuildId: s.activeGuildId,
		guilds: s.guilds,
		members: s.members,
		tickets: s.tickets,
		formQuestions: s.formQuestions,
		submissions: s.submissions,
		cases: s.cases,
		automodHits: s.automodHits,
		incidents: s.incidents,
		articles: s.articles,
		logs: s.logs,
		modules: s.modules,
		channels: s.channels,
		roles: s.roles,
		dashboardMembers: s.dashboardMembers,
		licenses: s.licenses,
		posts: s.posts,
		publishQueue: s.publishQueue,
		recentMessages: s.recentMessages,
		sessionUser: s.sessionUser,
		theme: s.theme
	};
}
function seedSlice() {
	return {
		...cloneSeed(),
		activeGuildId: DEMO_GUILD,
		theme: "system",
		posts: [],
		publishQueue: [],
		recentMessages: []
	};
}
function persist(slice) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(KEY, JSON.stringify(slice));
	} catch {}
}
var useWumpus = create((set, get) => {
	/** Ultimo objeto de módulos publicado — evita republicar sem mudança real. */
	let publishedModules = null;
	let publishedArticles = null;
	let publishedGuildId = "";
	let publishRevision = 0;
	let publishQueue = Promise.resolve();
	let authorizedGuildIds = null;
	let accessRefreshPending = false;
	/**
	* Publica a config do servidor ativo para o bot ler.
	*
	* O bot é outro processo: sem esta publicação ele nunca vê o que o painel
	* salva, e todo campo vira decoração. Falha de rede aqui não pode quebrar a
	* interface — o painel segue funcionando e tenta de novo na próxima mudança.
	*/
	const publishModules = (state) => {
		const guildId = state.activeGuildId;
		const modules = state.modules[guildId];
		const token = getStoredSessionToken();
		if (!guildId || !modules || !token || !authorizedGuildIds?.has(guildId)) return;
		if (state.modules === publishedModules && state.articles === publishedArticles && guildId === publishedGuildId) return;
		publishedModules = state.modules;
		publishedArticles = state.articles;
		publishedGuildId = guildId;
		const revision = ++publishRevision;
		const payload = {};
		for (const [key, value] of Object.entries(modules)) {
			if (!value) continue;
			payload[key] = {
				...value.config ?? {},
				enabled: value.enabled !== false
			};
		}
		set({
			runtimeSyncStatus: "syncing",
			runtimeSyncError: null
		});
		const request = { data: {
			token,
			guildId,
			name: state.guilds.find((g) => g.id === guildId)?.name,
			modules: payload,
			articles: state.articles.filter((article) => article.guildId === guildId).map((article) => ({
				id: article.id,
				title: article.title,
				body: article.body,
				tags: article.tags,
				category: article.category,
				exampleQuestions: article.exampleQuestions,
				approved: article.approved
			}))
		} };
		publishQueue = publishQueue.then(() => publishGuildRuntime(request)).then(() => {
			if (revision === publishRevision) set({
				runtimeSyncStatus: "synced",
				runtimeSyncError: null
			});
		}).catch((error) => {
			console.error("Não foi possível sincronizar a configuração com o bot.", error);
			if (revision !== publishRevision) return;
			const detail = error instanceof Error ? error.message : "erro desconhecido";
			set({
				runtimeSyncStatus: "failed",
				runtimeSyncError: `A configuração ficou salva no navegador, mas não chegou ao bot. ${/permiss|403|50013/i.test(detail) ? "Confira as permissões do Wumpus no servidor." : /inválid|invalid|módulo|configuração/i.test(detail) ? "Revise os campos da configuração e tente novamente." : "Verifique a conexão com o servidor e tente alterar ou salvar a configuração novamente."} (${detail})`
			});
			publishedModules = null;
			publishedArticles = null;
			publishedGuildId = "";
		});
	};
	const refreshAuthorizedGuilds = async () => {
		if (accessRefreshPending) return;
		accessRefreshPending = true;
		authorizedGuildIds = /* @__PURE__ */ new Set();
		const token = getStoredSessionToken();
		if (!token) {
			accessRefreshPending = false;
			return;
		}
		try {
			const access = await resolveAccess({ data: { token } });
			if (!access.ok) {
				set({ sessionUser: {
					...get().sessionUser,
					isAdmin: false
				} });
				persist(pick(get()));
				console.error(`Não foi possível validar o acesso ao dashboard: ${access.error}`);
				return;
			}
			const guildIds = new Set(access.entitlements.guildIds);
			authorizedGuildIds = guildIds;
			const current = get();
			const guilds = current.guilds.filter((guild) => guildIds.has(guild.id));
			const activeGuildId = guildIds.has(current.activeGuildId) ? current.activeGuildId : guilds[0]?.id ?? "";
			set({
				guilds,
				activeGuildId,
				sessionUser: {
					...current.sessionUser,
					isAdmin: access.entitlements.isOwner
				}
			});
			persist(pick(get()));
			publishModules(get());
			refreshGuildResources(activeGuildId);
		} catch (error) {
			console.error("Não foi possível validar o acesso; a configuração não foi sincronizada.", error);
		} finally {
			accessRefreshPending = false;
		}
	};
	const refreshGuildResources = async (guildId) => {
		const token = getStoredSessionToken();
		if (!token || !guildId) return;
		try {
			const resources = await getDiscordGuildResources({ data: {
				token,
				guildId
			} });
			if (get().activeGuildId !== guildId) return;
			const current = get();
			const channels = resources.channels.map((channel) => ({
				...channel,
				parentId: null
			}));
			const roles = resources.roles.map((role) => ({
				...role,
				staff: false
			}));
			set({
				channels: {
					...current.channels,
					[guildId]: channels
				},
				roles: {
					...current.roles,
					[guildId]: roles
				}
			});
			persist(pick(get()));
		} catch (error) {
			console.error("Não foi possível carregar os canais e cargos deste servidor.", error);
		}
	};
	const write = (partial) => {
		set(partial);
		const state = get();
		persist(pick(state));
		publishModules(state);
	};
	const audit = (category, summary, actor) => {
		const state = get();
		const event = {
			id: uid("l"),
			guildId: state.activeGuildId,
			at: Date.now(),
			actor: actor ?? state.sessionUser.globalName,
			category,
			summary
		};
		write({ logs: [event, ...state.logs].slice(0, 200) });
	};
	const cfg = (module) => {
		const state = get();
		return state.modules[state.activeGuildId]?.[module] ?? {
			enabled: true,
			config: defaultsFor(module)
		};
	};
	return {
		...seedSlice(),
		hydrated: false,
		runtimeSyncStatus: "idle",
		runtimeSyncError: null,
		hydrate: () => {
			if (typeof window === "undefined") {
				set({ hydrated: true });
				return;
			}
			try {
				const raw = localStorage.getItem(KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					if (parsed && parsed.modules && parsed.tickets && parsed.guilds) {
						const base = seedSlice();
						const guilds = (parsed.guilds ?? base.guilds).map((g) => ({
							...g,
							plan: normalizePlan(g.plan)
						}));
						const licenses = (parsed.licenses ?? base.licenses).map((l) => ({
							...l,
							plan: normalizePlan(l.plan)
						}));
						const sessionUser = {
							...parsed.sessionUser ?? base.sessionUser,
							isAdmin: false
						};
						let theme = parsed.theme === "dark" || parsed.theme === "light" || parsed.theme === "system" ? parsed.theme : "system";
						try {
							const savedTheme = localStorage.getItem(`${THEME_KEY_PREFIX}${sessionUser.id}`);
							if (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system") theme = savedTheme;
						} catch (error) {
							console.error("Não foi possível carregar a preferência de tema.", error);
						}
						const modules = mergeModuleDefaults({
							...base.modules,
							...parsed.modules ?? {}
						});
						set({
							...base,
							...parsed,
							guilds,
							licenses,
							modules,
							sessionUser,
							theme,
							posts: parsed.posts ?? [],
							publishQueue: parsed.publishQueue ?? [],
							recentMessages: parsed.recentMessages ?? [],
							hydrated: true
						});
						document.documentElement.dataset.theme = theme;
						refreshAuthorizedGuilds();
						return;
					}
				}
			} catch {}
			document.documentElement.dataset.theme = "system";
			set({ hydrated: true });
			refreshAuthorizedGuilds();
		},
		resetDemo: () => {
			const next = seedSlice();
			write({ ...next });
			set({ hydrated: true });
			document.documentElement.dataset.theme = "system";
			audit("admin", "Demonstração restaurada ao estado inicial.", "Admin");
		},
		setTheme: (theme) => {
			document.documentElement.dataset.theme = theme;
			set({ theme });
			persist(pick(get()));
			const userId = get().sessionUser.id;
			if (typeof window !== "undefined" && userId) try {
				localStorage.setItem(`${THEME_KEY_PREFIX}${userId}`, theme);
			} catch (error) {
				console.error("Não foi possível salvar a preferência de tema.", error);
			}
		},
		setActiveGuild: (id) => {
			write({ activeGuildId: id });
			refreshGuildResources(id);
		},
		setAdmin: (on) => {
			const current = get().sessionUser;
			if (on && !current.isAdmin) return;
			write({ sessionUser: {
				...current,
				isAdmin: on && current.isAdmin
			} });
		},
		updateConfig: (module, patch) => {
			const state = get();
			const current = cfg(module);
			const nextModules = {
				...state.modules,
				[state.activeGuildId]: {
					...state.modules[state.activeGuildId],
					[module]: {
						...current,
						config: {
							...current.config,
							...patch
						}
					}
				}
			};
			write({ modules: nextModules });
			audit(module, `Configuração de ${module} atualizada.`);
		},
		setModuleEnabled: (module, enabled) => {
			const state = get();
			const current = cfg(module);
			write({ modules: {
				...state.modules,
				[state.activeGuildId]: {
					...state.modules[state.activeGuildId],
					[module]: {
						...current,
						enabled
					}
				}
			} });
			audit(module, enabled ? `Módulo ${module} ligado.` : `Módulo ${module} pausado.`);
		},
		applyPreset: (preset) => {
			const state = get();
			const gid = state.activeGuildId;
			const current = state.modules[gid];
			const patch = presets[preset].patch;
			const next = { ...current };
			for (const key of Object.keys(patch)) {
				const p = patch[key];
				if (!p) continue;
				next[key] = {
					...next[key],
					config: {
						...next[key].config,
						...p
					}
				};
			}
			write({
				modules: {
					...state.modules,
					[gid]: next
				},
				guilds: state.guilds.map((g) => g.id === gid ? {
					...g,
					preset
				} : g)
			});
			audit("protect", `Preset “${presets[preset].label}” aplicado.`);
		},
		openTicket: ({ openerId, department, subject, body }) => {
			const state = get();
			const tcfg = cfg("tickets");
			if (!tcfg.enabled) return {
				ok: false,
				error: "O atendimento está pausado neste servidor."
			};
			const maxOpen = Number(tcfg.config.maxOpenPerUser ?? 1);
			if (state.tickets.filter((t) => t.guildId === state.activeGuildId && t.openerId === openerId && (t.status === "open" || t.status === "claimed")).length >= maxOpen) return {
				ok: false,
				error: `Limite de ${maxOpen} atendimento(s) aberto(s) por pessoa.`
			};
			const opener = state.members.find((m) => m.id === openerId && m.guildId === state.activeGuildId);
			const name = opener?.username ?? "membro";
			const pattern = String(tcfg.config.namingPattern ?? "atendimento-{user}");
			const numbers = state.tickets.filter((t) => t.guildId === state.activeGuildId).map((t) => t.number);
			const number = (numbers.length ? Math.max(...numbers) : 100) + 1;
			const welcome = String(tcfg.config.welcomeMessage ?? "");
			const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
			const departments = Array.isArray(tcfg.config.departments) ? tcfg.config.departments.filter((x) => typeof x === "string" && x.trim().length > 0) : [];
			const dept = planAllows(plan, "multiDepartment") ? department : departments[0] ?? department;
			const ticket = {
				id: uid("t"),
				guildId: state.activeGuildId,
				number,
				openerId,
				claimedBy: null,
				department: dept,
				subject,
				status: "open",
				priority: "normal",
				tags: [],
				channelName: channelNameFor(pattern, name),
				createdAt: Date.now(),
				firstResponseAt: null,
				closedAt: null,
				transcript: null,
				feedback: null,
				messages: [{
					id: uid("m"),
					authorId: openerId,
					content: body,
					at: Date.now(),
					kind: "user"
				}, {
					id: uid("m"),
					authorId: "system",
					content: welcome || `Atendimento #${number} aberto em ${dept}.`,
					at: Date.now() + 1,
					kind: "system"
				}]
			};
			write({ tickets: [ticket, ...state.tickets] });
			audit("tickets", `Abriu ticket #${number} em ${dept}.`, opener?.displayName ?? "Membro");
			return {
				ok: true,
				id: ticket.id
			};
		},
		claimTicket: (id, staffId) => {
			const state = get();
			const ticket = state.tickets.find((t) => t.id === id);
			if (!ticket) return {
				ok: false,
				error: "Ticket não encontrado."
			};
			const staff = state.members.find((m) => m.id === staffId);
			const max = Number(cfg("staff").config.maxConcurrentTickets ?? 5);
			if (state.tickets.filter((t) => t.guildId === state.activeGuildId && t.claimedBy === staffId && (t.status === "open" || t.status === "claimed")).length >= max) return {
				ok: false,
				error: `${staff?.displayName ?? "Staff"} já está com ${max} atendimentos.`
			};
			write({ tickets: state.tickets.map((t) => t.id === id ? {
				...t,
				status: "claimed",
				claimedBy: staffId,
				firstResponseAt: t.firstResponseAt ?? Date.now(),
				messages: [...t.messages, {
					id: uid("m"),
					authorId: "system",
					content: `${staff?.displayName ?? "Staff"} assumiu o atendimento.`,
					at: Date.now(),
					kind: "system"
				}]
			} : t) });
			audit("tickets", `Assumiu o ticket #${ticket.number}.`, staff?.displayName);
			return { ok: true };
		},
		addTicketMessage: (id, authorId, content, kind) => {
			const state = get();
			write({ tickets: state.tickets.map((t) => {
				if (t.id !== id) return t;
				const firstResponseAt = t.firstResponseAt ?? (kind === "staff" ? Date.now() : t.firstResponseAt);
				return {
					...t,
					firstResponseAt,
					messages: [...t.messages, {
						id: uid("m"),
						authorId,
						content,
						at: Date.now(),
						kind
					}]
				};
			}) });
		},
		closeTicket: (id, staffId, withFeedback) => {
			const state = get();
			const ticket = state.tickets.find((t) => t.id === id);
			if (!ticket) return;
			const staff = state.members.find((m) => m.id === staffId);
			const transcript = ticket.messages.map((m) => {
				return `${m.kind === "system" ? "Sistema" : state.members.find((x) => x.id === m.authorId)?.displayName ?? m.authorId}: ${m.content}`;
			}).join("\n");
			const channelId = String(cfg("tickets").config.transcriptChannelId ?? "ch_transcripts");
			const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
			const withTranscript = planAllows(plan, "transcripts");
			const post = withTranscript ? {
				id: uid("p"),
				guildId: state.activeGuildId,
				channelId,
				author: "Wumpus",
				content: `Transcrição #${ticket.number} — ${ticket.subject}\n${transcript}`,
				at: Date.now()
			} : null;
			write({
				posts: post ? [post, ...state.posts].slice(0, 60) : state.posts,
				tickets: state.tickets.map((t) => t.id === id ? {
					...t,
					status: "closed",
					closedAt: Date.now(),
					transcript,
					feedback: withFeedback ?? t.feedback,
					messages: [...t.messages, {
						id: uid("m"),
						authorId: "system",
						content: withTranscript ? `Encerrado por ${staff?.displayName ?? "staff"}. Transcrição enviada para o canal configurado.` : `Encerrado por ${staff?.displayName ?? "staff"}. Transcrição automática é do plano Pro.`,
						at: Date.now(),
						kind: "system"
					}]
				} : t)
			});
			audit("tickets", `Encerrou #${ticket.number} e publicou transcrição.`, staff?.displayName);
		},
		archiveTicket: (id) => {
			const state = get();
			write({ tickets: state.tickets.map((t) => t.id === id ? {
				...t,
				status: "archived"
			} : t) });
			audit("tickets", "Ticket arquivado.");
		},
		reopenTicket: (id) => {
			if (!cfg("tickets").config.reopenEnabled) return;
			const state = get();
			write({ tickets: state.tickets.map((t) => t.id === id ? {
				...t,
				status: "open",
				closedAt: null,
				messages: [...t.messages, {
					id: uid("m"),
					authorId: "system",
					content: "Atendimento reaberto.",
					at: Date.now(),
					kind: "system"
				}]
			} : t) });
			audit("tickets", "Ticket reaberto.");
		},
		setTicketPriority: (id, priority) => {
			if (!cfg("tickets").config.priorityEnabled) return;
			write({ tickets: get().tickets.map((t) => t.id === id ? {
				...t,
				priority
			} : t) });
		},
		setTicketTags: (id, tags) => {
			write({ tickets: get().tickets.map((t) => t.id === id ? {
				...t,
				tags
			} : t) });
		},
		setQuestions: (questions) => {
			const state = get();
			write({ formQuestions: {
				...state.formQuestions,
				[state.activeGuildId]: questions
			} });
			write({ modules: {
				...get().modules,
				[state.activeGuildId]: {
					...get().modules[state.activeGuildId],
					forms: {
						...cfg("forms"),
						config: {
							...cfg("forms").config,
							questions: questions.map((q) => q.label)
						}
					}
				}
			} });
			audit("forms", "Perguntas do formulário atualizadas.");
		},
		setFormFields: (fields) => {
			const state = get();
			const forms = cfg("forms");
			write({
				modules: {
					...state.modules,
					[state.activeGuildId]: {
						...state.modules[state.activeGuildId],
						forms: {
							...forms,
							config: {
								...forms.config,
								fields
							}
						}
					}
				},
				formQuestions: {
					...state.formQuestions,
					[state.activeGuildId]: fields.map((field) => ({
						id: field.id,
						label: field.label,
						required: field.required
					}))
				}
			});
			audit("forms", "Formulário atualizado.");
		},
		submitForm: (userId, answers) => {
			const state = get();
			const fcfg = cfg("forms");
			if (!fcfg.enabled) return {
				ok: false,
				error: "As candidaturas estão pausadas."
			};
			const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
			if (!planAllows(plan, "forms")) return {
				ok: false,
				error: "O plano Comunidade não inclui candidaturas."
			};
			const cooldownH = Number(fcfg.config.cooldownHours ?? 24);
			if (state.submissions.find((s) => s.guildId === state.activeGuildId && s.userId === userId && Date.now() - s.createdAt < cooldownH * 36e5)) return {
				ok: false,
				error: `Aguarde ${cooldownH}h entre envios.`
			};
			const max = Number(fcfg.config.maxSubmissionsPerUser ?? 3);
			if (state.submissions.filter((s) => s.guildId === state.activeGuildId && s.userId === userId).length >= max) return {
				ok: false,
				error: "Limite de envios atingido."
			};
			const member = state.members.find((m) => m.id === userId && m.guildId === state.activeGuildId);
			const minDays = Number(fcfg.config.minAccountAgeDays ?? 0);
			if (member && minDays > 0) {
				if ((Date.now() - member.accountCreatedAt) / 864e5 < minDays) return {
					ok: false,
					error: `Conta precisa ter ${minDays} dia(s).`
				};
			}
			const sub = {
				id: uid("s"),
				guildId: state.activeGuildId,
				userId,
				answers,
				status: "pending",
				createdAt: Date.now(),
				reviewedAt: null,
				reviewerId: null,
				reason: "",
				aiNote: null
			};
			write({ submissions: [sub, ...state.submissions] });
			audit("forms", "Nova candidatura recebida.", member?.displayName);
			return { ok: true };
		},
		reviewForm: (id, status, reason, reviewerId) => {
			const fcfg = cfg("forms");
			if (status === "rejected" && fcfg.config.requireReasonOnReject && !reason.trim()) return {
				ok: false,
				error: "Informe o motivo da recusa."
			};
			const state = get();
			write({ submissions: state.submissions.map((s) => s.id === id ? {
				...s,
				status,
				reason,
				reviewerId,
				reviewedAt: Date.now()
			} : s) });
			audit("forms", status === "approved" ? "Candidatura aprovada." : `Candidatura recusada: ${reason}`);
			return { ok: true };
		},
		setSubmissionAiNote: (id, note) => {
			write({ submissions: get().submissions.map((s) => s.id === id ? {
				...s,
				aiNote: note
			} : s) });
		},
		punish: ({ targetId, actorId, action, reason, evidence, durationMinutes }) => {
			const state = get();
			const mcfg = cfg("moderation");
			if (!mcfg.enabled) return {
				ok: false,
				error: "Moderação pausada."
			};
			if (mcfg.config.requireEvidence && !evidence.trim()) return {
				ok: false,
				error: "Evidência obrigatória neste servidor."
			};
			if (mcfg.config.requireReason !== false && !reason.trim() && cfg("staff").config.requireReason) return {
				ok: false,
				error: "Motivo obrigatório."
			};
			const target = state.members.find((m) => m.id === targetId && m.guildId === state.activeGuildId);
			if (!target) return {
				ok: false,
				error: "Membro não encontrado."
			};
			if (action === "pardon" && !mcfg.config.pardonsEnabled) return {
				ok: false,
				error: "Perdão está desligado."
			};
			let strikes = effectiveStrikes(target.strikes, state.cases.filter((c) => c.guildId === state.activeGuildId), target.id, Number(mcfg.config.strikeExpiryDays ?? 0));
			let timedOutUntil = target.timedOutUntil;
			let banned = target.banned;
			let note = "";
			if (action === "warn") {
				const next = nextModerationAction(strikes, mcfg.config);
				strikes += 1;
				note = `Advertência ${strikes}. ${next.note}`;
			} else if (action === "timeout") {
				const mins = durationMinutes ?? Number(mcfg.config.defaultTimeoutMinutes ?? 60);
				timedOutUntil = Date.now() + mins * 6e4;
				strikes += 1;
				note = `Timeout de ${mins} min.`;
			} else if (action === "kick") note = "Membro expulso (na demo ele permanece na lista).";
			else if (action === "ban") {
				banned = true;
				note = "Membro banido.";
			} else if (action === "pardon") {
				strikes = Math.max(0, strikes - 1);
				timedOutUntil = null;
				banned = false;
				note = "Advertência perdoada.";
			}
			if (Boolean(mcfg.config.dmOnPunish) && action !== "pardon") note = `${note} Aviso enviado no privado.`;
			const cas = {
				id: uid("c"),
				guildId: state.activeGuildId,
				targetId,
				actorId,
				action,
				reason,
				evidence,
				createdAt: Date.now(),
				durationMinutes
			};
			write({
				cases: [cas, ...state.cases],
				members: state.members.map((m) => m.id === targetId && m.guildId === state.activeGuildId ? {
					...m,
					strikes,
					timedOutUntil,
					banned
				} : m)
			});
			audit("moderation", `${action} em ${target.displayName}: ${reason}`);
			return {
				ok: true,
				note
			};
		},
		testAutomod: (userId, text) => {
			const state = get();
			const acfg = cfg("automod");
			const author = state.members.find((m) => m.id === userId && m.guildId === state.activeGuildId) ?? {
				roleIds: [],
				username: "membro"
			};
			if (!acfg.enabled) return {
				ok: true,
				detail: "AutoMod pausado — mensagem passaria."
			};
			const verdict = scanMessage(acfg.config, text, author);
			const recent = [...state.recentMessages, {
				guildId: state.activeGuildId,
				userId,
				content: text,
				at: Date.now()
			}].slice(-120);
			const finalVerdict = (verdict.ok ? scanBurst(acfg.config, state.recentMessages.filter((m) => m.guildId === state.activeGuildId), userId, text) : null) ?? verdict;
			if (!finalVerdict.ok) {
				const hit = {
					id: uid("h"),
					guildId: state.activeGuildId,
					userId,
					content: text,
					rule: finalVerdict.rule ?? "filtro",
					action: finalVerdict.action ?? "delete",
					at: Date.now()
				};
				write({
					recentMessages: recent,
					automodHits: [hit, ...state.automodHits].slice(0, 80)
				});
				audit("automod", `Filtrou mensagem (${finalVerdict.rule}).`);
				return finalVerdict;
			}
			write({ recentMessages: recent });
			return finalVerdict;
		},
		toggleLockdown: () => {
			const state = get();
			const current = cfg("security");
			const next = current.config.lockdown !== true;
			write({ modules: {
				...state.modules,
				[state.activeGuildId]: {
					...state.modules[state.activeGuildId],
					security: {
						...current,
						config: {
							...current.config,
							lockdown: next
						}
					}
				}
			} });
			if (next) {
				const inc = {
					id: uid("i"),
					guildId: state.activeGuildId,
					kind: "lockdown",
					title: "Lockdown manual",
					detail: String(current.config.lockdownMessage ?? "Servidor em proteção."),
					status: "open",
					at: Date.now()
				};
				write({ incidents: [inc, ...get().incidents] });
			}
			audit("security", next ? "Lockdown ligado." : "Lockdown desligado.");
		},
		closeIncident: (id) => {
			write({ incidents: get().incidents.map((i) => i.id === id ? {
				...i,
				status: "closed"
			} : i) });
		},
		addArticle: (title, body, tags, options = {}) => {
			const state = get();
			const article = {
				id: uid("a"),
				guildId: state.activeGuildId,
				title,
				body,
				tags,
				category: options.category?.trim() || "Geral",
				exampleQuestions: options.exampleQuestions ?? [],
				approved: options.approved ?? false,
				reviewRequested: options.reviewRequested ?? false,
				updatedAt: Date.now()
			};
			write({ articles: [article, ...state.articles] });
			audit("knowledge", `Artigo “${title}” criado como ${article.approved ? "aprovado" : article.reviewRequested ? "aguardando revisão" : "rascunho"}.`);
		},
		updateArticle: (id, patch) => {
			const editedContent = get().articles.find((article) => article.id === id) && (patch.title !== void 0 || patch.body !== void 0 || patch.tags !== void 0 || patch.category !== void 0 || patch.exampleQuestions !== void 0);
			write({ articles: get().articles.map((a) => a.id === id ? {
				...a,
				...editedContent ? { history: [...a.history ?? [], {
					title: a.title,
					body: a.body,
					tags: [...a.tags],
					category: a.category,
					exampleQuestions: [...a.exampleQuestions ?? []],
					at: a.updatedAt
				}].slice(-20) } : {},
				...patch,
				updatedAt: Date.now()
			} : a) });
			const updated = get().articles.find((article) => article.id === id);
			if (updated) {
				const change = patch.approved ? "aprovado" : patch.reviewRequested ? "enviado para revisão" : "atualizado";
				audit("knowledge", `Artigo “${updated.title}” ${change}.`);
			}
		},
		deleteArticle: (id) => {
			const title = get().articles.find((article) => article.id === id)?.title;
			write({ articles: get().articles.filter((a) => a.id !== id) });
			audit("knowledge", title ? `Artigo “${title}” removido.` : "Artigo removido.");
		},
		addDashboardMember: (username, role) => {
			const member = {
				id: uid("dm"),
				username,
				role,
				addedAt: Date.now()
			};
			write({ dashboardMembers: [...get().dashboardMembers, member] });
		},
		removeDashboardMember: (id) => {
			write({ dashboardMembers: get().dashboardMembers.filter((m) => m.id !== id) });
		},
		sweepInactive: () => {
			const state = get();
			const tcfg = cfg("tickets");
			const hours = Number(tcfg.config.autoCloseInactiveHours ?? 0);
			if (hours <= 0) return {
				closed: 0,
				error: "Autoencerramento está em 0h."
			};
			let closed = 0;
			const tickets = state.tickets.map((t) => {
				if (t.guildId !== state.activeGuildId || !shouldAutoClose(t, tcfg.config)) return t;
				closed += 1;
				const transcript = t.messages.map((m) => {
					return `${m.kind === "system" ? "Sistema" : state.members.find((x) => x.id === m.authorId)?.displayName ?? m.authorId}: ${m.content}`;
				}).join("\n");
				return {
					...t,
					status: "closed",
					closedAt: Date.now(),
					transcript,
					messages: [...t.messages, {
						id: uid("m"),
						authorId: "system",
						content: `Encerrado por inatividade (${hours}h sem mensagem).`,
						at: Date.now(),
						kind: "system"
					}]
				};
			});
			if (closed === 0) return {
				closed: 0,
				error: "Nenhum atendimento ocioso."
			};
			write({ tickets });
			audit("tickets", `Autoencerramento fechou ${closed} atendimento(s).`);
			return { closed };
		},
		simulateJoin: ({ username, accountAgeHours }) => {
			const state = get();
			const servers = cfg("servers");
			const security = cfg("security");
			const roles = cfg("roles");
			const name = username.trim().replace(/\s+/g, "").slice(0, 24) || "visitante";
			const minHours = Number(security.config.minAccountAgeHours ?? 0);
			const quarantine = Boolean(security.config.quarantineNewMembers) && accountAgeHours < minHours;
			const maintenance = Boolean(servers.config.maintenanceMode);
			const defaultRoles = Array.isArray(roles.config.defaultRoleIds) ? roles.config.defaultRoleIds.filter((x) => typeof x === "string") : [];
			const member = {
				id: uid("u"),
				guildId: state.activeGuildId,
				username: name.toLowerCase(),
				displayName: name,
				hue: Math.round(Math.random() * 360),
				roleIds: maintenance || quarantine ? [] : defaultRoles,
				joinedAt: Date.now(),
				strikes: 0,
				status: "online",
				accountCreatedAt: Date.now() - Math.max(0, accountAgeHours) * 36e5,
				timedOutUntil: null,
				banned: false
			};
			const channelId = String(maintenance || quarantine ? security.config.alertChannelId ?? "ch_alerts" : servers.config.announceJoinChannelId ?? "ch_geral");
			const content = maintenance ? String(servers.config.maintenanceMessage ?? "Manutenção.") : quarantine ? `${name} entrou com conta de ${accountAgeHours}h (mínimo ${minHours}h) e foi isolado, sem cargo.` : renderTemplate(String(servers.config.joinMessage ?? "Bem-vindo, {user}."), { user: name });
			const post = {
				id: uid("p"),
				guildId: state.activeGuildId,
				channelId,
				author: "Wumpus",
				content,
				at: Date.now()
			};
			const incidents = quarantine ? [{
				id: uid("i"),
				guildId: state.activeGuildId,
				kind: "raid",
				title: "Conta nova isolada",
				detail: content,
				status: "open",
				at: Date.now()
			}, ...state.incidents] : state.incidents;
			write({
				members: [...state.members, member],
				posts: [post, ...state.posts].slice(0, 60),
				incidents,
				guilds: state.guilds.map((g) => g.id === state.activeGuildId ? {
					...g,
					memberCount: g.memberCount + 1,
					online: g.online + 1
				} : g)
			});
			audit("servers", content);
			return content;
		},
		simulateRaid: (joins) => {
			const state = get();
			const security = cfg("security");
			const decision = evaluateRaid(joins, security.config);
			if (!decision.triggered) {
				audit("security", decision.detail);
				return decision.detail;
			}
			const lockdown = decision.lockdown;
			const incident = {
				id: uid("i"),
				guildId: state.activeGuildId,
				kind: "raid",
				title: lockdown ? "Raid — lockdown" : "Raid — alerta",
				detail: decision.detail,
				status: lockdown ? "open" : "contained",
				at: Date.now()
			};
			const channelId = String(security.config.alertChannelId ?? "ch_alerts");
			const post = {
				id: uid("p"),
				guildId: state.activeGuildId,
				channelId,
				author: "Wumpus",
				content: lockdown ? String(security.config.lockdownMessage ?? decision.detail) : decision.detail,
				at: Date.now()
			};
			write({
				incidents: [incident, ...state.incidents],
				posts: [post, ...state.posts].slice(0, 60),
				modules: lockdown ? {
					...state.modules,
					[state.activeGuildId]: {
						...state.modules[state.activeGuildId],
						security: {
							...security,
							config: {
								...security.config,
								lockdown: true
							}
						}
					}
				} : state.modules
			});
			audit("security", decision.detail);
			return decision.detail;
		},
		simulateNuke: (actions) => {
			const state = get();
			const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
			const security = cfg("security");
			const decision = evaluateNuke(actions, security.config, planAllows(plan, "antiNuke"));
			if (!decision.triggered) {
				audit("security", decision.detail);
				return decision.detail;
			}
			const incident = {
				id: uid("i"),
				guildId: state.activeGuildId,
				kind: "nuke",
				title: decision.lockdown ? "Nuke contido" : "Nuke só em alerta",
				detail: decision.detail,
				status: decision.lockdown ? "open" : "contained",
				at: Date.now()
			};
			write({
				incidents: [incident, ...state.incidents],
				modules: decision.lockdown ? {
					...state.modules,
					[state.activeGuildId]: {
						...state.modules[state.activeGuildId],
						security: {
							...security,
							config: {
								...security.config,
								lockdown: true
							}
						}
					}
				} : state.modules
			});
			audit("security", decision.detail);
			return decision.detail;
		},
		setPlan: (plan) => {
			const state = get();
			if (!state.sessionUser.isAdmin) return;
			write({
				guilds: state.guilds.map((g) => g.id === state.activeGuildId ? {
					...g,
					plan
				} : g),
				licenses: state.licenses.map((l) => {
					const guild = state.guilds.find((g) => g.id === state.activeGuildId);
					return guild && l.guildName === guild.name ? {
						...l,
						plan
					} : l;
				})
			});
			audit("servers", `Plano do servidor alterado para ${plan}.`);
		}
	};
});
/**
* Servidor neutro para quando a sessao nao tem nenhum liberado.
*
* Existe porque lista vazia passou a ser um estado LEGITIMO: sem assinatura
* ativa, ou com o bot em nenhum servidor que a pessoa administre. Antes o
* codigo fazia `s.guilds[0]!` — uma assercao que mente, porque com a lista
* vazia o valor e `undefined` e qualquer acesso a `guild.plan` estourava.
*/
var NO_GUILD = {
	id: "",
	name: "Nenhum servidor",
	tag: "--",
	memberCount: 0,
	online: 0,
	plan: "essencial",
	preset: "community",
	installed: false,
	region: "—",
	iconUrl: null
};
function useActiveGuild() {
	return useWumpus((s) => s.guilds.find((g) => g.id === s.activeGuildId) ?? s.guilds[0] ?? NO_GUILD);
}
function useModule(module) {
	const gid = useWumpus((s) => s.activeGuildId);
	return useWumpus((s) => s.modules[gid])?.[module] ?? {
		enabled: true,
		config: defaultsFor(module)
	};
}
function useGuildMembers() {
	const gid = useWumpus((s) => s.activeGuildId);
	return useWumpus((s) => s.members).filter((m) => m.guildId === gid);
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/search-select-UxOZaxVE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SearchSelect({ id, value, options, placeholder, eyebrow, onChange, className, disabled = false }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [query, setQuery] = (0, import_react.useState)("");
	const [activeIndex, setActiveIndex] = (0, import_react.useState)(0);
	const rootRef = (0, import_react.useRef)(null);
	const searchRef = (0, import_react.useRef)(null);
	const generatedId = (0, import_react.useId)();
	const listId = `${id ?? generatedId}-options`;
	const selected = options.find((option) => option.id === value);
	const filtered = (0, import_react.useMemo)(() => {
		const needle = query.trim().toLocaleLowerCase("pt-BR");
		return needle ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle)) : options;
	}, [options, query]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		searchRef.current?.focus();
		const dismiss = (event) => {
			if (!rootRef.current?.contains(event.target)) setOpen(false);
		};
		document.addEventListener("pointerdown", dismiss);
		return () => document.removeEventListener("pointerdown", dismiss);
	}, [open]);
	const choose = (option) => {
		onChange(option.id);
		setOpen(false);
		setQuery("");
		setActiveIndex(0);
	};
	const move = (step) => setActiveIndex((index) => Math.max(0, Math.min(filtered.length - 1, index + step)));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		id,
		ref: rootRef,
		className: "relative w-full",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			disabled,
			"aria-haspopup": "listbox",
			"aria-expanded": open,
			"aria-controls": listId,
			onClick: () => {
				setOpen((current) => !current);
				setQuery("");
				setActiveIndex(Math.max(0, options.findIndex((option) => option.id === value)));
			},
			onKeyDown: (event) => {
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					setOpen(true);
					setActiveIndex(Math.max(0, options.findIndex((option) => option.id === value)));
				}
			},
			className: cn("flex min-h-11 w-full items-center gap-3 rounded-xl border border-input bg-card px-3 text-left text-foreground outline-none transition-[border-color,box-shadow,background] hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", open && "border-primary/60", className),
			children: [
				selected?.icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0",
					children: selected.icon
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0 flex-1",
					children: [
						eyebrow ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-[11px] font-medium text-muted-foreground",
							children: eyebrow
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("block truncate text-sm font-semibold", !selected && "font-medium text-muted-foreground"),
							children: selected?.label ?? placeholder
						}),
						selected?.description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate text-[11px] text-muted-foreground",
							children: selected.description
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
					"aria-hidden": "true",
					className: cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")
				})
			]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute left-0 top-[calc(100%+0.45rem)] z-50 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_14px_38px_-16px_rgb(0_0_0/0.55)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-b border-border p-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex h-10 items-center gap-2 rounded-lg bg-muted/65 px-3 focus-within:ring-2 focus-within:ring-ring",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
								"aria-hidden": "true",
								className: "size-4 shrink-0 text-muted-foreground"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: searchRef,
								role: "combobox",
								"aria-expanded": open,
								"aria-controls": listId,
								"aria-activedescendant": filtered[activeIndex] ? `${listId}-${activeIndex}` : void 0,
								value: query,
								onChange: (event) => {
									setQuery(event.target.value);
									setActiveIndex(0);
								},
								onKeyDown: (event) => {
									if (event.key === "ArrowDown") {
										event.preventDefault();
										move(1);
									}
									if (event.key === "ArrowUp") {
										event.preventDefault();
										move(-1);
									}
									if (event.key === "Enter" && filtered[activeIndex]) {
										event.preventDefault();
										choose(filtered[activeIndex]);
									}
									if (event.key === "Escape") {
										event.preventDefault();
										setOpen(false);
									}
								},
								placeholder: "Buscar…",
								"aria-label": "Buscar opções",
								className: "min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
							}),
							query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setQuery("");
									setActiveIndex(0);
								},
								className: "rounded px-1 text-xs text-muted-foreground hover:text-foreground",
								children: "Limpar"
							}) : null
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					id: listId,
					role: "listbox",
					"aria-label": eyebrow ?? placeholder,
					className: "max-h-64 overflow-y-auto p-1.5",
					children: filtered.length ? filtered.map((option, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						id: `${listId}-${index}`,
						type: "button",
						role: "option",
						"aria-selected": option.id === value,
						onMouseEnter: () => setActiveIndex(index),
						onClick: () => choose(option),
						className: cn("flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", index === activeIndex ? "bg-secondary text-foreground" : "text-foreground hover:bg-muted"),
						children: [
							option.icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0",
								children: option.icon
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate font-medium",
									children: option.label
								}), option.description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate text-xs text-muted-foreground",
									children: option.description
								}) : null]
							}),
							option.id === value ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
								"aria-hidden": "true",
								className: "size-4 shrink-0 text-primary"
							}) : null
						]
					}, option.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 px-3 py-5 text-center text-sm text-muted-foreground",
						children: [
							"Nenhum resultado para “",
							query,
							"”."
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "m-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground",
					children: [
						filtered.length,
						" ",
						filtered.length === 1 ? "opção" : "opções"
					]
				})
			]
		}) : null]
	});
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-DjtjaZqs.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionPresence, {}), children] });
}
function SessionPresence() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	(0, import_react.useEffect)(() => {
		if (!pathname.startsWith("/app") && pathname !== "/admin") return;
		const heartbeat = () => {
			if (document.visibilityState === "visible") heartbeatDashboardSession({ data: {} }).then((result) => {
				if (result.ok) return;
				localStorage.removeItem("wumpus-demo-v2");
				window.location.replace("/entrar?motivo=sessao-expirada");
			}).catch(() => void 0);
		};
		heartbeat();
		const timer = window.setInterval(heartbeat, 6e4);
		return () => window.clearInterval(timer);
	}, [pathname]);
	return null;
}
var APP_NAME = "Wumpus";
function FigmaCaptureScript() {
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined" || !window.location.hash.includes("figmacapture=")) return;
		const script = document.createElement("script");
		script.src = "https://mcp.figma.com/mcp/html-to-design/capture.js";
		script.async = true;
		document.head.append(script);
		return () => script.remove();
	}, []);
	return null;
}
var Route$15 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "A central de comando da sua comunidade no Discord."
			},
			{
				name: "theme-color",
				content: "#f5f2ea"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "manifest",
				href: "/manifest.json"
			},
			{
				rel: "apple-touch-icon",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "pt-BR",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthProvider, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FigmaCaptureScript, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	})
});
var $$splitComponentImporter$13 = () => import("./routes-BhJWFvWm.mjs");
var Route$14 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./admin-CHgtxskx.mjs");
var Route$13 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./app-Dhu7OGlE.mjs");
var Route$12 = createFileRoute("/app")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./entrar-Ajpx5gvD.mjs");
var Route$11 = createFileRoute("/entrar")({
	validateSearch: (search) => search.reconectar === "1" ? { reconectar: true } : {},
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./app-cPRqs41z.mjs");
var Route$10 = createFileRoute("/app/")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./forms-C5hENbaq.mjs");
var Route$9 = createFileRoute("/app/forms")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./knowledge-DUgNeqNH.mjs");
var Route$8 = createFileRoute("/app/knowledge")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./logs-BuO_gV2m.mjs");
var Route$7 = createFileRoute("/app/logs")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./moderation-CZOfrfMt.mjs");
var Route$6 = createFileRoute("/app/moderation")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
/** Keep canonical Discord names so configurations can resolve per server in a group. */
function DiscordSelect({ id, value, onChange, kind, placeholder = "Selecione…", className }) {
	const guildId = useWumpus((s) => s.activeGuildId);
	const channels = useWumpus((s) => s.channels[guildId] ?? []);
	const roles = useWumpus((s) => s.roles[guildId] ?? []);
	const options = kind === "role" ? roles.filter((role) => role.id !== guildId).map((role) => ({
		id: role.id,
		name: `@${role.name}`
	})) : channels.filter((channel) => channel.type === kind).map((channel) => ({
		id: channel.id,
		name: `${kind === "text" ? "#" : ""}${channel.name}`
	}));
	const selected = options.find((option) => option.id === value || option.name.replace(/^[#▰@ ]+/, "") === value.replace(/^[#▰@ ]+/, ""));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchSelect, {
		id,
		value: selected?.id ?? "",
		options: options.map((option) => ({
			id: option.id,
			label: option.name
		})),
		onChange,
		placeholder,
		className
	});
}
function DiscordMultiSelect({ value, onChange, kind = "role", placeholder }) {
	const guildId = useWumpus((s) => s.activeGuildId);
	const roles = useWumpus((s) => s.roles[guildId] ?? []);
	const channels = useWumpus((s) => s.channels[guildId] ?? []);
	const entities = kind === "role" ? roles.filter((role) => role.id !== guildId).map((role) => ({
		id: role.id,
		name: role.name
	})) : channels.filter((channel) => channel.type === kind).map((channel) => ({
		id: channel.id,
		name: channel.name
	}));
	const available = entities.filter((entity) => !value.includes(entity.id) && !value.includes(entity.name));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-2",
			children: value.map((ref) => {
				const entity = entities.find((item) => item.id === ref || item.name === ref);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onChange(value.filter((item) => item !== ref)),
					className: "rounded-full border border-border px-3 py-1 text-xs hover:bg-muted",
					"aria-label": `Remover ${kind === "role" ? "cargo" : "canal"} ${entity?.name ?? ref}`,
					children: [
						kind === "role" ? "@" : "#",
						entity?.name ?? ref,
						" ×"
					]
				}, ref);
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchSelect, {
			value: "",
			options: available.map((entity) => ({
				id: entity.id,
				label: `${kind === "role" ? "@" : "#"}${entity.name}`
			})),
			onChange: (id) => onChange([...value, id]),
			placeholder: available.length ? placeholder ?? (kind === "role" ? "Adicionar cargo…" : "Adicionar canal…") : value.length ? "Todos selecionados" : "Nenhuma opção disponível",
			disabled: !available.length
		})]
	});
}
var badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide", {
	variants: { tone: {
		default: "bg-muted text-muted-foreground",
		primary: "bg-primary/15 text-primary",
		ok: "bg-ok/15 text-ok",
		warn: "bg-warn/15 text-warn",
		danger: "bg-destructive/15 text-destructive",
		info: "bg-info/15 text-info"
	} },
	defaultVariants: { tone: "default" }
});
function Badge({ className, tone, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ tone }), className),
		...props
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[transform,background-color,box-shadow,color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover",
			secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
			outline: "border border-border bg-transparent text-foreground hover:bg-muted",
			ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
			destructive: "bg-destructive text-white hover:opacity-90",
			discord: "bg-discord text-white hover:brightness-110"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 px-3 text-[13px]",
			lg: "h-12 px-5",
			icon: "size-11",
			"icon-sm": "size-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-2xl bg-card p-5 text-card-foreground shadow-border", className),
		...props
	});
}
var Dialog = Dialog$1;
function DialogContent({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 text-card-foreground shadow-border outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-3 right-3 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Fechar"
			})]
		})]
	})] });
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("text-lg font-semibold tracking-tight", className),
		...props
	});
}
function DialogDesc({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
		className: cn("mt-1 text-sm text-muted-foreground", className),
		...props
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("flex h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-[box-shadow,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className),
		...props
	});
}
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-[box-shadow,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("text-[13px] font-medium text-muted-foreground", className),
		...props
	});
}
function NativeSelect({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		className: cn("flex h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", className),
		...props
	});
}
function Switch({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
		className: cn("peer inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-muted shadow-border transition-colors duration-150 data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "block size-5 translate-x-0.5 rounded-full bg-white transition-transform duration-150 data-[state=checked]:translate-x-[22px]" })
	});
}
var Tabs = Root2;
function TabsList({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
		className: cn("inline-flex h-11 items-center gap-1 rounded-xl bg-muted p-1", className),
		...props
	});
}
function TabsTrigger({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
		className: cn("inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-border", className),
		...props
	});
}
var TabsContent = Content;
var Route$5 = createFileRoute("/app/protect")({ component: ProtectPage });
function verificationFailureAdvice(detail) {
	const normalized = detail.toLocaleLowerCase("pt-BR");
	if (normalized.includes("onboarding")) return "Em Configurações do servidor > Onboarding, remova esse canal da lista de canais do Onboarding. Se preferir mantê-lo lá, selecione outro canal para a verificação.";
	if (normalized.includes("gerenciado por uma integração")) return "Escolha outro cargo, criado diretamente neste servidor. Cargos de bots e integrações não podem ser concedidos pelo painel.";
	if (normalized.includes("não foi encontrado neste servidor")) return "Atualize a página para recarregar os cargos do Discord e escolha novamente o cargo que será dado após a verificação.";
	if (normalized.includes("acima ou na mesma posição") || normalized.includes("cargo verificado inválido ou acima do cargo do bot")) return "No Discord, abra Configurações do servidor > Cargos e arraste o cargo do Wumpus para uma posição acima do cargo verificado. Depois, tente publicar novamente.";
	return null;
}
var sections = [
	{
		id: "overview",
		label: "Visão geral",
		icon: ShieldCheck
	},
	{
		id: "automod",
		label: "Mensagens",
		icon: MessageSquareWarning
	},
	{
		id: "entry",
		label: "Entradas e raid",
		icon: Siren
	},
	{
		id: "verification",
		label: "Verificação",
		icon: BadgeCheck
	},
	{
		id: "antinuke",
		label: "Anti-nuke",
		icon: ShieldAlert
	},
	{
		id: "incidents",
		label: "Incidentes",
		icon: Activity
	}
];
var permissionLabels = {
	manageMessages: "Gerenciar mensagens",
	manageChannels: "Gerenciar canais",
	manageRoles: "Gerenciar cargos",
	moderateMembers: "Moderar membros",
	viewAuditLog: "Ver registro de auditoria",
	banMembers: "Banir membros"
};
var presetModuleLabels = {
	automod: "AutoMod",
	security: "Proteção contra raid e nuke",
	tickets: "Atendimento"
};
var configFieldLabels = {
	blockInvites: "Bloqueio de convites",
	blockLinks: "Bloqueio de links",
	allowedDomains: "Domínios permitidos",
	blockedTerms: "Termos bloqueados",
	action: "Ação do AutoMod",
	capsThresholdPercent: "Limite de letras maiúsculas",
	mentionLimit: "Limite de menções",
	raidMode: "Modo anti-raid",
	raidJoinThreshold: "Limite de entradas",
	minAccountAgeHours: "Idade mínima da conta",
	quarantineNewMembers: "Isolamento de contas novas",
	slaWarningMinutes: "Aviso de prazo do atendimento",
	departments: "Departamentos de atendimento"
};
function ProtectPage() {
	const guild = useActiveGuild();
	const guildId = useWumpus((state) => state.activeGuildId);
	const automod = useModule("automod");
	const security = useModule("security");
	const tickets = useModule("tickets");
	const updateConfig = useWumpus((state) => state.updateConfig);
	const setModuleEnabled = useWumpus((state) => state.setModuleEnabled);
	const applyPreset = useWumpus((state) => state.applyPreset);
	const members = useGuildMembers();
	const channels = useWumpus((state) => state.channels[state.activeGuildId] ?? []);
	const runtimeSyncStatus = useWumpus((state) => state.runtimeSyncStatus);
	const runtimeSyncError = useWumpus((state) => state.runtimeSyncError);
	const [section, setSection] = (0, import_react.useState)("overview");
	const [events, setEvents] = (0, import_react.useState)([]);
	const [eventError, setEventError] = (0, import_react.useState)(null);
	const [readiness, setReadiness] = (0, import_react.useState)(null);
	const [readinessError, setReadinessError] = (0, import_react.useState)(null);
	const [presetDraft, setPresetDraft] = (0, import_react.useState)("");
	const [presetNote, setPresetNote] = (0, import_react.useState)(null);
	const [confirmAction, setConfirmAction] = (0, import_react.useState)(null);
	const [actionBusy, setActionBusy] = (0, import_react.useState)(false);
	const [actionNote, setActionNote] = (0, import_react.useState)(null);
	const [actionFailed, setActionFailed] = (0, import_react.useState)(false);
	const [verificationChannelId, setVerificationChannelId] = (0, import_react.useState)(asString(security.config.verificationChannelId));
	const [verifiedRoleId, setVerifiedRoleId] = (0, import_react.useState)(asString(security.config.verifiedRoleId));
	const [memberId, setMemberId] = (0, import_react.useState)(members[0]?.id ?? "");
	const [testText, setTestText] = (0, import_react.useState)("entra no meu server discord.gg/nitrofree");
	const [testVerdict, setTestVerdict] = (0, import_react.useState)(null);
	const [eventFilter, setEventFilter] = (0, import_react.useState)("open");
	const [eventSeverity, setEventSeverity] = (0, import_react.useState)("all");
	const [raidTestCount, setRaidTestCount] = (0, import_react.useState)(14);
	const [nukeTestCount, setNukeTestCount] = (0, import_react.useState)(6);
	const [raidTestResult, setRaidTestResult] = (0, import_react.useState)(null);
	const [nukeTestResult, setNukeTestResult] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setVerificationChannelId(asString(security.config.verificationChannelId));
		setVerifiedRoleId(asString(security.config.verifiedRoleId));
	}, [
		guildId,
		security.config.verificationChannelId,
		security.config.verifiedRoleId
	]);
	(0, import_react.useEffect)(() => {
		if (!members.some((member) => member.id === memberId)) setMemberId(members[0]?.id ?? "");
	}, [members, memberId]);
	(0, import_react.useEffect)(() => {
		let active = true;
		const refresh = async () => {
			const token = getStoredSessionToken();
			if (!token || !guildId) return;
			const [nextReadiness, nextEvents] = await Promise.allSettled([getGuildProtectionReadiness({ data: {
				token,
				guildId
			} }), getGuildSecurityIncidents({ data: {
				token,
				guildId,
				limit: 100
			} })]);
			if (!active) return;
			if (nextReadiness.status === "fulfilled") {
				setReadiness(nextReadiness.value);
				setReadinessError(null);
			} else setReadinessError(nextReadiness.reason instanceof Error ? nextReadiness.reason.message : "Não foi possível verificar o bot.");
			if (nextEvents.status === "fulfilled") {
				setEvents(nextEvents.value);
				setEventError(null);
			} else setEventError(nextEvents.reason instanceof Error ? nextEvents.reason.message : "Não foi possível carregar os alertas reais do bot.");
		};
		refresh();
		const timer = window.setInterval(() => void refresh(), 3e4);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [guildId]);
	const permissions = readiness?.permissions ?? null;
	const lockdownActive = readiness?.lockdown ?? Boolean(security.config.lockdown);
	const requiredPermissions = (0, import_react.useMemo)(() => {
		const required = /* @__PURE__ */ new Set();
		if (automod.enabled) {
			required.add("manageMessages");
			if (asString(automod.config.action) === "timeout") required.add("moderateMembers");
		}
		if (security.enabled) {
			required.add("viewAuditLog");
			if (asString(security.config.response, "lockdown_review") === "lockdown_review" || lockdownActive) required.add("manageChannels");
			if (security.config.quarantineNewMembers || asString(security.config.response) === "auto") required.add("moderateMembers");
			if (security.config.autoBanRepeatOffenders) required.add("banMembers");
			if (security.config.verificationEnabled) {
				required.add("manageChannels");
				required.add("manageRoles");
			}
		}
		return [...required];
	}, [
		automod.enabled,
		automod.config.action,
		security.enabled,
		security.config,
		lockdownActive
	]);
	const openEvents = events.filter((event) => !event.acknowledged).length;
	const filteredEvents = events.filter((event) => {
		if (eventFilter === "open" && event.acknowledged) return false;
		if (eventFilter === "reviewed" && !event.acknowledged) return false;
		if (eventSeverity !== "all" && event.severity !== eventSeverity) return false;
		return true;
	});
	const activePreset = guild.preset;
	const presetChanges = presetDraft ? getPresetChanges(presetDraft, automod.config, security.config, tickets.config) : [];
	const confirmPermissionMissing = confirmAction === "restore_verification" ? permissions?.manageChannels === false || permissions?.manageRoles === false : (confirmAction === "lockdown_on" || confirmAction === "lockdown_off") && permissions?.manageChannels === false;
	const markReviewed = async (eventId) => {
		try {
			await acknowledgeGuildSecurityIncident({ data: {
				token: getStoredSessionToken(),
				guildId,
				eventId
			} });
			setEvents((current) => current.map((event) => event.id === eventId ? {
				...event,
				acknowledged: true
			} : event));
		} catch (error) {
			setEventError(error instanceof Error ? error.message : "Não foi possível marcar o alerta como revisado.");
		}
	};
	const waitForAction = async (jobId, successText) => {
		setActionBusy(true);
		setActionFailed(false);
		setActionNote("Pedido recebido. Aguardando o bot executar no Discord…");
		try {
			for (let attempt = 0; attempt < 30; attempt += 1) {
				const result = await getGuildSecurityActionStatus({ data: {
					token: getStoredSessionToken(),
					guildId,
					jobId
				} });
				if (result.status === "done") {
					setActionFailed(false);
					setActionNote(result.detail || successText);
					return true;
				}
				if (result.status === "failed") {
					setActionFailed(true);
					setActionNote(result.detail || "O bot não conseguiu concluir a ação. Confira as permissões e tente novamente.");
					return false;
				}
				await new Promise((resolve) => window.setTimeout(resolve, 1e3));
			}
			setActionFailed(true);
			setActionNote("O pedido continua na fila. Consulte o estado do bot e tente novamente se ele não concluir.");
			return false;
		} catch (error) {
			setActionFailed(true);
			setActionNote(error instanceof Error ? error.message : "Não foi possível consultar o resultado da ação.");
			return false;
		} finally {
			setActionBusy(false);
		}
	};
	const executeConfirmedAction = async () => {
		if (!confirmAction || !guildId) return;
		if (confirmPermissionMissing) {
			setActionFailed(true);
			setActionNote("O bot não tem as permissões necessárias para essa ação. Corrija o checklist antes de tentar novamente.");
			setConfirmAction(null);
			return;
		}
		const action = confirmAction;
		setConfirmAction(null);
		setActionBusy(true);
		setActionFailed(false);
		setActionNote("Enviando pedido ao bot…");
		try {
			if (action === "restore_verification") {
				const result = await requestSecurityRestore({ data: {
					token: getStoredSessionToken(),
					guildId
				} });
				if (await waitForAction(result.jobId, "Permissões de verificação restauradas.")) await useWumpus.getState().updateConfig("security", { verificationEnabled: false });
			} else {
				const enabled = action === "lockdown_on";
				const result = await requestSecurityLockdown({ data: {
					token: getStoredSessionToken(),
					guildId,
					enabled
				} });
				if (await waitForAction(result.jobId, enabled ? "Lockdown aplicado pelo bot." : "Lockdown encerrado pelo bot.")) {
					await useWumpus.getState().updateConfig("security", { lockdown: enabled });
					setReadiness((current) => current ? {
						...current,
						lockdown: enabled
					} : current);
				}
			}
		} catch (error) {
			setActionFailed(true);
			setActionNote(error instanceof Error ? error.message : "Não foi possível enviar a ação ao bot.");
			setActionBusy(false);
		}
	};
	const publishVerification = async () => {
		if (!guildId || !verificationChannelId || !verifiedRoleId) {
			setActionNote("Escolha o canal e o cargo verificado antes de publicar.");
			return;
		}
		setActionBusy(true);
		setActionFailed(false);
		setActionNote("Enviando o painel de verificação ao bot…");
		try {
			const result = await requestPanelPublish({ data: {
				token: getStoredSessionToken(),
				guildId,
				target: "security-verification",
				channelRef: verificationChannelId,
				verificationRoleId: verifiedRoleId
			} });
			if (await waitForAction(result.jobId, "Painel publicado no Discord.")) await useWumpus.getState().updateConfig("security", {
				verificationChannelId,
				verifiedRoleId,
				verificationEnabled: true
			});
		} catch (error) {
			setActionFailed(true);
			setActionNote(error instanceof Error ? error.message : "Não foi possível publicar o painel.");
			setActionBusy(false);
		}
	};
	const applySelectedPreset = () => {
		if (!presetDraft) return;
		const preset = presetDraft;
		applyPreset(preset);
		setPresetNote(`Modelo “${presets[preset].label}” aplicado. Os campos mostrados foram atualizados e estão sendo sincronizados com o bot.`);
		setPresetDraft("");
	};
	const runMessagePreview = () => {
		const member = members.find((entry) => entry.id === memberId);
		if (!automod.enabled) {
			setTestVerdict({
				ok: true,
				detail: "AutoMod está pausado; esta mensagem não seria filtrada."
			});
			return;
		}
		setTestVerdict(scanMessage(automod.config, testText, member ?? {
			roleIds: [],
			username: "membro"
		}));
	};
	const goToEventModule = (event) => {
		setSection(event.module === "automod" ? "automod" : event.eventType.includes("lockdown") ? "overview" : [
			"raid",
			"young_account",
			"auto_timeout",
			"quarantine",
			"auto_response"
		].some((term) => event.eventType.includes(term)) ? "entry" : "antinuke");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-2xl font-semibold tracking-tight",
					children: "Proteção do servidor"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-1 max-w-2xl text-sm leading-6 text-muted-foreground",
					children: "Veja o que está ativo, corrija o que falta e escolha como o Wumpus deve reagir."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-xs text-muted-foreground",
					role: "status",
					"aria-live": "polite",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-2 rounded-full ${runtimeSyncStatus === "failed" ? "bg-destructive" : runtimeSyncStatus === "syncing" ? "animate-pulse bg-warn" : runtimeSyncStatus === "synced" ? "bg-ok" : "bg-muted-foreground/50"}` }), runtimeSyncStatus === "syncing" ? "Salvando no bot…" : runtimeSyncStatus === "failed" ? "Falha ao sincronizar" : runtimeSyncStatus === "synced" ? "Configuração sincronizada" : "Salvamento automático"]
				})]
			}),
			lockdownActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3",
				role: "alert",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockKeyhole, {
						className: "mt-0.5 size-5 shrink-0 text-destructive",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm font-semibold text-destructive",
						children: "Lockdown configurado para este servidor"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 mt-1 text-xs text-muted-foreground",
						children: "O bot restringe o envio de mensagens nos canais públicos enquanto essa proteção estiver ativa."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "sm",
					onClick: () => setConfirmAction("lockdown_off"),
					disabled: actionBusy,
					children: "Encerrar lockdown"
				})]
			}) : null,
			runtimeSyncError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
				role: "alert",
				children: runtimeSyncError
			}) : null,
			actionNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `rounded-lg px-4 py-3 text-sm ${actionFailed ? "border border-destructive/25 bg-destructive/10" : "bg-muted"}`,
				role: actionFailed ? "alert" : "status",
				"aria-live": actionFailed ? "assertive" : "polite",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 font-semibold",
						children: actionFailed ? "Não foi possível concluir a ação" : actionNote
					}),
					actionFailed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-0 mt-1",
						children: actionNote
					}) : null,
					actionFailed && section === "verification" && verificationFailureAdvice(actionNote) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-0 mt-2 text-muted-foreground",
						children: verificationFailureAdvice(actionNote)
					}) : null
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
				value: section,
				onValueChange: (value) => setSection(value),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsList, {
						className: "h-auto w-full justify-start overflow-x-auto rounded-xl bg-transparent p-0",
						children: sections.map(({ id, label, icon: Icon }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
							value: id,
							className: "min-h-10 shrink-0 rounded-lg border border-transparent px-3 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "mr-2 size-4",
									"aria-hidden": "true"
								}),
								label,
								id === "incidents" && openEvents > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive",
									children: openEvents
								}) : null
							]
						}, id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "overview",
						className: "mt-5 space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
								"aria-labelledby": "protection-state-heading",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-3 flex flex-wrap items-end justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										id: "protection-state-heading",
										className: "m-0 text-lg font-semibold",
										children: "Estado das proteções"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs text-muted-foreground",
										children: ["Servidor: ", guild.name]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "divide-y divide-border rounded-xl border border-border bg-card px-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModuleStatusRow, {
											label: "Filtro de mensagens",
											detail: automod.enabled ? "Convites, links, termos e spam" : "O Wumpus não está filtrando mensagens",
											enabled: automod.enabled,
											onChange: (value) => setModuleEnabled("automod", value),
											icon: MessageSquareWarning
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModuleStatusRow, {
											label: "Proteção contra raid e nuke",
											detail: security.enabled ? raidResponseDescription(asString(security.config.response, "lockdown_review")) : "Alertas e respostas automáticas pausados",
											enabled: security.enabled,
											onChange: (value) => setModuleEnabled("security", value),
											icon: ShieldAlert
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadinessRow, {
											label: "Verificação de membros",
											detail: security.config.verificationEnabled ? channelLabel(channels, verificationChannelId) : "Ainda não publicada",
											tone: security.config.verificationEnabled ? "ok" : "warn",
											status: security.config.verificationEnabled ? "Ativa" : "Opcional"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadinessRow, {
											label: "Incidentes aguardando revisão",
											detail: eventError ? "Não foi possível ler a auditoria do bot" : `${openEvents} alerta(s) real(is) sem revisão`,
											tone: openEvents ? "warn" : "ok",
											status: openEvents ? "Atenção" : "Em dia",
											onClick: () => setSection("incidents")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
								className: "grid gap-5 xl:grid-cols-[1fr_0.9fr]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
												className: "m-0 text-base font-semibold",
												children: "Conexão e permissões do Wumpus"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 mt-1 text-sm text-muted-foreground",
												children: "Verificado pelo bot no Discord. Atualiza a cada 30 segundos."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												variant: "ghost",
												size: "sm",
												onClick: () => window.location.reload(),
												"aria-label": "Atualizar estado do bot",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-4" }), "Atualizar"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BotConnectionStatus, {
											readiness,
											error: readinessError
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "divide-y divide-border rounded-lg border border-border px-3",
											children: requiredPermissions.length ? requiredPermissions.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionStatus, {
												label: permissionLabels[key],
												value: permissions?.[key] ?? null,
												botStatus: readiness?.status ?? "unknown"
											}, key)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 py-3 text-sm text-muted-foreground",
												children: "Ligue uma proteção para ver as permissões necessárias."
											})
										}),
										readiness?.status === "online" && permissions === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 rounded-lg bg-warn/10 px-3 py-2 text-xs text-muted-foreground",
											children: "O bot ainda não publicou o diagnóstico de permissões. Reinicie/atualize o bot para habilitar essa verificação."
										}) : null,
										readinessError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 text-xs text-destructive",
											role: "alert",
											children: readinessError
										}) : null
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "m-0 text-base font-semibold",
											children: "Começar com um modelo"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-1 text-sm text-muted-foreground",
											children: "O modelo altera apenas os campos listados e mantém os demais ajustes."
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
											"aria-label": "Modelo de proteção",
											value: presetDraft || activePreset,
											onChange: (event) => {
												setPresetNote(null);
												setPresetDraft(event.target.value);
											},
											children: Object.keys(presets).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
												value: id,
												children: [presets[id].label, id === activePreset ? " · atual" : ""]
											}, id))
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 text-sm text-muted-foreground",
											children: presets[presetDraft || activePreset].blurb
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
											className: "m-0 space-y-2 border-y border-border py-3 pl-5 text-sm",
											children: (presetDraft ? presetChanges : []).length ? presetChanges.map((change) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-medium",
													children: [presetModuleLabels[change.module] ?? change.module, ":"]
												}),
												" ",
												change.label,
												" → ",
												change.value
											] }, change.key)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Este modelo já corresponde às opções exibidas." })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												onClick: applySelectedPreset,
												disabled: !presetDraft || !presetChanges.length,
												children: "Aplicar modelo"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs text-muted-foreground",
												children: "O atendimento também pode ser ajustado pelo modelo."
											})]
										}),
										presetNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 text-sm text-ok",
											role: "status",
											children: presetNote
										}) : null
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-3 flex items-end justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-lg font-semibold",
									children: "Precisa de atenção"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 mt-1 text-sm text-muted-foreground",
									children: "Alertas reais registrados pelo bot e ações da equipe."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "ghost",
									size: "sm",
									onClick: () => setSection("incidents"),
									children: ["Ver todos", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
								})]
							}), eventError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm",
								role: "status",
								children: [eventError, ". Os eventos aparecem quando o bot está conectado."]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecurityEventList, {
								events: events.filter((event) => !event.acknowledged).slice(0, 5),
								onReview: markReviewed,
								onOpen: goToEventModule,
								onLockdown: () => setConfirmAction("lockdown_on"),
								lockdown: lockdownActive,
								compact: true
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "automod",
						className: "mt-5 space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, {
								title: "Filtro de mensagens",
								description: "Escolha o que o Wumpus deve filtrar e como reagir. As mudanças são salvas automaticamente.",
								enabled: automod.enabled,
								onEnabledChange: (value) => setModuleEnabled("automod", value)
							}),
							!automod.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PausedNotice, {
								name: "AutoMod",
								onResume: () => setModuleEnabled("automod", true)
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-5 xl:grid-cols-[1.2fr_0.8fr]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
											className: "space-y-4",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "O que filtrar" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "divide-y divide-border",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
															label: "Convites de outros servidores",
															description: "Remove links de convite do Discord.",
															checked: Boolean(automod.config.blockInvites),
															onChange: (value) => updateConfig("automod", { blockInvites: value }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
															label: "Links fora da lista permitida",
															description: "Só deixa passar domínios adicionados à lista abaixo.",
															checked: Boolean(automod.config.blockLinks),
															onChange: (value) => updateConfig("automod", { blockLinks: value }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
															label: "Menções em excesso",
															description: "Bloqueia uma mensagem acima do limite definido.",
															checked: Number(automod.config.mentionLimit ?? 8) > 0,
															onChange: (value) => updateConfig("automod", { mentionLimit: value ? 8 : 0 }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
															label: "Mensagens em letras maiúsculas",
															description: "Detecta texto escrito quase todo em caixa alta.",
															checked: Number(automod.config.capsThresholdPercent ?? 80) < 100,
															onChange: (value) => updateConfig("automod", { capsThresholdPercent: value ? 80 : 100 }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
															label: "Ghost ping",
															description: "Registra quando alguém apaga uma mensagem após mencionar outra pessoa.",
															checked: Boolean(automod.config.antiGhostPing),
															onChange: (value) => updateConfig("automod", { antiGhostPing: value }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
															label: "Texto dentro de imagens",
															description: "Usa o leitor de imagem configurado para procurar termos bloqueados.",
															checked: automod.config.scanImages !== false,
															onChange: (value) => updateConfig("automod", { scanImages: value }),
															disabled: !automod.enabled
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid gap-3 sm:grid-cols-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
														id: "automod-action",
														label: "Quando encontrar uma mensagem",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
															id: "automod-action",
															value: asString(automod.config.action, "delete"),
															onChange: (event) => updateConfig("automod", { action: event.target.value }),
															disabled: !automod.enabled,
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "delete",
																	children: "Apagar"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "warn",
																	children: "Avisar a pessoa"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "timeout",
																	children: "Apagar e aplicar timeout"
																})
															]
														})
													}), asString(automod.config.action) === "timeout" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
														id: "automod-timeout",
														label: "Duração do timeout (minutos)",
														value: Number(automod.config.timeoutMinutes ?? 10),
														min: 1,
														max: 40320,
														onChange: (value) => updateConfig("automod", { timeoutMinutes: value }),
														disabled: !automod.enabled
													}) : null]
												}),
												asString(automod.config.action) === "warn" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
													id: "automod-warn-message",
													label: "Aviso enviado à pessoa",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
														id: "automod-warn-message",
														value: asString(automod.config.warnMessage),
														maxLength: 500,
														onChange: (event) => updateConfig("automod", { warnMessage: event.target.value }),
														disabled: !automod.enabled
													})
												}) : null
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
											className: "space-y-4",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Termos e links" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListField, {
													id: "blocked-terms",
													label: "Termos bloqueados",
													hint: "Um termo por linha. O bot procura correspondências dentro da mensagem.",
													value: asList(automod.config.blockedTerms),
													onChange: (blockedTerms) => updateConfig("automod", { blockedTerms }),
													disabled: !automod.enabled
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid gap-4 sm:grid-cols-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListField, {
														id: "blocked-domains",
														label: "Domínios bloqueados",
														hint: "Ex.: golpe.example",
														value: asList(automod.config.blockedDomains),
														onChange: (blockedDomains) => updateConfig("automod", { blockedDomains }),
														disabled: !automod.enabled
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListField, {
														id: "allowed-domains",
														label: "Domínios liberados",
														hint: "Usado quando o bloqueio de links está ligado.",
														value: asList(automod.config.allowedDomains),
														onChange: (allowedDomains) => updateConfig("automod", { allowedDomains }),
														disabled: !automod.enabled
													})]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
											className: "space-y-4",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Spam e limites" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "m-0 mt-1 text-sm text-muted-foreground",
													children: "Flood e repetição usam o histórico de mensagens do servidor."
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
															id: "mention-limit",
															label: "Menções por mensagem",
															value: Number(automod.config.mentionLimit ?? 8),
															min: 0,
															max: 100,
															onChange: (value) => updateConfig("automod", { mentionLimit: value }),
															disabled: !automod.enabled,
															hint: "0 desliga"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
															id: "caps-limit",
															label: "Limite de maiúsculas (%)",
															value: Number(automod.config.capsThresholdPercent ?? 80),
															min: 0,
															max: 100,
															onChange: (value) => updateConfig("automod", { capsThresholdPercent: value }),
															disabled: !automod.enabled,
															hint: "100 desliga"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
															id: "flood-count",
															label: "Mensagens na janela",
															value: Number(automod.config.messageLimit ?? 6),
															min: 1,
															max: 100,
															onChange: (value) => updateConfig("automod", { messageLimit: value }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
															id: "flood-window",
															label: "Janela do flood (s)",
															value: Number(automod.config.windowSeconds ?? 10),
															min: 1,
															max: 3600,
															onChange: (value) => updateConfig("automod", { windowSeconds: value }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
															id: "duplicate-limit",
															label: "Repetições da mesma mensagem",
															value: Number(automod.config.duplicateLimit ?? 3),
															min: 1,
															max: 100,
															onChange: (value) => updateConfig("automod", { duplicateLimit: value }),
															disabled: !automod.enabled
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
															id: "min-length",
															label: "Tamanho mínimo",
															value: Number(automod.config.minLength ?? 0),
															min: 0,
															max: 2e3,
															onChange: (value) => updateConfig("automod", { minLength: value }),
															disabled: !automod.enabled,
															hint: "0 desliga"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
															id: "max-length",
															label: "Tamanho máximo",
															value: Number(automod.config.maxLength ?? 0),
															min: 0,
															max: 4e3,
															onChange: (value) => updateConfig("automod", { maxLength: value }),
															disabled: !automod.enabled,
															hint: "0 desliga"
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid gap-4 sm:grid-cols-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Canais ignorados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
														kind: "text",
														value: asList(automod.config.ignoredChannelIds),
														onChange: (ignoredChannelIds) => updateConfig("automod", { ignoredChannelIds }),
														placeholder: "Adicionar canal…"
													})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos ignorados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
														value: asList(automod.config.ignoredRoleIds),
														onChange: (ignoredRoleIds) => updateConfig("automod", { ignoredRoleIds }),
														placeholder: "Adicionar cargo…"
													})] })]
												})
											]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
										className: "space-y-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Prévia de uma mensagem" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 mt-1 text-sm text-muted-foreground",
												children: "Simulação local das regras atuais. Não envia nem apaga mensagens no Discord."
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												id: "automod-test-member",
												label: "Simular como",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
													id: "automod-test-member",
													value: memberId,
													onChange: (event) => setMemberId(event.target.value),
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "",
														children: "Membro sem cargo"
													}), members.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: member.id,
														children: member.displayName
													}, member.id))]
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												id: "automod-test-message",
												label: "Mensagem para testar",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
													id: "automod-test-message",
													value: testText,
													rows: 4,
													onChange: (event) => setTestText(event.target.value),
													placeholder: "Cole uma mensagem de exemplo…"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												onClick: runMessagePreview,
												disabled: !testText.trim(),
												children: "Verificar mensagem"
											}),
											testVerdict ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `rounded-lg px-3 py-3 text-sm ${testVerdict.ok ? "bg-ok/10 text-ok" : "bg-warn/10 text-foreground"}`,
												role: "status",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "m-0 flex items-center gap-2 font-semibold",
													children: [testVerdict.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "size-4" }), testVerdict.ok ? "A mensagem passaria" : `O AutoMod aplicaria: ${actionLabel(testVerdict.action)}`]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "m-0 mt-1 text-muted-foreground",
													children: [testVerdict.detail, testVerdict.rule ? ` · Regra: ${testVerdict.rule}` : ""]
												})]
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 text-xs text-muted-foreground",
												children: "A prévia não inclui flood ou repetição, pois essas regras dependem do histórico real de mensagens."
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
										className: "space-y-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Atividade recente do AutoMod" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 mt-1 text-sm text-muted-foreground",
												children: "Eventos reais registrados pelo bot."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												variant: "ghost",
												size: "sm",
												onClick: () => setSection("incidents"),
												children: ["Abrir fila", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecurityEventList, {
											events: events.filter((event) => event.module === "automod").slice(0, 8),
											onReview: markReviewed,
											onOpen: goToEventModule,
											onLockdown: () => setConfirmAction("lockdown_on"),
											lockdown: lockdownActive,
											compact: true
										})]
									})]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "entry",
						className: "mt-5 space-y-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, {
							title: "Entradas e proteção contra raid",
							description: "Defina quando uma entrada parece suspeita e como o Wumpus deve responder.",
							enabled: security.enabled,
							onEnabledChange: (value) => setModuleEnabled("security", value)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-5 xl:grid-cols-[1fr_0.85fr]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Detectar uma raid" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid gap-3 sm:grid-cols-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
												id: "raid-join-limit",
												label: "Entradas suspeitas",
												value: Number(security.config.raidJoinThreshold ?? 12),
												min: 2,
												max: 500,
												onChange: (value) => updateConfig("security", { raidJoinThreshold: value })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
												id: "raid-window",
												label: "Dentro de (segundos)",
												value: Number(security.config.raidWindowSeconds ?? 60),
												min: 5,
												max: 3600,
												onChange: (value) => updateConfig("security", { raidWindowSeconds: value })
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "m-0 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground",
											children: [
												raidResponseDescription(asString(security.config.response, "lockdown_review")),
												" O alerta começa em ",
												Number(security.config.raidJoinThreshold ?? 12),
												" entradas em ",
												Number(security.config.raidWindowSeconds ?? 60),
												" segundos."
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											id: "raid-response",
											label: "Resposta ao detectar",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
												id: "raid-response",
												value: asString(security.config.response, "lockdown_review"),
												onChange: (event) => updateConfig("security", { response: event.target.value }),
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "alert",
														children: "Enviar alerta para a equipe"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "lockdown_review",
														children: "Ativar lockdown e pedir revisão"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "auto",
														children: "Aplicar timeout automaticamente"
													})
												]
											})
										}),
										asString(security.config.response) === "auto" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "rounded-lg border border-warn/30 bg-warn/10 p-3",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
												label: "Confirmo o timeout automático de raid",
												description: "O bot pode limitar membros que entrarem durante a detecção. Confira hierarquia e permissões antes de ativar.",
												checked: Boolean(security.config.autoResponseConfirmed),
												onChange: (value) => updateConfig("security", { autoResponseConfirmed: value })
											})
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid gap-3 sm:grid-cols-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
												id: "account-age",
												label: "Idade mínima da conta (horas)",
												value: Number(security.config.minAccountAgeHours ?? 24),
												min: 0,
												max: 87600,
												onChange: (value) => updateConfig("security", { minAccountAgeHours: value }),
												hint: "0 desliga"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
												id: "quarantine-duration",
												label: "Timeout da quarentena (minutos)",
												value: Number(security.config.timeoutMinutes ?? 60),
												min: 1,
												max: 40320,
												onChange: (value) => updateConfig("security", { timeoutMinutes: value })
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
											label: "Isolar contas abaixo da idade mínima",
											description: "Registra o alerta e aplica timeout às contas novas demais.",
											checked: Boolean(security.config.quarantineNewMembers),
											onChange: (value) => updateConfig("security", { quarantineNewMembers: value })
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Quem recebe e quem é confiável" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											id: "alert-channel",
											label: "Canal de alertas",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
												id: "alert-channel",
												kind: "text",
												value: asString(security.config.alertChannelId),
												onChange: (alertChannelId) => updateConfig("security", { alertChannelId }),
												placeholder: "Selecione um canal"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos avisados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
											value: asList(security.config.alertStaffRoleIds),
											onChange: (alertStaffRoleIds) => updateConfig("security", { alertStaffRoleIds }),
											placeholder: "Adicionar cargo da equipe…"
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos confiáveis" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
											value: asList(security.config.trustedRoleIds),
											onChange: (trustedRoleIds) => updateConfig("security", { trustedRoleIds }),
											placeholder: "Adicionar cargo confiável…"
										})] })
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Teste de cenário" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-1 text-sm text-muted-foreground",
											children: "Simulação local dos limites. Não altera permissões nem publica alertas no Discord."
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
											id: "raid-sim-count",
											label: "Quantas pessoas entram",
											value: raidTestCount,
											min: 0,
											max: 1e3,
											onChange: setRaidTestCount
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "outline",
											onClick: () => {
												const threshold = Number(security.config.raidJoinThreshold ?? 12);
												const response = asString(security.config.response, "lockdown_review");
												setRaidTestResult(raidTestCount < threshold ? `Não atingiria o limite de ${threshold} entradas.` : response === "lockdown_review" ? `Atingiria o limite de ${threshold}; o bot ativaria o lockdown.` : response === "auto" ? security.config.autoResponseConfirmed ? `Atingiria o limite; o bot aplicaria timeout aos membros que entrarem durante a detecção.` : "Atingiria o limite, mas timeout automático está aguardando confirmação." : `Atingiria o limite; o bot enviaria um alerta para a equipe.`);
											},
											children: "Simular detecção de raid"
										}),
										raidTestResult ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 rounded-lg bg-muted px-3 py-2 text-sm",
											role: "status",
											children: raidTestResult
										}) : null
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Checklist de configuração" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckLine, {
											ok: Boolean(asString(security.config.alertChannelId)),
											label: "Canal para receber alertas selecionado"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckLine, {
											ok: asList(security.config.trustedRoleIds).length > 0,
											label: "Cargos da equipe definidos como confiáveis"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckLine, {
											ok: asString(security.config.response) !== "auto" || Boolean(security.config.autoResponseConfirmed),
											label: "Timeout automático de raid confirmado, se selecionado"
										})
									]
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "verification",
						className: "mt-5 space-y-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, {
							title: "Verificação de membros",
							description: "Restrinja o acesso de novos membros até que confirmem pelo painel no Discord.",
							enabled: Boolean(security.config.verificationEnabled),
							onEnabledChange: (value) => {
								if (value) publishVerification();
								else setConfirmAction("restore_verification");
							}
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-5 xl:grid-cols-[1fr_0.8fr]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								className: "space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Preparar a verificação" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-sm text-muted-foreground",
										children: "Na ativação, o Wumpus registra as permissões atuais para poder restaurá-las depois. Escolha os destinos antes de publicar."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "verification-channel",
										label: "Canal do painel",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
											id: "verification-channel",
											kind: "text",
											value: verificationChannelId,
											onChange: setVerificationChannelId,
											placeholder: "Selecione um canal"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										id: "verified-role",
										label: "Cargo concedido após a confirmação",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
											id: "verified-role",
											kind: "role",
											value: verifiedRoleId,
											onChange: setVerifiedRoleId,
											placeholder: "Selecione um cargo"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-lg border border-border px-3 py-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Antes de ativar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 space-y-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckLine, {
													ok: Boolean(verificationChannelId),
													label: "Canal de verificação escolhido"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckLine, {
													ok: Boolean(verifiedRoleId),
													label: "Cargo verificado escolhido"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionCheckInline, {
													label: "Gerenciar canais",
													value: permissions?.manageChannels ?? null,
													botStatus: readiness?.status ?? "unknown"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionCheckInline, {
													label: "Gerenciar cargos",
													value: permissions?.manageRoles ?? null,
													botStatus: readiness?.status ?? "unknown"
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											onClick: () => void publishVerification(),
											disabled: actionBusy || !verificationChannelId || !verifiedRoleId || permissions?.manageChannels === false || permissions?.manageRoles === false,
											children: security.config.verificationEnabled ? "Publicar painel novamente" : "Ativar e publicar painel"
										}), security.config.verificationEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "outline",
											onClick: () => setConfirmAction("restore_verification"),
											disabled: actionBusy,
											children: "Restaurar permissões"
										}) : null]
									}),
									security.config.verificationEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "m-0 flex items-center gap-2 text-sm text-ok",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-4" }), "Verificação marcada como ativa na configuração."]
									}) : null
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4",
								children: [
									"            ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
										className: "space-y-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "O que muda no Discord" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 text-sm leading-6 text-muted-foreground",
												children: "O bot restringe a visualização dos canais para @everyone e libera o cargo selecionado após a confirmação. Canais do Onboarding que o Discord exige manter públicos continuam visíveis; os demais canais, inclusive os criados durante a verificação, recebem a regra."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm",
												children: "Confira o acesso dos cargos de equipe antes de ativar. Use “Restaurar permissões” para desfazer as alterações salvas pelo Wumpus."
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
										className: "space-y-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Permissões do bot" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionStatus, {
												label: "Gerenciar canais",
												value: permissions?.manageChannels ?? null,
												botStatus: readiness?.status ?? "unknown"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionStatus, {
												label: "Gerenciar cargos",
												value: permissions?.manageRoles ?? null,
												botStatus: readiness?.status ?? "unknown"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm",
												children: "Para conceder o cargo, o cargo mais alto do Wumpus precisa ficar acima do cargo verificado. No Discord, ajuste essa ordem em Configurações do servidor > Cargos."
											})
										]
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "antinuke",
						className: "mt-5 space-y-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeading, {
							title: "Anti-nuke",
							description: "Receba alertas sobre mudanças destrutivas e configure uma resposta proporcional.",
							enabled: security.enabled,
							onEnabledChange: (value) => setModuleEnabled("security", value)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-5 xl:grid-cols-[1fr_0.85fr]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
										className: "space-y-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "O que monitorar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "divide-y divide-border",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
													label: "Banimentos em massa",
													description: "Conta banimentos realizados em sequência.",
													checked: security.config.alertOnMassBan !== false,
													onChange: (value) => updateConfig("security", { alertOnMassBan: value })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
													label: "Exclusão de canais",
													checked: security.config.alertOnMassChannelDelete !== false,
													onChange: (value) => updateConfig("security", { alertOnMassChannelDelete: value })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
													label: "Exclusão de cargos",
													checked: security.config.alertOnMassRoleDelete !== false,
													onChange: (value) => updateConfig("security", { alertOnMassRoleDelete: value })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
													label: "Criação de webhooks",
													checked: security.config.alertOnMassWebhookCreate !== false,
													onChange: (value) => updateConfig("security", { alertOnMassWebhookCreate: value })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
													label: "Criação de convites",
													checked: security.config.alertOnMassInviteCreate !== false,
													onChange: (value) => updateConfig("security", { alertOnMassInviteCreate: value })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
													label: "Menções repetidas a @everyone",
													checked: security.config.alertOnEveryoneMentions !== false,
													onChange: (value) => updateConfig("security", { alertOnEveryoneMentions: value })
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
										className: "space-y-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Limites de detecção" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid gap-3 sm:grid-cols-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
													id: "nuke-threshold",
													label: "Ações suspeitas",
													value: Number(security.config.nukeActionThreshold ?? 5),
													min: 2,
													max: 100,
													onChange: (value) => updateConfig("security", { nukeActionThreshold: value })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
													id: "nuke-window",
													label: "Dentro de (segundos)",
													value: Number(security.config.nukeWindowSeconds ?? 30),
													min: 5,
													max: 3600,
													onChange: (value) => updateConfig("security", { nukeWindowSeconds: value })
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												id: "lockdown-message",
												label: "Mensagem durante o lockdown",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
													id: "lockdown-message",
													value: asString(security.config.lockdownMessage),
													maxLength: 1e3,
													rows: 3,
													onChange: (event) => updateConfig("security", { lockdownMessage: event.target.value })
												})
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
										className: "space-y-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Confiança e alertas" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos protegidos contra alertas" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
												value: asList(security.config.trustedRoleIds),
												onChange: (trustedRoleIds) => updateConfig("security", { trustedRoleIds }),
												placeholder: "Adicionar cargo confiável…"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos liberados de verificações de @everyone" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
												value: asList(security.config.whitelistRoleIds),
												onChange: (whitelistRoleIds) => updateConfig("security", { whitelistRoleIds }),
												placeholder: "Adicionar cargo liberado…"
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												id: "nuke-alert-channel",
												label: "Canal de alertas",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
													id: "nuke-alert-channel",
													kind: "text",
													value: asString(security.config.alertChannelId),
													onChange: (alertChannelId) => updateConfig("security", { alertChannelId }),
													placeholder: "Selecione um canal"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos avisados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
												value: asList(security.config.alertStaffRoleIds),
												onChange: (alertStaffRoleIds) => updateConfig("security", { alertStaffRoleIds }),
												placeholder: "Adicionar cargo da equipe…"
											})] })
										]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Banimento automático" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-1 text-sm text-muted-foreground",
											children: "O Wumpus pode banir o autor quando detecta ações destrutivas repetidas. Essa ação é irreversível pelo painel."
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
											label: "Banir autores reincidentes automaticamente",
											description: "Ative apenas depois de revisar os cargos confiáveis e o limiar de detecção.",
											checked: Boolean(security.config.autoBanRepeatOffenders),
											onChange: (value) => updateConfig("security", {
												autoBanRepeatOffenders: value,
												...value ? {} : { autoBanRepeatOffendersConfirmed: false }
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
												label: "Confirmo o banimento automático do anti-nuke",
												description: "Confirma apenas o banimento automático; não habilita timeout automático de raid.",
												checked: Boolean(security.config.autoBanRepeatOffendersConfirmed),
												onChange: (value) => updateConfig("security", { autoBanRepeatOffendersConfirmed: value }),
												disabled: !security.config.autoBanRepeatOffenders
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionCheckInline, {
											label: "Banir membros",
											value: permissions?.banMembers ?? null,
											botStatus: readiness?.status ?? "unknown"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: "space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "Teste de cenário" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-1 text-sm text-muted-foreground",
											children: "Prévia local dos limiares. Não cria incidente nem executa ação no Discord."
										})] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
											id: "nuke-sim-count",
											label: "Ações destrutivas simuladas",
											value: nukeTestCount,
											min: 0,
											max: 1e3,
											onChange: setNukeTestCount
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "outline",
											onClick: () => {
												const result = evaluateNuke(nukeTestCount, security.config, planAllows(guild.plan, "antiNuke"));
												setNukeTestResult(result.triggered ? result.lockdown ? "O limite seria atingido e o lockdown seria acionado pelo anti-nuke." : "O limite seria atingido; o plano atual só permite registrar o alerta." : "O limite não seria atingido.");
											},
											children: "Simular detecção"
										}),
										nukeTestResult ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 rounded-lg bg-muted px-3 py-2 text-sm",
											role: "status",
											children: nukeTestResult
										}) : null,
										!planAllows(guild.plan, "antiNuke") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 rounded-lg bg-warn/10 px-3 py-2 text-sm text-muted-foreground",
											children: "O plano atual registra o alerta; não aplica contenção automática anti-nuke."
										}) : null
									]
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "incidents",
						className: "mt-5 space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-end justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-lg font-semibold",
									children: "Alertas e incidentes"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 mt-1 text-sm text-muted-foreground",
									children: "Eventos de segurança e AutoMod lidos da auditoria real do bot. Revisões ficam salvas por servidor."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
										"aria-label": "Filtrar alertas por estado",
										className: "w-auto min-w-36",
										value: eventFilter,
										onChange: (event) => setEventFilter(event.target.value),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "open",
												children: "Aguardando revisão"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "reviewed",
												children: "Revisados"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "all",
												children: "Todos os eventos"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
										"aria-label": "Filtrar alertas por gravidade",
										className: "w-auto min-w-36",
										value: eventSeverity,
										onChange: (event) => setEventSeverity(event.target.value),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "all",
												children: "Todas as gravidades"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "critical",
												children: "Críticos"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "warning",
												children: "Avisos"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "info",
												children: "Informativos"
											})
										]
									})]
								})]
							}),
							eventError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
								role: "alert",
								children: eventError
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SecurityEventList, {
								events: filteredEvents,
								onReview: markReviewed,
								onOpen: goToEventModule,
								onLockdown: () => setConfirmAction("lockdown_on"),
								lockdown: lockdownActive
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 flex items-center gap-2 text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-3.5" }), "“Revisado” registra que a equipe viu o evento; não altera o estado do incidente no Discord."]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: Boolean(confirmAction),
				onOpenChange: (open) => {
					if (!open && !actionBusy) setConfirmAction(null);
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: confirmAction === "lockdown_on" ? "Ativar lockdown neste servidor?" : confirmAction === "lockdown_off" ? "Encerrar o lockdown?" : "Restaurar permissões da verificação?" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDesc, { children: [
						confirmAction === "lockdown_on" ? "O bot vai restringir o envio de mensagens nos canais públicos. A equipe ainda poderá orientar as pessoas pela mensagem de lockdown configurada." : confirmAction === "lockdown_off" ? "O bot vai restaurar as permissões de envio anteriores que foram salvas ao ativar o lockdown." : "O bot vai desfazer as restrições de visualização que foram salvas ao configurar a verificação de membros.",
						" A ação só será considerada concluída quando o bot confirmar a execução.",
						confirmPermissionMissing ? " O Wumpus não possui as permissões necessárias neste servidor; corrija-as antes de continuar." : ""
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							onClick: () => setConfirmAction(null),
							disabled: actionBusy,
							children: "Cancelar"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: confirmAction === "lockdown_on" ? "destructive" : "default",
							onClick: () => void executeConfirmedAction(),
							disabled: actionBusy || confirmPermissionMissing,
							children: actionBusy ? "Aguardando…" : confirmAction === "lockdown_on" ? "Ativar lockdown" : confirmAction === "lockdown_off" ? "Encerrar lockdown" : "Restaurar permissões"
						})]
					})
				] })
			})
		]
	});
}
function SectionHeading({ title, description, enabled, onEnabledChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "flex flex-wrap items-end justify-between gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "m-0 text-xl font-semibold",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "m-0 mt-1 max-w-2xl text-sm leading-6 text-muted-foreground",
			children: description
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "flex min-h-10 items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: enabled ? "Ligado" : "Pausado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
				checked: enabled,
				onCheckedChange: onEnabledChange,
				"aria-label": `${enabled ? "Pausar" : "Ativar"} ${title}`
			})]
		})]
	});
}
function SectionTitle({ title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
		className: "m-0 text-base font-semibold",
		children: title
	});
}
function ToggleRow({ label, description, checked, onChange, disabled = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex min-h-12 items-center justify-between gap-4 py-2 ${disabled ? "opacity-55" : ""}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-sm font-medium",
				children: label
			}), description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 mt-0.5 text-xs leading-5 text-muted-foreground",
				children: description
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
			checked,
			onCheckedChange: onChange,
			disabled,
			"aria-label": label
		})]
	});
}
function Field({ id, label, children, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
				htmlFor: id,
				children: label
			}),
			children,
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-xs text-muted-foreground",
				children: hint
			}) : null
		]
	});
}
function NumberField({ id, label, value, min, max, onChange, disabled = false, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
		id,
		label,
		hint,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			id,
			type: "number",
			min,
			max,
			value,
			disabled,
			onChange: (event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))
		})
	});
}
function ListField({ id, label, hint, value, onChange, disabled }) {
	const serialized = value.join("\n");
	const [draft, setDraft] = (0, import_react.useState)(serialized);
	(0, import_react.useEffect)(() => setDraft(serialized), [serialized]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
		id,
		label,
		hint,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
			id,
			rows: 4,
			value: draft,
			disabled,
			onChange: (event) => setDraft(event.target.value),
			onBlur: () => onChange(draft.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))
		})
	});
}
function ModuleStatusRow({ label, detail, enabled, onChange, icon: Icon }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-[4.4rem] items-center gap-3 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
				className: "size-4 shrink-0 text-primary",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-sm font-medium",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-0.5 truncate text-xs text-muted-foreground",
					children: detail
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				tone: enabled ? "ok" : "default",
				children: enabled ? "Ligado" : "Pausado"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
				checked: enabled,
				onCheckedChange: onChange,
				"aria-label": `${enabled ? "Pausar" : "Ativar"} ${label}`
			})
		]
	});
}
function ReadinessRow({ label, detail, status, tone, onClick }) {
	const content = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0 flex-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-sm font-medium",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 mt-0.5 truncate text-xs text-muted-foreground",
				children: detail
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
			tone,
			children: status
		}),
		onClick ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-muted-foreground" }) : null
	] });
	return onClick ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "flex min-h-[4.4rem] w-full items-center gap-3 py-3 text-left",
		children: content
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-[4.4rem] items-center gap-3 py-3",
		children: content
	});
}
function BotConnectionStatus({ readiness, error }) {
	const status = readiness?.status ?? "unknown";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `mt-1 size-2.5 rounded-full ${status === "online" ? "bg-ok" : status === "offline" || status === "not_installed" ? "bg-destructive" : "bg-warn"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "m-0 text-sm font-medium",
			children: status === "online" ? "Conectado ao servidor" : status === "offline" ? "Sem conexão recente" : status === "not_installed" ? "Bot não está neste servidor" : "Estado indisponível"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "m-0 mt-1 text-xs text-muted-foreground",
			children: readiness?.lastSeenAt ? `Último sinal ${formatRelative(readiness.lastSeenAt)}${readiness.pingMs == null ? "" : ` · ${readiness.pingMs} ms`}` : error ?? "Aguardando o primeiro sinal do bot."
		})] })]
	});
}
function PermissionStatus({ label, value, botStatus }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-10 items-center justify-between gap-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
			tone: botStatus === "online" && value === false ? "danger" : value ? "ok" : "default",
			children: botStatus !== "online" || value === null ? "Aguardando" : value ? "Disponível" : "Falta permissão"
		})]
	});
}
function PermissionCheckInline({ label, value, botStatus }) {
	const missing = botStatus === "online" && value === false;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: `m-0 flex items-center gap-2 text-sm ${missing ? "text-destructive" : "text-muted-foreground"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-1.5 rounded-full ${missing ? "bg-destructive" : value ? "bg-ok" : "bg-muted-foreground/50"}` }),
			label,
			": ",
			botStatus !== "online" || value === null ? "a confirmar" : value ? "disponível" : "falta ao bot"
		]
	});
}
function CheckLine({ ok, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: `m-0 flex items-center gap-2 text-sm ${ok ? "text-ok" : "text-muted-foreground"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `grid size-4 place-items-center rounded-full ${ok ? "bg-ok/15" : "bg-muted"}`,
			children: ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3" }) : null
		}), label]
	});
}
function PausedNotice({ name, onResume }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn/10 px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "m-0 text-sm",
			children: [name, " está pausado. As regras abaixo não estão sendo aplicadas pelo bot."]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			size: "sm",
			variant: "outline",
			onClick: onResume,
			children: "Ativar agora"
		})]
	});
}
function SecurityEventList({ events, onReview, onOpen, onLockdown, lockdown, compact = false }) {
	if (!events.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-dashed border-border px-4 py-8 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
				className: "mx-auto size-6 text-ok",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-0 mt-2 text-sm font-medium",
				children: "Nenhum alerta nesta lista"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 mt-1 text-xs text-muted-foreground",
				children: "Os eventos reais do AutoMod e da proteção aparecem aqui."
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "m-0 divide-y divide-border rounded-xl border border-border bg-card p-0",
		children: events.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex flex-wrap items-start gap-3 px-4 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `mt-1.5 size-2 shrink-0 rounded-full ${event.severity === "critical" ? "bg-destructive" : event.severity === "warning" ? "bg-warn" : "bg-info"}` }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-sm font-semibold",
									children: event.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: event.severity === "critical" ? "danger" : event.severity === "warning" ? "warn" : "info",
									children: severityLabel(event.severity)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: event.module === "automod" ? "AutoMod" : "Segurança" }),
								event.acknowledged ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "ok",
									children: "Revisado"
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 mt-1 text-sm text-muted-foreground",
							children: event.detail
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "m-0 mt-1 text-xs text-muted-foreground",
							children: [
								formatRelative(event.at),
								event.targetId ? ` · usuário ${event.targetId}` : "",
								event.channelId ? ` · canal ${event.channelId}` : ""
							]
						}),
						!compact || !event.acknowledged ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "outline",
									onClick: () => onOpen(event),
									children: ["Ver configuração", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })]
								}),
								!event.acknowledged ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => onReview(event.id),
									children: "Marcar como revisado"
								}) : null,
								event.eventType.startsWith("security_") && !lockdown && event.severity === "critical" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "destructive",
									onClick: onLockdown,
									children: "Ativar lockdown"
								}) : null
							]
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 text-xs text-muted-foreground",
					children: event.acknowledged ? "Visto" : "Pendente"
				})
			]
		}, event.id))
	});
}
function getPresetChanges(preset, automodConfig, securityConfig, ticketsConfig) {
	const configs = {
		automod: automodConfig,
		security: securityConfig,
		tickets: ticketsConfig
	};
	return Object.entries(presets[preset].patch).flatMap(([module, patch]) => Object.entries(patch ?? {}).flatMap(([key, value]) => {
		const current = configs[module]?.[key];
		if (JSON.stringify(current) === JSON.stringify(value)) return [];
		return [{
			key: `${module}.${key}`,
			module,
			label: configFieldLabels[key] ?? key,
			value: formatConfigValue(value)
		}];
	}));
}
function formatConfigValue(value) {
	if (typeof value === "boolean") return value ? "ligado" : "desligado";
	if (Array.isArray(value)) return value.length ? value.join(", ") : "lista limpa";
	if (typeof value === "number") return String(value);
	if (value === "smart") return "Inteligente";
	if (value === "strict") return "Estrito";
	if (value === "passive") return "Só avisar";
	if (value === "delete") return "Apagar";
	if (value === "warn") return "Avisar";
	return String(value);
}
function severityLabel(severity) {
	return severity === "critical" ? "Crítico" : severity === "warning" ? "Aviso" : "Informativo";
}
function actionLabel(action) {
	return action === "timeout" || action === "mute" ? "apagar e aplicar timeout" : action === "warn" ? "avisar" : "apagar";
}
function raidResponseDescription(response) {
	return response === "alert" ? "O bot avisa a equipe e não aplica restrições automaticamente." : response === "auto" ? "O bot aplica timeout a membros que entrarem durante a detecção; exige confirmação separada." : "Ao detectar uma raid, o bot ativa o lockdown e envia um alerta para revisão da equipe.";
}
function channelLabel(channels, id) {
	return channels.find((channel) => channel.id === id || channel.name === id)?.name ? `Painel em #${channels.find((channel) => channel.id === id || channel.name === id)?.name}` : "Canal não encontrado na lista sincronizada";
}
var $$splitComponentImporter$4 = () => import("./settings-3Jn16XGf.mjs");
var Route$4 = createFileRoute("/app/settings")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./staff-zhkqnJan.mjs");
var Route$3 = createFileRoute("/app/staff")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./stats-Bmh755o4.mjs");
var Route$2 = createFileRoute("/app/stats")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./tickets-BAdT775G.mjs");
var Route$1 = createFileRoute("/app/tickets")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./auth.discord.callback-xpBUXVMj.mjs");
var Route = createFileRoute("/auth/discord/callback")({
	validateSearch: (s) => ({
		code: typeof s.code === "string" ? s.code : "",
		state: typeof s.state === "string" ? s.state : "",
		error: typeof s.error === "string" ? s.error : ""
	}),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var IndexRoute = Route$14.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$15
});
var AdminRoute = Route$13.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$15
});
var AppRoute = Route$12.update({
	id: "/app",
	path: "/app",
	getParentRoute: () => Route$15
});
var EntrarRoute = Route$11.update({
	id: "/entrar",
	path: "/entrar",
	getParentRoute: () => Route$15
});
var AppIndexRoute = Route$10.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppRoute
});
var AppFormsRoute = Route$9.update({
	id: "/forms",
	path: "/forms",
	getParentRoute: () => AppRoute
});
var AppKnowledgeRoute = Route$8.update({
	id: "/knowledge",
	path: "/knowledge",
	getParentRoute: () => AppRoute
});
var AppLogsRoute = Route$7.update({
	id: "/logs",
	path: "/logs",
	getParentRoute: () => AppRoute
});
var AppModerationRoute = Route$6.update({
	id: "/moderation",
	path: "/moderation",
	getParentRoute: () => AppRoute
});
var AppProtectRoute = Route$5.update({
	id: "/protect",
	path: "/protect",
	getParentRoute: () => AppRoute
});
var AppSettingsRoute = Route$4.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AppRoute
});
var AppStaffRoute = Route$3.update({
	id: "/staff",
	path: "/staff",
	getParentRoute: () => AppRoute
});
var AppStatsRoute = Route$2.update({
	id: "/stats",
	path: "/stats",
	getParentRoute: () => AppRoute
});
var AppTicketsRoute = Route$1.update({
	id: "/tickets",
	path: "/tickets",
	getParentRoute: () => AppRoute
});
var AuthDiscordCallbackRoute = Route.update({
	id: "/auth/discord/callback",
	path: "/auth/discord/callback",
	getParentRoute: () => Route$15
});
var AppRouteChildren = {
	AppFormsRoute,
	AppKnowledgeRoute,
	AppLogsRoute,
	AppModerationRoute,
	AppProtectRoute,
	AppSettingsRoute,
	AppStaffRoute,
	AppStatsRoute,
	AppTicketsRoute,
	AppIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AdminRoute,
	AppRoute: AppRoute._addFileChildren(AppRouteChildren),
	EntrarRoute,
	AuthDiscordCallbackRoute
};
var routeTree = Route$15._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { formatRelative as $, getGuildFormSubmissions as A, requestPanelPublish as B, asList as C, getFormReviewStatus as D, getDiscordGuildResources as E, getServerGroups as F, shouldAutoClose as G, saveServerGroups as H, getTicketActionStatus as I, useActiveGuild as J, ticketSla as K, nextModerationAction as L, getGuildPlanUsage as M, getGuildTickets as N, getGuildActivity as O, getPublishStatus as P, cn as Q, renderTemplate as R, SearchSelect as S, effectiveStrikes as T, scoreKnowledgeArticle as U, requestTicketAction as V, searchArticles as W, useModule as X, useGuildMembers as Y, useWumpus as Z, Button as _, TabsList as a, resolveAccess as at, DiscordSelect as b, Input as c, Textarea as d, formatTime as et, Dialog as f, Card as g, DialogTitle as h, TabsContent as i, logoutDashboardSession as it, getGuildKnowledgeFaqSuggestions as j, getGuildAudit as k, Label as l, DialogDesc as m, Route as n, uid as nt, TabsTrigger as o, startSession as ot, DialogContent as p, updateGuildKnowledgeFaqSuggestion as q, Tabs as r, getOwnerGuildDiagnostics as rt, Switch as s, router_exports as t, initials as tt, NativeSelect as u, Badge as v, asString as w, Route$11 as x, DiscordMultiSelect as y, requestFormReview as z };
