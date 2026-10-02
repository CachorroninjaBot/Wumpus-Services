//#region node_modules/.nitro/vite/services/ssr/assets/catalog-Bwk5qXYL.js
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
		blurb: "Dois servidores, proteção completa e atendimento. Sem IA.",
		features: [
			"2 servidores",
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
	if (plan === "essencial") return 2;
	if (plan === "pro") return 5;
	return null;
}
//#endregion
export { planById as a, serverLimit as c, normalizePlan as i, SHARD_STORE as n, planIdFromName as o, checkoutUrl as r, plans as s, CYCLE_DISCOUNTS as t };
