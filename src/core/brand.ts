/**
 * Identidade do produto e catálogo de módulos.
 * Este arquivo é compartilhado entre a dashboard e o bot: os IDs dos módulos
 * são persistidos no Postgres, então nunca devem ser renomeados — apenas os
 * rótulos visuais mudam.
 */

export const brand = {
  name: "Wumpus",
  slug: "wumpus",
  version: "2.0.0-prototype",
  tagline: "A central de comando da sua comunidade.",
  description:
    "Proteção, atendimento, equipe e automações em um só lugar — configuração por grupo, com exceções por servidor.",
  legal: "HubOrder"
} as const;

export type ModuleGroupId = "manage" | "protect" | "attend" | "intelligence";

export const moduleGroups: ReadonlyArray<{ id: ModuleGroupId; label: string }> = [
  { id: "manage", label: "Gerenciar" },
  { id: "protect", label: "Proteger" },
  { id: "attend", label: "Atender" },
  { id: "intelligence", label: "Inteligência" }
];

export type ModuleId =
  | "servers"
  | "statistics"
  | "staff"
  | "roles"
  | "automations"
  | "integrations"
  | "moderation"
  | "automod"
  | "security"
  | "logs"
  | "tickets"
  | "forms"
  | "knowledge"
  | "ocr";

export type ModuleDescriptor = {
  id: ModuleId;
  label: string;
  group: ModuleGroupId;
  icon: string;
  description: string;
};

export const modules: ReadonlyArray<ModuleDescriptor> = [
  { id: "servers", label: "Servidores", group: "manage", icon: "server", description: "Conexão, sincronização e saúde da comunidade." },
  { id: "statistics", label: "Estatísticas", group: "manage", icon: "chart", description: "Crescimento, atividade e desempenho." },
  { id: "staff", label: "Gestão de staff", group: "manage", icon: "users", description: "Equipe, atividade e responsabilidades." },
  { id: "roles", label: "Cargos e permissões", group: "manage", icon: "key", description: "Cargos, permissões e rascunhos seguros com IA." },
  { id: "automations", label: "Automações", group: "manage", icon: "bolt", description: "Gatilhos, condições e ações com aprovação." },
  { id: "integrations", label: "Integrações", group: "manage", icon: "plug", description: "Webhooks e integrações externas autorizadas." },
  { id: "moderation", label: "Moderação", group: "protect", icon: "ban", description: "Punições, ocorrências e histórico dos membros." },
  { id: "automod", label: "AutoMod", group: "protect", icon: "cpu", description: "Proteção contra spam, convites e conteúdo repetido." },
  { id: "security", label: "Anti-raid e anti-nuke", group: "protect", icon: "shield", description: "Detecção de raid, nuke e ações destrutivas." },
  { id: "logs", label: "Logs e auditoria", group: "protect", icon: "bell", description: "Histórico de mudanças, ações e alertas." },
  { id: "tickets", label: "Tickets e atendimento", group: "attend", icon: "ticket", description: "Suporte, compras, denúncias e transcrições." },
  { id: "forms", label: "Formulários", group: "attend", icon: "clipboard", description: "Candidaturas e inscrições por páginas." },
  { id: "knowledge", label: "Base de conhecimento", group: "intelligence", icon: "book", description: "Conteúdo aprovado para respostas assistidas." },
  { id: "ocr", label: "OCR de imagens", group: "intelligence", icon: "image", description: "Leitura de imagens e revisão de conteúdo suspeito." }
];

export function modulesOf(group: ModuleGroupId): ModuleDescriptor[] {
  return modules.filter((entry) => entry.group === group);
}
