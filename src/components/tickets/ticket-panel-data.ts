export const discordButtonStyles = [
  { value: 1, label: "Azul", preview: "primary" as const },
  { value: 2, label: "Cinza", preview: "secondary" as const },
  { value: 3, label: "Verde", preview: "success" as const },
  { value: 4, label: "Vermelho", preview: "danger" as const },
];

export type SavedReply = { id: string; label: string; content: string };

export function readSavedReplies(value: unknown): SavedReply[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): SavedReply[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.label !== "string" || typeof row.content !== "string") return [];
    return [{ id: row.id, label: row.label, content: row.content }];
  }).slice(0, 20);
}

export const ticketTemplates: Record<string, { label: string; description: string; config: Partial<Record<string, unknown>> }> = {
  support: {
    label: "Suporte geral",
    description: "Dúvidas, problemas técnicos e denúncias.",
    config: {
      panelTitle: "Central de atendimento",
      panelDescription: "Escolha o assunto e conte à equipe como podemos ajudar.",
      panelButtonLabel: "Abrir atendimento",
      panelButtonEmoji: "🎫",
      departments: ["Suporte", "Denúncia", "Parcerias"],
      departmentSettings: [
        { id: "support", name: "Suporte", description: "Dúvidas e problemas técnicos.", emoji: "🛟", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Como podemos ajudar?"] },
        { id: "report", name: "Denúncia", description: "Reporte um problema com segurança.", emoji: "⚠️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Descreva o que aconteceu."] },
        { id: "partnership", name: "Parcerias", description: "Fale sobre uma parceria com o servidor.", emoji: "🤝", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Conte um pouco sobre sua proposta."] },
      ],
      maxOpenPerUser: 1,
      pingStaffOnOpen: true,
      feedbackEnabled: true,
      reopenEnabled: true,
    },
  },
  store: {
    label: "Loja e pedidos",
    description: "Organiza compras, pagamentos e reembolsos.",
    config: {
      panelTitle: "Atendimento da loja",
      panelDescription: "Selecione o tema do seu pedido para falar com a equipe certa.",
      panelButtonLabel: "Falar com a loja",
      panelButtonEmoji: "🛒",
      departments: ["Compras", "Pagamento", "Reembolso"],
      departmentSettings: [
        { id: "purchase", name: "Compras", description: "Dúvidas antes de fazer um pedido.", emoji: "🛍️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["O que você deseja comprar?"] },
        { id: "payment", name: "Pagamento", description: "Ajuda com pagamentos e pedidos.", emoji: "💳", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Conte o que houve com o pagamento."] },
        { id: "refund", name: "Reembolso", description: "Solicite ajuda com um reembolso.", emoji: "↩️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Qual pedido você quer reembolsar?"] },
      ],
      maxOpenPerUser: 1,
      pingStaffOnOpen: true,
      feedbackEnabled: true,
    },
  },
  community: {
    label: "Comunidade",
    description: "Suporte, denúncias, recursos e contato com a equipe.",
    config: {
      panelTitle: "Fale com a equipe",
      panelDescription: "Escolha uma categoria para direcionar sua solicitação.",
      panelButtonLabel: "Criar ticket",
      panelButtonEmoji: "💬",
      departments: ["Ajuda", "Denúncia", "Recurso", "Equipe"],
      departmentSettings: [
        { id: "help", name: "Ajuda", description: "Dúvidas sobre o servidor.", emoji: "❓", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Qual é a sua dúvida?"] },
        { id: "report", name: "Denúncia", description: "Reporte uma situação à moderação.", emoji: "🚩", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Descreva a situação e inclua evidências."] },
        { id: "appeal", name: "Recurso", description: "Peça a revisão de uma decisão.", emoji: "⚖️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Qual decisão você gostaria de revisar?"] },
        { id: "staff", name: "Equipe", description: "Outros assuntos para a equipe.", emoji: "👥", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Como podemos ajudar?"] },
      ],
      maxOpenPerUser: 2,
      pingStaffOnOpen: true,
      feedbackEnabled: true,
      reopenEnabled: true,
    },
  },
};
