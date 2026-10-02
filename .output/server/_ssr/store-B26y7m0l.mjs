import { t as isPlatformOwner } from "./owner-GgaIkPvQ.mjs";
import { i as hoursAgo, o as minutesAgo, s as uid } from "./utils-H16dNBFI.mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./createSsrRpc-C1p7zOu_.mjs";
import { i as normalizePlan } from "./catalog-Bwk5qXYL.mjs";
import { n as moduleDefaults, r as presets, t as defaultsFor } from "./defaults-B5nsBQ51.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-B26y7m0l.js
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
var PLAN_RANK = {
	essencial: 0,
	pro: 1,
	escala: 2,
	vitalicio: 2
};
var FEATURE_RANK = {
	forms: 0,
	multiDepartment: 0,
	antiNuke: 0,
	ai: 1,
	transcripts: 1
};
function planAllows(plan, feature) {
	return PLAN_RANK[plan] >= FEATURE_RANK[feature];
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
function searchArticles(query, articles, requireApproved) {
	const q = query.trim().toLowerCase();
	if (q.length < 2) return [];
	return articles.filter((a) => !requireApproved || a.approved).map((a) => {
		const hay = `${a.title} ${a.body} ${a.tags.join(" ")}`.toLowerCase();
		return {
			a,
			score: q.split(/\s+/).reduce((s, word) => s + (hay.includes(word) ? 1 : 0), 0)
		};
	}).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).map((x) => x.a);
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
var MODULE_KEYS = Object.keys(moduleDefaults);
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
var publishGuildRuntime = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("30a37a9ee6e9b3f9bcacb568570cc71457d80b8808ca78d33d208fee7b93418f"));
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
var requestPanelPublish = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("b5230e82ec52d306c1c899b8f05536cf0e83719f5d257c240dc52d74cb23ad88"));
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
var getPublishStatus = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("b9a31d924c524dddaf890676d785aa8d2a8d9127a7a46441da06dd50c4eef0e6"));
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
		theme: "dark",
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
	/**
	* Publica a config do servidor ativo para o bot ler.
	*
	* O bot é outro processo: sem esta publicação ele nunca vê o que o painel
	* salva, e todo campo vira decoração. Falha de rede aqui não pode quebrar a
	* interface — o painel segue funcionando e tenta de novo na próxima mudança.
	*/
	const publishModules = (state) => {
		if (state.modules === publishedModules) return;
		publishedModules = state.modules;
		const guildId = state.activeGuildId;
		const modules = state.modules[guildId];
		if (!guildId || !modules) return;
		const payload = {};
		for (const [key, value] of Object.entries(modules)) {
			if (!value) continue;
			payload[key] = {
				...value.config ?? {},
				enabled: value.enabled !== false
			};
		}
		publishGuildRuntime({ data: {
			guildId,
			name: state.guilds.find((g) => g.id === guildId)?.name,
			modules: payload,
			articles: state.articles.filter((article) => article.guildId === guildId).map((article) => ({
				id: article.id,
				title: article.title,
				body: article.body,
				tags: article.tags,
				approved: article.approved
			}))
		} }).catch(() => void 0);
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
						const stored = parsed.sessionUser ?? base.sessionUser;
						const sessionUser = {
							...stored,
							isAdmin: isPlatformOwner(stored.id)
						};
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
							posts: parsed.posts ?? [],
							publishQueue: parsed.publishQueue ?? [],
							recentMessages: parsed.recentMessages ?? [],
							hydrated: true
						});
						document.documentElement.dataset.theme = parsed.theme ?? "dark";
						publishModules(get());
						return;
					}
				}
			} catch {}
			document.documentElement.dataset.theme = "dark";
			set({ hydrated: true });
			publishModules(get());
		},
		resetDemo: () => {
			const next = seedSlice();
			write({ ...next });
			set({ hydrated: true });
			document.documentElement.dataset.theme = "dark";
			audit("admin", "Demonstração restaurada ao estado inicial.", "Admin");
		},
		setTheme: (theme) => {
			document.documentElement.dataset.theme = theme;
			write({ theme });
		},
		setActiveGuild: (id) => write({ activeGuildId: id }),
		setAdmin: (on) => {
			const current = get().sessionUser;
			if (on && !isPlatformOwner(current.id)) return;
			write({ sessionUser: {
				...current,
				isAdmin: on && isPlatformOwner(current.id)
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
			const withTranscript = planAllows(state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro", "transcripts");
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
			if (!planAllows(state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro", "forms")) return {
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
			const next = !Boolean(current.config.lockdown);
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
		addArticle: (title, body, tags) => {
			const state = get();
			const article = {
				id: uid("a"),
				guildId: state.activeGuildId,
				title,
				body,
				tags,
				approved: true,
				updatedAt: Date.now()
			};
			write({ articles: [article, ...state.articles] });
			audit("knowledge", `Artigo “${title}” publicado.`);
		},
		updateArticle: (id, patch) => {
			write({ articles: get().articles.map((a) => a.id === id ? {
				...a,
				...patch,
				updatedAt: Date.now()
			} : a) });
		},
		deleteArticle: (id) => {
			write({ articles: get().articles.filter((a) => a.id !== id) });
			audit("knowledge", "Artigo removido.");
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
		publishPanel: (kind) => {
			const state = get();
			const mod = cfg(kind);
			const title = String(mod.config.panelTitle ?? kind);
			const channelRef = String(kind === "tickets" ? mod.config.panelChannelId ?? "ch_atendimento" : mod.config.reviewChannelId ?? "ch_forms");
			const job = {
				id: uid("j"),
				guildId: state.activeGuildId,
				kind,
				status: "queued",
				detail: title,
				at: Date.now()
			};
			write({ publishQueue: [job, ...state.publishQueue].slice(0, 40) });
			audit("servers", `Painel de ${kind} enviado para publicação: ${title}.`);
			requestPanelPublish({ data: {
				guildId: state.activeGuildId,
				target: kind,
				channelRef
			} }).then((result) => {
				if (!result.ok) return;
				write({ publishQueue: get().publishQueue.map((entry) => entry.id === job.id ? {
					...entry,
					status: "published"
				} : entry) });
			}).catch(() => void 0);
		},
		processQueue: () => {
			const state = get();
			const pending = state.publishQueue.filter((j) => j.guildId === state.activeGuildId && j.status === "queued");
			if (pending.length === 0) return 0;
			const posts = pending.map((job) => {
				const mod = cfg(job.kind);
				const channelId = String(job.kind === "tickets" ? mod.config.panelChannelId ?? "ch_atendimento" : mod.config.reviewChannelId ?? "ch_forms");
				return {
					id: uid("p"),
					guildId: state.activeGuildId,
					channelId,
					author: "Wumpus",
					content: `Painel publicado · ${String(mod.config.panelTitle ?? job.detail)}\n${String(mod.config.panelDescription ?? "")}`,
					at: Date.now()
				};
			});
			write({
				posts: [...posts, ...state.posts].slice(0, 60),
				publishQueue: state.publishQueue.map((j) => j.guildId === state.activeGuildId && j.status === "queued" ? {
					...j,
					status: "published"
				} : j)
			});
			audit("servers", `Fila processada: ${pending.length} painel(is).`);
			return pending.length;
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
			if (!isPlatformOwner(state.sessionUser.id)) return;
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
export { nextModerationAction as a, searchArticles as c, useActiveGuild as d, useGuildMembers as f, getPublishStatus as i, shouldAutoClose as l, useWumpus as m, asString as n, planAllows as o, useModule as p, effectiveStrikes as r, renderTemplate as s, asList as t, ticketSla as u };
