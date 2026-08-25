import { z } from "zod";

/**
 * Modules deliberately stay stable because their IDs are persisted in Postgres and
 * used by the dashboard, bot and webhooks.  Labels can change without migrations.
 */
export const wumpusModules = [
  "servers",
  "statistics",
  "moderation",
  "automod",
  "ocr",
  "staff",
  "roles",
  "security",
  "reports",
  "tickets",
  "forms",
  "automations",
  "integrations",
  "knowledge",
  "logs"
] as const;

export const wumpusModuleSchema = z.enum(wumpusModules);
export type WumpusModule = z.infer<typeof wumpusModuleSchema>;

export const wumpusModuleLabels: Record<WumpusModule, string> = {
  servers: "Servidores",
  statistics: "Estatísticas",
  moderation: "Moderação",
  automod: "AutoMod",
  ocr: "OCR de imagens",
  staff: "Gestão de staff",
  roles: "Cargos e permissões",
  security: "Anti-raid e anti-nuke",
  reports: "Denúncias e apelações",
  tickets: "Tickets e atendimento",
  forms: "Formulários e candidaturas",
  automations: "Central de automações",
  integrations: "Integrações e webhooks",
  knowledge: "Base de conhecimento",
  logs: "Logs e auditoria"
};

const channelId = z.string().regex(/^\d{15,22}$/).optional().or(z.literal(""));
const snowflakeList = z.array(z.string().regex(/^\d{15,22}$/)).max(50);

const moduleConfigSchemas = {
  servers: z.object({ syncEveryMinutes: z.number().int().min(5).max(1440).default(60) }),
  statistics: z.object({ enabled: z.boolean().default(true), retentionDays: z.number().int().min(30).max(730).default(180) }),
  moderation: z.object({ enabled: z.boolean().default(true), logChannelId: channelId, staffRoleIds: snowflakeList.default([]), defaultTimeoutMinutes: z.number().int().min(1).max(40320).default(60) }),
  automod: z.object({
    enabled: z.boolean().default(true),
    logChannelId: channelId,
    messageLimit: z.number().int().min(3).max(30).default(6),
    windowSeconds: z.number().int().min(3).max(120).default(10),
    duplicateLimit: z.number().int().min(2).max(10).default(3),
    blockInvites: z.boolean().default(true),
    action: z.enum(["delete", "warn", "timeout", "review"]).default("delete"),
    timeoutMinutes: z.number().int().min(1).max(1440).default(10),
    blockedTerms: z.array(z.string().min(1).max(100)).max(500).default([]),
    blockedDomains: z.array(z.string().min(1).max(255)).max(500).default([])
  }),
  ocr: z.object({
    enabled: z.boolean().default(false),
    logChannelId: channelId,
    reviewChannelId: channelId,
    provider: z.enum(["haiz", "groq", "hybrid"]).default("hybrid"),
    language: z.enum(["pt", "en", "es", "fr", "de", "it", "ja", "ko", "zh-cn", "zh-tw", "ar", "ru"]).default("pt"),
    model: z.string().min(1).max(120).default("qwen/qwen3.6-27b"),
    haizRequestsPerMinute: z.number().int().min(1).max(50).default(30),
    retainExtractedText: z.boolean().default(false)
  }),
  staff: z.object({ enabled: z.boolean().default(true), staffRoleIds: snowflakeList.default([]), logChannelId: channelId, performanceWindowDays: z.number().int().min(7).max(180).default(30) }),
  roles: z.object({ enabled: z.boolean().default(true), allowAiDrafts: z.boolean().default(true), allowAutomaticApply: z.literal(false).default(false), protectedRoleIds: snowflakeList.default([]) }),
  security: z.object({
    enabled: z.boolean().default(true),
    alertChannelId: channelId,
    raidJoinThreshold: z.number().int().min(3).max(500).default(12),
    raidWindowSeconds: z.number().int().min(10).max(3600).default(60),
    nukeActionThreshold: z.number().int().min(2).max(100).default(5),
    nukeWindowSeconds: z.number().int().min(10).max(3600).default(30),
    response: z.enum(["alert", "timeout_suspect", "lockdown_review"]).default("lockdown_review"),
    timeoutMinutes: z.number().int().min(1).max(1440).default(60),
    trustedRoleIds: snowflakeList.default([])
  }),
  reports: z.object({ enabled: z.boolean().default(true), staffRoleIds: snowflakeList.default([]), reviewChannelId: channelId, allowAnonymous: z.boolean().default(true), appealCooldownDays: z.number().int().min(0).max(365).default(14), panelFormat: z.enum(["components_v2", "embed"]).default("components_v2"), panelTitle: z.string().min(3).max(100).default("Central de denúncias"), panelDescription: z.string().min(10).max(800).default("Envie uma denúncia de forma segura para a equipe."), panelAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8175FF") }),
  tickets: z.object({ enabled: z.boolean().default(false), panelChannelId: channelId, categoryId: channelId, staffRoleIds: snowflakeList.default([]), transcriptChannelId: channelId, closeAfterHours: z.number().int().min(1).max(720).default(48), panelFormat: z.enum(["components_v2", "embed"]).default("components_v2"), panelTitle: z.string().min(3).max(100).default("Central de atendimento"), panelDescription: z.string().min(10).max(800).default("Abra um atendimento privado e fale com a equipe."), panelAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8175FF") }),
  forms: z.object({ enabled: z.boolean().default(true), reviewerRoleIds: snowflakeList.default([]), reviewChannelId: channelId, useAiPreReview: z.boolean().default(false), panelFormat: z.enum(["components_v2", "embed"]).default("components_v2"), panelTitle: z.string().min(3).max(100).default("Candidaturas"), panelDescription: z.string().min(10).max(800).default("Envie sua candidatura pelo formulário seguro."), panelAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8175FF") }),
  automations: z.object({ enabled: z.boolean().default(true), logChannelId: channelId, requireApprovalForDestructiveActions: z.boolean().default(true) }),
  integrations: z.object({ enabled: z.boolean().default(true), webhookAllowlist: z.array(z.string().url()).max(100).default([]), signingSecretConfigured: z.boolean().default(false) }),
  knowledge: z.object({ enabled: z.boolean().default(true), answerChannelId: channelId, useGroq: z.boolean().default(false), requireApprovedArticles: z.boolean().default(true) }),
  logs: z.object({ enabled: z.boolean().default(true), channelId: channelId, retentionDays: z.number().int().min(30).max(730).default(180) })
} satisfies Record<WumpusModule, z.ZodType>;

export type WumpusModuleConfig = Record<string, unknown>;

export function defaultWumpusModuleConfig(module: WumpusModule): WumpusModuleConfig {
  return moduleConfigSchemas[module].parse({}) as WumpusModuleConfig;
}

/** Validates untrusted dashboard, webhook and AI input before it reaches Discord. */
export function parseWumpusModuleConfig(module: WumpusModule, input: unknown): WumpusModuleConfig {
  return moduleConfigSchemas[module].parse(input) as WumpusModuleConfig;
}

export function isEnabled(config: Record<string, unknown>): boolean {
  return config.enabled !== false;
}

export const groqRoleDraftSchema = z.object({
  roles: z.array(z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    permissions: z.array(z.string().min(1).max(80)).max(50),
    hoist: z.boolean(),
    mentionable: z.boolean(),
    rationale: z.string().min(1).max(500)
  })).min(1).max(30),
  warnings: z.array(z.string().min(1).max(300)).max(20)
});

export type GroqRoleDraft = z.infer<typeof groqRoleDraftSchema>;
