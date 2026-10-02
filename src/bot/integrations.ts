/**
 * Integracoes — webhooks de entrada.
 *
 * O painel configura allowlist de origem, segredo de assinatura, timeout,
 * tentativas, limite por minuto e se o guildId vai no payload. Nada disso tinha
 * efeito: nao existia caminho de codigo para receber webhook.
 *
 * Aqui ficam as DECISOES (pode entrar? passou do limite? a assinatura bate?),
 * separadas do transporte HTTP. Assim a regra e testavel sem subir servidor, e
 * quem expuser o endpoint so precisa chamar `authorizeIncoming` e
 * `verifySignature` antes de `handleIncoming`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Guild } from "discord.js";
import { bool, isEnabled, list, moduleConfig, num } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";

export type IncomingDecision =
  | { allowed: true }
  | { allowed: false; status: number; reason: string };

/** Janela de rate limit por origem. */
const hits = new Map<string, number[]>();

/**
 * A origem pode enviar um webhook agora?
 * Verifica se a integracao esta ligada, se a origem esta na allowlist e se o
 * limite por minuto nao estourou.
 */
export async function authorizeIncoming(
  guildId: string,
  origin: string
): Promise<IncomingDecision> {
  const config = await moduleConfig(guildId, "integrations");

  if (!isEnabled(config)) {
    return { allowed: false, status: 404, reason: "Integracoes desligadas neste servidor." };
  }

  if (!bool(config, "allowIncoming", false)) {
    return { allowed: false, status: 403, reason: "Webhooks de entrada nao estao liberados." };
  }

  const allowlist = list(config, "webhookAllowlist");
  if (allowlist.length) {
    const clean = origin.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const ok = allowlist.some((entry) => {
      const allowed = entry.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      return allowed && (clean === allowed || clean.endsWith(`.${allowed}`));
    });

    if (!ok) {
      return { allowed: false, status: 403, reason: `Origem "${origin}" nao esta na allowlist.` };
    }
  }

  const limit = Math.trunc(num(config, "rateLimitPerMinute", 60));
  if (limit > 0 && !consume(guildId, origin, limit)) {
    return { allowed: false, status: 429, reason: "Limite de requisicoes por minuto excedido." };
  }

  return { allowed: true };
}

/** Consome uma requisicao da janela. `false` quando o limite estourou. */
function consume(guildId: string, origin: string, limit: number): boolean {
  const key = `${guildId}:${origin}`;
  const now = Date.now();
  const kept = (hits.get(key) ?? []).filter((at) => now - at < 60_000);

  if (kept.length >= limit) {
    hits.set(key, kept);
    return false;
  }

  kept.push(now);
  hits.set(key, kept);

  // Poda: sem isso o mapa guarda toda origem que ja chamou uma vez.
  if (hits.size > 1_000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > 60_000) hits.delete(k);
    }
  }

  return true;
}

/**
 * Confere a assinatura HMAC do corpo.
 *
 * Quando o servidor configurou um segredo, ele e OBRIGATORIO — aceitar corpo
 * sem assinatura anularia o proposito de ter um.
 */
export function verifySignature(
  secret: string,
  rawBody: string,
  signature: string | undefined
): boolean {
  if (!secret) return true;
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "").trim();

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");

  // timingSafeEqual exige o mesmo tamanho; comparar antes evita excecao.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Entrega um payload ao servidor: registra na auditoria e devolve o resultado.
 * O chamador ja passou por `authorizeIncoming` e `verifySignature`.
 */
export async function handleIncoming(
  guild: Guild,
  input: { origin: string; event: string; payload: Record<string, unknown> },
  log: Logger
): Promise<{ ok: boolean; message: string }> {
  const config = await moduleConfig(guild.id, "integrations");

  const includeGuildId = bool(config, "includeGuildId", true);

  await auditAndLog(
    guild,
    {
      module: "integrations",
      category: "messages",
      eventType: `integration_${input.event}`,
      severity: "info",
      title: `WEBHOOK · ${input.event}`,
      description: `Recebido de **${input.origin}**.`,
      accentColor: "#7c5cff",
      fields: [
        { name: "Evento", value: input.event },
        // Payload so entra no log quando o servidor pediu — pode conter dado sensivel.
        ...(bool(config, "logPayloads", false)
          ? [{ name: "Payload", value: JSON.stringify(input.payload).slice(0, 1000) }]
          : [])
      ],
      data: includeGuildId ? { guildId: guild.id, event: input.event } : { event: input.event }
    },
    log
  );

  log.info("webhook recebido", { guildId: guild.id, origin: input.origin, event: input.event });
  return { ok: true, message: "Recebido." };
}

/** Timeout configurado, em ms — usado por quem faz a chamada de saida. */
export async function outboundTimeoutMs(guildId: string): Promise<number> {
  const config = await moduleConfig(guildId, "integrations");
  return Math.max(500, Math.trunc(num(config, "timeoutMs", 4000)));
}

/** Cabecalhos extras configurados no painel, no formato "Chave: valor". */
export async function customHeaders(guildId: string): Promise<Record<string, string>> {
  const config = await moduleConfig(guildId, "integrations");
  const entries = list(config, "customHeaders");

  const headers: Record<string, string> = {};
  for (const entry of entries) {
    const [key, ...rest] = entry.split(":");
    if (!key || !rest.length) continue;
    headers[key.trim()] = rest.join(":").trim();
  }
  return headers;
}
