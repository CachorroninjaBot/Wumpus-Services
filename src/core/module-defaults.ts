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
    syncEveryMinutes: 60,
    syncRoles: true,
    syncChannels: true,
    announceJoinChannelId: "",
    announceLeaveChannelId: "",
    nicknameOnJoin: false
  },
  statistics: {
    retentionDays: 180,
    trackMessages: true,
    trackVoice: false,
    trackJoins: true,
    trackTickets: true,
    anonymizeUsers: true,
    digestChannelId: "",
    digestHourUtc: 12
  },
  staff: {
    staffRoleIds: [],
    logChannelId: "",
    performanceWindowDays: 30,
    requireReason: true,
    inactivityDays: 14,
    pingOnClaim: true,
    shiftLogChannelId: ""
  },
  roles: {
    allowAiDrafts: true,
    protectedRoleIds: [],
    syncNames: true,
    autoRemoveOnLeave: false,
    mentionableByDefault: false,
    hoistNewRoles: false,
    maxRolesPerMember: 25
  },
  automations: {
    requireApprovalForDestructiveActions: true,
    logChannelId: "",
    dryRun: false,
    maxActionsPerHour: 30,
    allowChannelCreate: false,
    allowRoleAssign: true,
    notifyChannelId: ""
  },
  integrations: {
    webhookAllowlist: [],
    signingSecretConfigured: false,
    allowIncoming: false,
    timeoutMs: 4000,
    retryCount: 2,
    includeGuildId: true
  },
  moderation: {
    logChannelId: "",
    staffRoleIds: [],
    defaultTimeoutMinutes: 60,
    escalateAfterStrikes: 3,
    banDeleteDays: 1,
    dmOnPunish: true,
    requireEvidence: false,
    appealChannelId: ""
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
    blockedDomains: [],
    ignoredChannelIds: [],
    ignoredRoleIds: [],
    mentionLimit: 8,
    scanImages: true,
    warnMessage: "Sua mensagem foi removida pelo filtro automático."
  },
  security: {
    alertChannelId: "",
    raidJoinThreshold: 12,
    raidWindowSeconds: 60,
    nukeActionThreshold: 5,
    nukeWindowSeconds: 30,
    response: "lockdown_review",
    timeoutMinutes: 60,
    trustedRoleIds: [],
    minAccountAgeHours: 24,
    quarantineNewMembers: false,
    alertStaffRoleIds: []
  },
  logs: {
    channelId: "",
    retentionDays: 180,
    logModeration: true,
    logMembers: true,
    logMessages: false,
    logVoice: false,
    logRoles: true,
    logChannels: true,
    logBans: true,
    ignoreBotMessages: true,
    ignoreChannelIds: []
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
    feedbackEnabled: true,
    maxOpenPerUser: 1,
    pingStaffOnOpen: true,
    namingPattern: "atendimento-{user}",
    welcomeMessage: "Olá! Descreva o que você precisa. A equipe já foi notificada."
  },
  forms: {
    reviewerRoleIds: [],
    reviewChannelId: "",
    useAiPreReview: false,
    panelFormat: "components_v2",
    panelTitle: "Candidaturas",
    panelDescription: "Envie sua candidatura pelo formulario seguro.",
    panelAccentColor: "#7c5cff",
    cooldownHours: 24,
    minAccountAgeDays: 0,
    notifyReviewers: true
  },
  knowledge: {
    answerChannelId: "",
    useAi: true,
    requireApprovedArticles: true,
    mentionRequired: false,
    minQuestionLength: 12,
    cooldownSeconds: 20,
    preferFastModel: true,
    fallbackMessage: ""
  },
  ocr: {
    provider: "hybrid",
    language: "pt",
    model: "qwen/qwen3.8-27b",
    retainExtractedText: false,
    maxImageMb: 8,
    reviewChannelId: ""
  }
};

export function defaultsFor(module: ModuleId): Record<string, unknown> {
  return { ...(moduleDefaults[module] ?? {}) };
}
