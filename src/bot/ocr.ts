/**
 * OCR de imagens — leitura de texto em prints.
 *
 * O painel tem um modulo `ocr` inteiro (provider, idioma, limite de MB,
 * confianca minima, cache, retencao do texto) e o automod tem `scanImages`.
 * Nada disso existia no bot: imagem nunca era lida, entao print com golpe
 * passava direto pelo filtro.
 *
 * ATENCAO — contrato nao verificado: a API em `WUMPUS_HAIZ_OCR_URL` responde
 * 405 a GET, ou seja, existe e e POST-only, mas o formato do corpo nao esta
 * documentado em lugar nenhum do repositorio. Por isso a resposta e lida de
 * forma tolerante a varios formatos, e QUALQUER falha devolve `null` em vez de
 * lancar: OCR indisponivel nao pode impedir o automod de agir no texto.
 */
import { bool, guildEntitlement, isEnabled, moduleConfig, num, str } from "./config.ts";
import type { Logger } from "./logger.ts";
import { isPlanId, monthlyOcrLimit, planAllows } from "../lib/wumpus/plan-features.ts";
import { mutate } from "./store.ts";

export type OcrResult = { text: string; confidence: number | null };

/** Cache por URL: a mesma imagem nao precisa ser lida duas vezes. */
const cache = new Map<string, { result: OcrResult | null; at: number }>();
const CACHE_MAX = 300;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const OCR_MAX_IMAGES_PER_MESSAGE = 3;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_OCR_TEXT_LENGTH = 12_000;
const DISCORD_IMAGE_HOSTS = new Set(["cdn.discordapp.com"]);
let activeRequests = 0;

export function isAllowedDiscordImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.port === "" || url.port === "443") &&
      DISCORD_IMAGE_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function isSafeOcrEndpoint(value: string, environment = process.env.NODE_ENV): boolean {
  try {
    const url = new URL(value);
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase());
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.search &&
      (url.protocol === "https:" ||
        (environment !== "production" && localHost && url.protocol === "http:"))
    );
  } catch {
    return false;
  }
}

function cacheKey(url: string, accountId: string): string {
  return `${accountId}:${url}`;
}

type OcrUsage = { accountId: string; month: string; count: number };

export async function reserveOcrRequest(accountId: string, limit: number | null): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7);
  let allowed = false;
  await mutate<OcrUsage>("ocr-usage", (rows) => {
    const current = rows.find((row) => row.accountId === accountId && row.month === month);
    if (limit !== null && (current?.count ?? 0) >= limit) return rows;
    if (current) current.count += 1;
    else rows.push({ accountId, month, count: 1 });
    allowed = true;
    return rows.filter((row) => row.month >= month || monthDiff(row.month, month) <= 2);
  });
  return allowed;
}

function monthDiff(previous: string, current: string): number {
  const [py, pm] = previous.split("-").map(Number);
  const [cy, cm] = current.split("-").map(Number);
  return (cy! - py!) * 12 + cm! - pm!;
}

function cacheGet(key: string, ttlMinutes: number): OcrResult | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttlMinutes * 60_000) {
    cache.delete(key);
    return undefined;
  }
  return hit.result;
}

function cacheSet(key: string, result: OcrResult | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { result, at: Date.now() });
}

async function readJsonWithLimit(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error("response_too_large");
  }

  if (!response.body) throw new Error("empty_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/** Extrai o texto de uma resposta de formato desconhecido. */
function extractText(payload: unknown): OcrResult | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  // Formatos plausiveis: { text }, { result: { text } }, { data: { text } },
  // { text: { content } }, { results: [{ text }] }
  const candidates: unknown[] = [
    record.text,
    record.ocr,
    record.content,
    record.message,
    (record.result as Record<string, unknown> | undefined)?.text,
    (record.data as Record<string, unknown> | undefined)?.text,
    (record.text as Record<string, unknown> | undefined)?.content,
    Array.isArray(record.results)
      ? (record.results[0] as Record<string, unknown> | undefined)?.text
      : undefined,
    Array.isArray(record.lines) ? record.lines.join("\n") : undefined,
  ];

  const text = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (!text) return null;

  const rawConfidence =
    record.confidence ?? (record.result as Record<string, unknown> | undefined)?.confidence;
  const parsedConfidence = typeof rawConfidence === "number" ? rawConfidence : Number.NaN;
  const confidence =
    Number.isFinite(parsedConfidence) && parsedConfidence >= 0 && parsedConfidence <= 1
      ? parsedConfidence
      : null;

  return { text: text.trim().slice(0, MAX_OCR_TEXT_LENGTH), confidence };
}

/**
 * Le o texto de uma imagem. Devolve `null` quando o modulo esta desligado,
 * a imagem e grande demais, a API falha ou nao ha texto.
 */
export async function readImage(
  guildId: string,
  imageUrl: string,
  options: { sizeBytes?: number; log?: Logger } = {},
): Promise<OcrResult | null> {
  const entitlement = await guildEntitlement(guildId);
  if (!entitlement || !isPlanId(entitlement.planId) || !planAllows(entitlement.planId, "ocr"))
    return null;
  const config = await moduleConfig(guildId, "ocr");
  if (!isEnabled(config)) return null;

  const endpoint = process.env.WUMPUS_HAIZ_OCR_URL;
  const internalKey = process.env.WUMPUS_INTERNAL_KEY;
  if (!endpoint || !internalKey) {
    options.log?.warn("OCR indisponivel", { guildId, reason: "missing_configuration" });
    return null;
  }
  if (!isSafeOcrEndpoint(endpoint)) {
    options.log?.warn("OCR indisponivel", { guildId, reason: "unsafe_endpoint_configuration" });
    return null;
  }
  if (!isAllowedDiscordImageUrl(imageUrl)) {
    options.log?.warn("imagem ignorada pelo OCR", { guildId, reason: "untrusted_image_url" });
    return null;
  }

  // Limite de tamanho: uma imagem enorme nao deve pendurar o handler.
  const maxMb = Math.min(8, Math.max(1, num(config, "maxImageMb", 8)));
  if (
    options.sizeBytes === undefined ||
    !Number.isFinite(options.sizeBytes) ||
    options.sizeBytes <= 0 ||
    options.sizeBytes > Math.min(MAX_IMAGE_BYTES, maxMb * 1024 * 1024)
  ) {
    options.log?.info("imagem ignorada por tamanho", { guildId, maxMb });
    return null;
  }

  const useCache = bool(config, "cacheResults", true);
  const ttlMinutes = Math.max(1, Math.trunc(num(config, "cacheTtlMinutes", 60)));
  const key = cacheKey(imageUrl, entitlement.accountId);

  if (useCache) {
    const hit = cacheGet(key, ttlMinutes);
    if (hit !== undefined) return hit;
  }

  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    options.log?.warn("OCR temporariamente ocupado", { guildId, reason: "concurrency_limit" });
    return null;
  }
  activeRequests += 1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const monthlyLimit = monthlyOcrLimit(entitlement.planId);
    if (monthlyLimit === 0 || !(await reserveOcrRequest(entitlement.accountId, monthlyLimit))) {
      options.log?.warn("limite mensal de OCR atingido", { guildId, limit: monthlyLimit });
      return null;
    }

    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": internalKey,
      },
      body: JSON.stringify({
        imageUrl,
        url: imageUrl,
        guildId,
        language: str(config, "language", "pt"),
        provider: str(config, "provider", "hybrid"),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      options.log?.warn("OCR respondeu com erro", { guildId, status: res.status });
      return null;
    }

    const result = extractText(await readJsonWithLimit(res));

    // Sem confianca valida nao se usa OCR para moderacao automatica.
    const threshold = Math.min(1, Math.max(0, num(config, "confidenceThreshold", 0.7)));
    if (result && (result.confidence === null || result.confidence < threshold)) {
      options.log?.info("OCR sem confianca suficiente", {
        guildId,
        confidence: result.confidence ?? "missing",
        threshold,
      });
      if (useCache) cacheSet(key, null);
      return null;
    }

    if (useCache) cacheSet(key, result);
    return result;
  } catch (error) {
    options.log?.warn("falha ao consultar OCR", {
      guildId,
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return null;
  } finally {
    if (timer) clearTimeout(timer);
    activeRequests -= 1;
  }
}

/** Texto de todas as imagens de uma mensagem, concatenado. */
export async function extractTextFromAttachments(
  guildId: string,
  images: Array<{ url: string; size?: number }>,
  log?: Logger,
): Promise<string> {
  const parts: string[] = [];

  if (images.length > OCR_MAX_IMAGES_PER_MESSAGE) {
    log?.info("anexos de imagem excedem o limite do OCR", {
      count: images.length,
      limit: OCR_MAX_IMAGES_PER_MESSAGE,
    });
  }

  for (const image of images.slice(0, OCR_MAX_IMAGES_PER_MESSAGE)) {
    const result = await readImage(guildId, image.url, { sizeBytes: image.size, log });
    if (result?.text) parts.push(result.text);
  }

  return parts.join("\n").slice(0, MAX_OCR_TEXT_LENGTH);
}
