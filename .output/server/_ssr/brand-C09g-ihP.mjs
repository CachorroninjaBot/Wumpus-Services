//#region node_modules/.nitro/vite/services/ssr/assets/brand-C09g-ihP.js
var brand = {
	name: "Wumpus",
	tagline: "A central de comando da sua comunidade.",
	description: "Tickets com SLA, moderação com histórico, AutoMod que você testa antes de ligar. O que você configura aqui o bot realmente usa.",
	legal: "HubOrder",
	invite: "https://discord.com/oauth2/authorize?client_id=1187601667559002225&permissions=8&scope=bot%20applications.commands",
	version: "2.0.0"
};
var navItems = [
	{
		id: "overview",
		label: "Visão geral",
		group: "home",
		hint: "Saúde, fila e o que precisa de você agora.",
		path: "/app"
	},
	{
		id: "tickets",
		label: "Atendimento",
		group: "attend",
		hint: "Tickets, SLA, transcrição e feedback.",
		path: "/app/tickets"
	},
	{
		id: "forms",
		label: "Candidaturas",
		group: "attend",
		hint: "Formulários com modal e aprovação com motivo.",
		path: "/app/forms"
	},
	{
		id: "staff",
		label: "Equipe",
		group: "team",
		hint: "Plantão, carga e tempo de resposta.",
		path: "/app/staff"
	},
	{
		id: "moderation",
		label: "Moderação",
		group: "protect",
		hint: "Advertir, silenciar, expulsar, banir.",
		path: "/app/moderation"
	},
	{
		id: "protect",
		label: "Proteção",
		group: "protect",
		hint: "AutoMod, anti-raid e presets.",
		path: "/app/protect"
	},
	{
		id: "knowledge",
		label: "Inteligência",
		group: "intel",
		hint: "Base aprovada e análise de tickets.",
		path: "/app/knowledge"
	},
	{
		id: "stats",
		label: "Estatísticas",
		group: "intel",
		hint: "Atividade, CSAT e desempenho.",
		path: "/app/stats"
	},
	{
		id: "logs",
		label: "Auditoria",
		group: "protect",
		hint: "Tudo o que o bot e a equipe fizeram.",
		path: "/app/logs"
	},
	{
		id: "settings",
		label: "Servidor",
		group: "team",
		hint: "Boas-vindas, cargos e manutenção.",
		path: "/app/settings"
	}
];
var groupLabels = {
	attend: "Atender",
	protect: "Proteger",
	team: "Gerenciar",
	intel: "Inteligência"
};
//#endregion
export { groupLabels as n, navItems as r, brand as t };
