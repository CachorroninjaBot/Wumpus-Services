import type { ModuleId } from "./brand.js";

/**
 * Valores padrao de cada modulo.
 *
 * Estas chaves sao o contrato entre dashboard e bot. O dashboard grava
 * apenas o que o cliente mudou; o bot sempre le o config resolvido, que e
 * o padrao + a config do grupo + a excecao do servidor.
 */
export const moduleDefaults: Record<ModuleId, Record<string, unknown>> = {
  servers: {
    syncEveryMinutes: 60
  },
  statistics: {
    retentionDays: 180,
    trackMessages: true
  },
  staff: {
    staffRoleIds: [],
    logChannelId: "",
    performanceWindowDays: 30
  },
  roles: {
    allowAiDrafts: true,
    protectedRoleIds: [],
    syncNames: true
  },
  automations: {
    requireApprovalForDestructiveActions: true,
    logChannelId: ""
  },
  integrations: {
    webhookAllowlist: [],
    signingSecretConfigured: false
  },
  moderation: {
    logChannelId: "",
    staffRoleIds: [],
    defaultTimeoutMinutes: 60
  },
  automod: {
    logChannelId: "",
    messageLimit: 6,
    windowSeconds: 10,
    duplicateLimit: 3,
    blockInvites: true,
    action: "delete",
    timeoutMinutes: 10,
    blockedTerms: [],
    blockedDomains: []
  },
  security: {
    alertChannelId: "",
    raidJoinThreshold: 12,
    raidWindowSeconds: 60,
    nukeActionThreshold: 5,
    nukeWindowSeconds: 30,
    response: "lockdown_review",
    timeoutMinutes: 60,
    trustedRoleIds: []
  },
  logs: {
    channelId: "",
    retentionDays: 180,
    logModeration: true,
    logMembers: true,
    logMessages: false
  },
  tickets: {
    panelChannelId: "",
    categoryId: "",
    staffRoleIds: [],
    transcriptChannelId: "",
    logChannelId: "",
    aiSupportEnabled: true,
    closeAfterHours: 48,
    panelFormat: "components_v2",
    panelTitle: "Central de atendimento",
    panelDescription: "Abra um atendimento privado e fale com a equipe.",
    panelAccentColor: "#7c5cff",
    feedbackEnabled: true
  },
  forms: {
    reviewerRoleIds: [],
    reviewChannelId: "",
    useAiPreReview: false,
    panelFormat: "components_v2",
    panelTitle: "Candidaturas",
    panelDescription: "Envie sua candidatura pelo formulario seguro.",
    panelAccentColor: "#7c5cff"
  },
  knowledge: {
    answerChannelId: "",
    useAi: true,
    requireApprovedArticles: true
  },
  ocr: {
    provider: "hybrid",
    language: "pt",
    model: "qwen/qwen3.6-27b",
    retainExtractedText: false
  }
};

export function defaultsFor(module: ModuleId): Record<string, unknown> {
  return { ...(moduleDefaults[module] ?? {}) };
}
