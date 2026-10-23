import { n as jwtVerify, t as SignJWT } from "../_libs/jose.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-token-CaBlZnli.js
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
	transcripts: 1,
	ocr: 1,
	webhooks: 2
};
function planAllows(plan, feature) {
	return PLAN_RANK[plan] >= FEATURE_RANK[feature];
}
/** Créditos OCR mensais por assinatura; null representa uso sem teto. */
function monthlyOcrLimit(plan) {
	if (plan === "pro") return 500;
	if (plan === "escala" || plan === "vitalicio") return null;
	return 0;
}
var SHARD_STORE = {
	id: "01a09384-95b0-707d-8fc7-d82191e14827",
	name: "Hub Express",
	slug: "hubexpress",
	url: "https://shardpay.app/pt-br/store/hubexpress"
};
function brl(cents, recurring) {
	const value = (cents / 100).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL"
	});
	return recurring ? `${value}/mês` : value;
}
function checkoutUrl(productId) {
	return `https://shardpay.app/pt-br/checkout/${productId}`;
}
var plans = [
	{
		id: "essencial",
		productId: "01a09c50-6e8f-743f-8d2b-7c2d91226abc",
		name: "WumPlus Essencial",
		priceCents: 1490,
		recurring: true,
		price: brl(1490, true),
		blurb: "Um servidor, proteção completa e atendimento. Sem IA.",
		features: [
			"1 servidor",
			"AutoMod, anti-raid e anti-nuke",
			"Moderação, logs, tickets e formulários",
			"Automações",
			"Suporte da comunidade"
		],
		checkoutUrl: checkoutUrl("01a09c50-6e8f-743f-8d2b-7c2d91226abc")
	},
	{
		id: "pro",
		productId: "01a09c5a-d344-78fa-9ead-77fbd322c4f5",
		name: "WumPlus Pro",
		priceCents: 2990,
		recurring: true,
		price: brl(2990, true),
		blurb: "Transcrição, knowledge com IA e 500 OCR por mês.",
		features: [
			"5 servidores",
			"Tudo do Essencial",
			"Tickets com transcrição",
			"Knowledge com IA",
			"500 OCR por mês",
			"E-mail prioritário"
		],
		highlight: true,
		checkoutUrl: checkoutUrl("01a09c5a-d344-78fa-9ead-77fbd322c4f5")
	},
	{
		id: "escala",
		productId: "01a09c5b-c086-7eff-989b-7c6516d93785",
		name: "WumPlus Escala",
		priceCents: 5990,
		recurring: true,
		price: brl(5990, true),
		blurb: "Servidores, IA e OCR sem teto, com onboarding.",
		features: [
			"Servidores ilimitados",
			"Tudo do Pro",
			"IA e OCR ilimitados",
			"Webhooks ilimitados",
			"Suporte prioritário e onboarding"
		],
		checkoutUrl: checkoutUrl("01a09c5b-c086-7eff-989b-7c6516d93785")
	},
	{
		id: "vitalicio",
		productId: "01a09c61-e028-7e49-974c-8b225ab3057b",
		name: "WumPlus Vitalício",
		priceCents: 34990,
		recurring: false,
		price: brl(34990, false),
		blurb: "Pagamento único. O mesmo acesso do Escala, sem mensalidade.",
		features: [
			"Pagamento único",
			"Mesmos limites do Escala",
			"Sem renovação"
		],
		checkoutUrl: checkoutUrl("01a09c61-e028-7e49-974c-8b225ab3057b")
	}
];
var CYCLE_DISCOUNTS = [
	{
		id: "quarterly",
		label: "trimestral",
		discount: 5
	},
	{
		id: "semiannually",
		label: "semestral",
		discount: 10
	},
	{
		id: "yearly",
		label: "anual",
		discount: 18
	}
];
var LEGACY = {
	comunidade: "essencial",
	loja: "pro",
	rede: "escala"
};
function normalizePlan(value) {
	if (!value) return "essencial";
	if (value in LEGACY) return LEGACY[value];
	if (value === "essencial" || value === "pro" || value === "escala" || value === "vitalicio") return value;
	return planIdFromName(value) ?? "essencial";
}
function planIdFromName(name) {
	const n = name.toLowerCase();
	if (n.includes("vital")) return "vitalicio";
	if (n.includes("escala")) return "escala";
	if (n.includes("pro")) return "pro";
	if (n.includes("essencial")) return "essencial";
	return null;
}
function planById(id) {
	return plans.find((p) => p.id === id) ?? plans[0];
}
function serverLimit(plan) {
	if (plan === "essencial") return 1;
	if (plan === "pro") return 5;
	return null;
}
/**
* Token de sessao assinado — a decisao de acesso sai do navegador.
*
* O problema que isto resolve: o painel decidia tudo no cliente. `isAdmin`,
* `plan` e a lista de servidores viviam no localStorage, entao bastava editar
* o campo `id` para o do dono e a checagem passava. Revalidar na leitura nao
* resolve: o dado continua vindo do cliente.
*
* O servidor assina (HMAC-SHA256, via `jose`) a identidade temporária do
* usuário. Os servidores autorizados ficam no armazenamento da sessão no
* servidor para que uma conta com muitos servidores não exceda o limite de
* tamanho de cookies. A credencial trafega somente em cookie HttpOnly.
*/
var ALG = "HS256";
var TTL = "30d";
/** Chave antiga removida durante a migração para cookie HttpOnly. */
var SESSION_TOKEN_KEY = "wumpus-session-token";
/** Maximum accepted legacy marker length in server-function request schemas. */
var SESSION_TOKEN_MAX_LENGTH = 16384;
var COOKIE_SESSION_MARKER = "cookie-session";
function getStoredSessionToken() {
	if (typeof window === "undefined") return "";
	try {
		window.localStorage.removeItem(SESSION_TOKEN_KEY);
	} catch {}
	return COOKIE_SESSION_MARKER;
}
/**
* Segredo do servidor.
*
* Exige um segredo independente do OAuth do Discord. A chave precisa ter pelo
* menos 32 bytes para limitar o impacto de vazamentos e permitir rotação
* independente das credenciais do bot e do provedor.
*/
function sessionSecret() {
	const raw = process.env.WUMPUS_SESSION_SECRET?.trim() ?? "";
	if (new TextEncoder().encode(raw).byteLength < 32) return null;
	return new TextEncoder().encode(raw);
}
async function signSession(payload, secret) {
	const { guilds: _guilds, ...identity } = payload;
	return new SignJWT(identity).setProtectedHeader({ alg: ALG }).setJti(payload.sessionId).setIssuedAt().setExpirationTime(TTL).sign(secret);
}
function text(value, fallback = "") {
	return typeof value === "string" ? value : fallback;
}
/** Descarta servidor sem id — id vazio viraria chave de estado invalida. */
function parseGuilds(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => Boolean(item) && typeof item === "object").map((item) => ({
		id: text(item.id),
		name: text(item.name),
		iconUrl: typeof item.iconUrl === "string" ? item.iconUrl : null,
		owner: item.owner === true
	})).filter((guild) => guild.id.length > 0);
}
/**
* Verifica o token. Devolve `null` em QUALQUER falha — assinatura errada,
* expirado, formato invalido. Nunca lanca: quem chama trata `null` como
* "sem sessao", que e o comportamento seguro.
*/
async function verifySession(token, secret) {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
		const userId = text(payload.userId);
		const sessionId = text(payload.jti);
		if (!/^\d{17,20}$/.test(userId) || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
		return {
			sessionId,
			userId,
			username: text(payload.username),
			globalName: text(payload.globalName),
			avatar: typeof payload.avatar === "string" ? payload.avatar : null,
			mfaEnabled: payload.mfaEnabled === true,
			guilds: parseGuilds(payload.guilds)
		};
	} catch {
		return null;
	}
}
//#endregion
export { checkoutUrl as a, normalizePlan as c, planIdFromName as d, plans as f, verifySession as g, signSession as h, SHARD_STORE as i, planAllows as l, sessionSecret as m, SESSION_TOKEN_KEY as n, getStoredSessionToken as o, serverLimit as p, SESSION_TOKEN_MAX_LENGTH as r, monthlyOcrLimit as s, CYCLE_DISCOUNTS as t, planById as u };
