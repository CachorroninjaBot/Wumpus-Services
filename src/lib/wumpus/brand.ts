export const brand = {
  name: "Wumpus",
  tagline: "Atendimento claro para sua comunidade.",
  description:
    "Configure tickets, formulários e rotas da equipe em português simples. O Wumpus faz as alterações chegarem ao seu Discord.",
  legal: "HubOrder",
  invite:
    "https://discord.com/oauth2/authorize?client_id=1187601667559002225&permissions=8&scope=bot%20applications.commands",
  version: "2.0.0",
} as const;

export type ModuleGroupId = "attend" | "protect" | "team" | "intel";

export type NavId =
  | "overview"
  | "tickets"
  | "forms"
  | "staff"
  | "moderation"
  | "protect"
  | "knowledge"
  | "stats"
  | "logs"
  | "settings";

export const navItems: ReadonlyArray<{
  id: NavId;
  label: string;
  group: ModuleGroupId | "home";
  hint: string;
  path: string;
}> = [
  { id: "overview", label: "Visão geral", group: "home", hint: "Saúde, fila e o que precisa de você agora.", path: "/app" },
  { id: "tickets", label: "Atendimento", group: "attend", hint: "Tickets, SLA, transcrição e feedback.", path: "/app/tickets" },
  { id: "forms", label: "Formulários", group: "attend", hint: "Crie formulários e revise cada resposta.", path: "/app/forms" },
  { id: "staff", label: "Equipe", group: "team", hint: "Plantão, carga e tempo de resposta.", path: "/app/staff" },
  { id: "moderation", label: "Moderação", group: "protect", hint: "Advertir, silenciar, expulsar, banir.", path: "/app/moderation" },
  { id: "protect", label: "Proteção", group: "protect", hint: "AutoMod, anti-raid e presets.", path: "/app/protect" },
  { id: "knowledge", label: "Base de conhecimento", group: "intel", hint: "Respostas aprovadas para apoiar o atendimento.", path: "/app/knowledge" },
  { id: "stats", label: "Estatísticas", group: "intel", hint: "Atividade, CSAT e desempenho.", path: "/app/stats" },
  { id: "logs", label: "Auditoria", group: "protect", hint: "Tudo o que o bot e a equipe fizeram.", path: "/app/logs" },
  { id: "settings", label: "Servidor", group: "team", hint: "Boas-vindas, cargos e manutenção.", path: "/app/settings" },
];

export const groupLabels: Record<ModuleGroupId, string> = {
  attend: "Atender",
  protect: "Proteger",
  team: "Gerenciar",
  intel: "Analisar",
};

export type { PlanId } from "./catalog";
export { plans } from "./catalog";
