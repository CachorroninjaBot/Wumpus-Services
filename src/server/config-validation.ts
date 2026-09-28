import { z } from "zod";
import type { ModuleId } from "../core/brand.js";
import { defaultsFor } from "../core/module-defaults.js";

/**
 * Validação de configuração de módulos no servidor.
 * Os min/max da UI não bastam: quem edita JSON avançado pode gravar qualquer valor.
 * Aqui limitamos tipos, faixas e listas para valores seguros.
 */

const snowflake = z.string().regex(/^\d{5,32}$/).or(z.literal(""));
const snowflakeList = z.array(z.string().regex(/^\d{5,32}$/)).max(50);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const urlList = z.array(z.string().url().max(500)).max(10);

/** Faixas numéricas por módulo/campo (quando conhecidas). */
const numericBounds: Partial<Record<ModuleId, Record<string, { min: number; max: number }>>> = {
  automod: {
    messageLimit: { min: 1, max: 50 },
    windowSeconds: { min: 1, max: 300 },
    duplicateLimit: { min: 1, max: 20 },
    timeoutMinutes: { min: 0, max: 40320 },
    mentionLimit: { min: 1, max: 50 },
    capsThresholdPercent: { min: 0, max: 100 },
    minLength: { min: 0, max: 2000 },
    maxLength: { min: 0, max: 4000 }
  },
  security: {
    raidJoinThreshold: { min: 2, max: 100 },
    raidWindowSeconds: { min: 5, max: 600 },
    nukeActionThreshold: { min: 2, max: 50 },
    nukeWindowSeconds: { min: 5, max: 600 },
    timeoutMinutes: { min: 0, max: 40320 },
    minAccountAgeHours: { min: 0, max: 8760 }
  },
  tickets: {
    closeAfterHours: { min: 0, max: 720 },
    maxOpenPerUser: { min: 1, max: 10 },
    autoCloseInactiveHours: { min: 0, max: 720 },
    slaWarningMinutes: { min: 0, max: 10080 }
  },
  forms: {
    cooldownHours: { min: 0, max: 720 },
    minAccountAgeDays: { min: 0, max: 365 },
    maxSubmissionsPerUser: { min: 1, max: 50 },
    autoRejectAfterDays: { min: 0, max: 365 },
    archiveApprovedAfterDays: { min: 0, max: 730 }
  },
  statistics: {
    retentionDays: { min: 7, max: 730 },
    digestHourUtc: { min: 0, max: 23 },
    highlightTopMembers: { min: 0, max: 25 }
  },
  integrations: {
    timeoutMs: { min: 500, max: 30_000 },
    retryCount: { min: 0, max: 5 },
    rateLimitPerMinute: { min: 1, max: 600 },
    healthCheckIntervalMinutes: { min: 1, max: 60 }
  },
  knowledge: {
    minQuestionLength: { min: 1, max: 500 },
    cooldownSeconds: { min: 0, max: 600 },
    maxArticlesPerSearch: { min: 1, max: 20 },
    similarityThreshold: { min: 0, max: 1 }
  },
  ocr: {
    maxImageMb: { min: 1, max: 25 },
    confidenceThreshold: { min: 0, max: 1 },
    cacheTtlMinutes: { min: 1, max: 1440 }
  },
  moderation: {
    defaultTimeoutMinutes: { min: 1, max: 40320 },
    escalateAfterStrikes: { min: 1, max: 20 },
    banDeleteDays: { min: 0, max: 7 },
    strikeExpiryDays: { min: 1, max: 365 },
    maxStrikesBeforeBan: { min: 1, max: 20 }
  },
  logs: {
    retentionDays: { min: 7, max: 730 }
  },
  staff: {
    performanceWindowDays: { min: 1, max: 365 },
    inactivityDays: { min: 1, max: 365 },
    autoArchiveDays: { min: 1, max: 90 },
    maxConcurrentTickets: { min: 1, max: 50 },
    responseTimeGoalMinutes: { min: 1, max: 10080 }
  },
  roles: {
    maxRolesPerMember: { min: 1, max: 100 },
    autoSyncIntervalHours: { min: 1, max: 168 },
    hierarchyLimit: { min: 1, max: 50 }
  },
  automations: {
    maxActionsPerHour: { min: 1, max: 500 },
    maxRetries: { min: 0, max: 10 },
    cooldownSeconds: { min: 0, max: 3600 }
  },
  servers: {
    syncEveryMinutes: { min: 5, max: 1440 }
  }
};

const idListKeys = new Set([
  "staffRoleIds",
  "reviewerRoleIds",
  "protectedRoleIds",
  "defaultRoleIds",
  "ignoredChannelIds",
  "ignoredRoleIds",
  "trustedRoleIds",
  "alertStaffRoleIds",
  "whitelistRoleIds"
]);

const idKeys = new Set([
  "logChannelId",
  "channelId",
  "categoryId",
  "panelChannelId",
  "transcriptChannelId",
  "reviewChannelId",
  "digestChannelId",
  "alertChannelId",
  "appealChannelId",
  "answerChannelId",
  "announceJoinChannelId",
  "announceLeaveChannelId",
  "notifyChannelId",
  "shiftLogChannelId",
  "escalationRoleId",
  "mentionRoleId"
]);

/**
 * Sanitiza e valida a config enviada pelo cliente.
 * Desconhece campos que não existem no default do módulo (evita lixo).
 * Clampa números e valida snowflakes/URLs.
 */
export function validateModuleConfig(
  module: ModuleId,
  input: Record<string, unknown> | null | undefined
): { ok: true; config: Record<string, unknown> } | { ok: false; error: string } {
  const defaults = defaultsFor(module);
  const raw = input && typeof input === "object" ? input : {};
  const out: Record<string, unknown> = {};
  const bounds = numericBounds[module] ?? {};

  for (const key of Object.keys(defaults)) {
    const fallback = defaults[key];
    let value = key in raw ? raw[key] : fallback;

    if (typeof fallback === "boolean") {
      out[key] = Boolean(value);
      continue;
    }

    if (typeof fallback === "number") {
      let n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) n = fallback as number;
      const bound = bounds[key];
      if (bound) n = Math.min(bound.max, Math.max(bound.min, n));
      out[key] = n;
      continue;
    }

    if (Array.isArray(fallback)) {
      if (!Array.isArray(value)) value = fallback;
      if (idListKeys.has(key)) {
        const parsed = snowflakeList.safeParse(value);
        out[key] = parsed.success ? parsed.data : fallback;
      } else if (key === "webhookAllowlist") {
        const parsed = urlList.safeParse(value);
        out[key] = parsed.success ? parsed.data : [];
      } else if (key === "blockedTerms" || key === "blockedDomains" || key === "allowedDomains" || key === "tags" || key === "customHeaders" || key === "questions") {
        out[key] = (value as unknown[])
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.slice(0, 200))
          .slice(0, key === "questions" ? 5 : 100);
      } else {
        out[key] = value;
      }
      continue;
    }

    if (typeof fallback === "string") {
      if (typeof value !== "string") value = fallback;
      if (idKeys.has(key)) {
        const parsed = snowflake.safeParse(value);
        out[key] = parsed.success ? parsed.data : "";
      } else if (key.toLowerCase().includes("color") || key.endsWith("AccentColor")) {
        const parsed = hexColor.safeParse(value);
        out[key] = parsed.success ? parsed.data : (fallback as string);
      } else {
        out[key] = (value as string).slice(0, 2000);
      }
      continue;
    }

    out[key] = value ?? fallback;
  }

  return { ok: true, config: out };
}
