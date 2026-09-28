import type { Client } from "discord.js";
import { resolveModuleConfig } from "../server/db/index.js";

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

type IntegrationsConfig = {
  webhookAllowlist?: string[];
  signingSecretConfigured?: boolean;
  allowIncoming?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  includeGuildId?: boolean;
  rateLimitPerMinute?: number;
  logPayloads?: boolean;
  customHeaders?: string[];
};

// Rate limiter por servidor
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(guildId: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(guildId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(guildId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limitPerMinute) return false;
  entry.count++;
  return true;
}

/** Bloqueia IPs/hosts internos (SSRF). */
function isBlockedWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return true;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return true;
  }
  // IPv4 privado / link-local / metadata
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const [a, b, c, d] = m.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  // IPv6 local/ULA
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  return false;
}

/**
 * Envia um evento para todos os webhooks configurados no servidor.
 */
export async function forwardToWebhooks(
  client: Client,
  guildId: string,
  event: string,
  payload: Record<string, unknown>,
  log: Logger
): Promise<number> {
  const mod = await resolveModuleConfig(guildId, "integrations").catch(() => null);
  if (!mod?.enabled) return 0;
  const config = mod.config as IntegrationsConfig;

  const allowlist = Array.isArray(config.webhookAllowlist) ? config.webhookAllowlist as string[] : [];
  if (!allowlist.length) return 0;

  const rateLimit = config.rateLimitPerMinute ?? 60;
  if (!checkRateLimit(guildId, rateLimit)) {
    log.info("webhook rate limit atingido", { guildId });
    return 0;
  }

  const body: Record<string, unknown> = {
    event,
    timestamp: new Date().toISOString(),
    data: payload
  };
  if (config.includeGuildId !== false) {
    body.guildId = guildId;
  }

  // Parse custom headers
  const extraHeaders: Record<string, string> = {};
  if (Array.isArray(config.customHeaders)) {
    for (const h of config.customHeaders as string[]) {
      const colonIdx = h.indexOf(":");
      if (colonIdx > 0) {
        extraHeaders[h.slice(0, colonIdx).trim()] = h.slice(colonIdx + 1).trim();
      }
    }
  }

  const timeoutMs = config.timeoutMs ?? 4000;
  const maxRetries = config.retryCount ?? 2;
  let sent = 0;

  for (const url of allowlist.slice(0, 5)) {
    if (isBlockedWebhookUrl(url)) {
      log.error("webhook bloqueado (SSRF / URL interna)", { guildId, url: url.slice(0, 80) });
      continue;
    }
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "Wumpus-Webhook/2.0",
            ...extraHeaders
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs)
        });

        if (response.ok) {
          sent++;
          break;
        }

        if (response.status < 500) break; // Não retry em erros do cliente
      } catch {
        // Timeout ou erro de rede: retry
      }
    }
  }

  if (config.logPayloads && sent > 0) {
    log.info("webhook enviado", { guildId, event, targets: sent });
  }

  return sent;
}
