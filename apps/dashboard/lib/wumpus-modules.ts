import { type WumpusModule, wumpusModuleLabels } from "@huborder/core";

export type ModuleDescriptor = { module: WumpusModule; description: string; group: "Operação" | "Proteção" | "Atendimento" | "Inteligência" };

export const moduleDescriptors: ModuleDescriptor[] = [
  { module: "servers", group: "Operação", description: "Conexão, sincronização e saúde do servidor." },
  { module: "statistics", group: "Operação", description: "Crescimento, atividade e desempenho da comunidade." },
  { module: "moderation", group: "Proteção", description: "Punições, ocorrências, evidências e histórico dos membros." },
  { module: "automod", group: "Proteção", description: "Proteção conjunta do Wumpus e do AutoMod do Discord." },
  { module: "security", group: "Proteção", description: "Detecção de raid, nuke e ações destrutivas." },
  { module: "ocr", group: "Inteligência", description: "Leitura de imagens e revisão de conteúdo suspeito." },
  { module: "staff", group: "Operação", description: "Cargos da equipe, atividade e responsabilidades." },
  { module: "roles", group: "Operação", description: "Cargos, permissões e rascunhos seguros com IA." },
  { module: "tickets", group: "Atendimento", description: "Suporte, compras, denúncias, apelações e transcrições." },
  { module: "forms", group: "Atendimento", description: "Formulários por páginas, candidaturas e inscrições." },
  { module: "automations", group: "Operação", description: "Gatilhos, condições e ações com aprovação." },
  { module: "integrations", group: "Operação", description: "Webhooks e integrações externas autorizadas." },
  { module: "knowledge", group: "Inteligência", description: "Conteúdo aprovado para respostas assistidas pela IA." },
  { module: "logs", group: "Proteção", description: "Histórico de mudanças, ações e alertas importantes." }
];

const legacyReportsDescriptor: ModuleDescriptor = {
  module: "reports",
  group: "Atendimento",
  description: "Configuração antiga preservada; novos fluxos são criados em Tickets e atendimento."
};

export function moduleLabel(module: WumpusModule) {
  return module === "reports" ? "Denúncias e apelações (legado)" : wumpusModuleLabels[module];
}

export function descriptorFor(module: WumpusModule) {
  return moduleDescriptors.find((descriptor) => descriptor.module === module) ?? legacyReportsDescriptor;
}
