/**
 * OCR de imagens — leitura de texto em prints.
 *
 * O painel tem um modulo `ocr` inteiro (provider, idioma, limite de MB,
 * confiança mínima, cache e retenção do texto) e o AutoMod fornece os termos
 * bloqueados e a ação a aplicar quando houver correspondência.
 * Nada disso existia no bot: imagem nunca era lida, entao print com golpe
 * passava direto pelo filtro.
 *
 * Integração com OCR.space: upload multipart e chave no header `apikey`.
 */
import { bool, guildEntitlement, isEnabled, moduleConfig, num } from "./config.ts";
import type { Logger } from "./logger.ts";
import { isPlanId, monthlyOcrLimit, planAllows } from "../lib/wumpus/plan-features.ts";
import { mutate } from "./store.ts";

export type OcrResult = { text: string; confidence: number | null };

export const OCR_SPACE_API_URL = "https://api.ocr.space/parse/image";
/** Cache por URL: a mesma imagem nao precisa ser lida duas vezes. */
const cache = new Map<string, { result: OcrResult | null; at: number }>();
const CACHE_MAX = 300;
const MAX_IMAGE_BYTES = 1024 * 1024;
export const OCR_MAX_IMAGES_PER_MESSAGE = 3;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_OCR_TEXT_LENGTH = 12_000;
const DISCORD_IMAGE_HOSTS = new Set(["cdn.discordapp.com"]);
const IMAGE_TYPES = new Map<string, { extension: string; matches: (bytes: Uint8Array) => boolean }>(
  [
    [
      "image/png",
      {
        extension: "png",
        matches: (bytes) => bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10",
      },
    ],
    [
      "image/jpeg",
      {
        extension: "jpg",
        matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      },
    ],
    [
      "image/gif",
      {
        extension: "gif",
        matches: (bytes) =>
          ["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.subarray(0, 6))),
      },
    ],
    ["image/bmp", { extension: "bmp", matches: (bytes) => bytes[0] === 0x42 && bytes[1] === 0x4d }],
    [
      "image/tiff",
      {
        extension: "tif",
        matches: (bytes) =>
          ["II*\0", "MM\0*"].includes(new TextDecoder().decode(bytes.subarray(0, 4))),
      },
    ],
  ],
);
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

async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
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
      if (total > maxBytes) {
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
  return bytes;
}

async function readJsonWithLimit(response: Response): Promise<unknown> {
  const bytes = await readResponseBytes(response, MAX_RESPONSE_BYTES);
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Extrai apenas resultados explicitamente marcados como parseados pelo OCR.space. */
export function parseOcrSpaceResponse(payload: unknown): OcrResult | null {
  if (!isRecord(payload) || payload.IsErroredOnProcessing === true) return null;
  if (payload.OCRExitCode !== 1 && payload.OCRExitCode !== 2) return null;
  if (!Array.isArray(payload.ParsedResults)) return null;

  const text = payload.ParsedResults.filter(isRecord)
    .filter((result) => result.FileParseExitCode === 1 || result.FileParseExitCode === "1")
    .map((result) => result.ParsedText)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_OCR_TEXT_LENGTH);

  if (!text) return null;

  // OCR.space não fornece confiança de transcrição no contrato de resposta.
  return { text, confidence: null };
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
  if (!entitlement || !isPlanId(entitlement.planId) || !planAllows(entitlement.planId, "ocr")) {
    options.log?.info("OCR ignorado", { guildId, reason: "plan_not_entitled" });
    return null;
  }
  const config = await moduleConfig(guildId, "ocr");
  if (!isEnabled(config)) {
    options.log?.info("OCR ignorado", { guildId, reason: "ocr_module_disabled" });
    return null;
  }

  const apiKey = process.env.OCR_SPACE_API_KEY?.trim();
  if (!apiKey) {
    options.log?.warn("OCR indisponivel", { guildId, reason: "missing_configuration" });
    return null;
  }
  if (!isAllowedDiscordImageUrl(imageUrl)) {
    options.log?.warn("imagem ignorada pelo OCR", { guildId, reason: "untrusted_image_url" });
    return null;
  }

  // O endpoint público gratuito do OCR.space limita arquivos enviados a 1 MiB.
  const configuredMaxBytes = Math.max(1, Math.min(8, num(config, "maxImageMb", 8))) * 1024 * 1024;
  const maxImageBytes = Math.min(MAX_IMAGE_BYTES, configuredMaxBytes);
  if (
    options.sizeBytes === undefined ||
    !Number.isFinite(options.sizeBytes) ||
    options.sizeBytes <= 0 ||
    options.sizeBytes > maxImageBytes
  ) {
    options.log?.info("imagem ignorada por tamanho", { guildId, maxImageMb: 1 });
    return null;
  }

  const useCache = bool(config, "cacheResults", true);
  const ttlMinutes = Math.max(1, Math.trunc(num(config, "cacheTtlMinutes", 60)));
  const key = cacheKey(imageUrl, entitlement.accountId);

  if (useCache) {
    const hit = cacheGet(key, ttlMinutes);
    if (hit !== undefined) {
      options.log?.info("OCR cache consultado", {
        guildId,
        textFound: Boolean(hit?.text),
        textLength: hit?.text.length ?? 0,
      });
      return hit;
    }
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
    const imageResponse = await fetch(imageUrl, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (!imageResponse.ok) {
      options.log?.warn("não foi possível baixar imagem do Discord para OCR", {
        guildId,
        status: imageResponse.status,
      });
      return null;
    }

    const imageBytes = await readResponseBytes(imageResponse, maxImageBytes);
    const imageType = [...IMAGE_TYPES].find(([, type]) => type.matches(imageBytes));
    if (!imageType) {
      options.log?.warn("OCR não reconheceu o formato da imagem", {
        guildId,
        imageBytes: imageBytes.byteLength,
      });
      return null;
    }

    options.log?.info("imagem enviada ao OCR.space", {
      guildId,
      imageType: imageType[0],
      imageBytes: imageBytes.byteLength,
    });

    const form = new FormData();
    const fileBuffer = new ArrayBuffer(imageBytes.byteLength);
    new Uint8Array(fileBuffer).set(imageBytes);
    form.append(
      "file",
      new Blob([fileBuffer], { type: imageType[0] }),
      `attachment.${imageType[1].extension}`,
    );
    form.append("OCREngine", "2");
    form.append("isOverlayRequired", "false");

    const res = await fetch(OCR_SPACE_API_URL, {
      method: "POST",
      redirect: "error",
      headers: { apikey: apiKey },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      options.log?.warn("OCR respondeu com erro", { guildId, status: res.status });
      return null;
    }

    const payload = await readJsonWithLimit(res);
    const result = parseOcrSpaceResponse(payload);
    const responseData = isRecord(payload) ? payload : {};
    options.log?.info("OCR.space respondeu", {
      guildId,
      ocrExitCode: responseData.OCRExitCode ?? "missing",
      processingError: responseData.IsErroredOnProcessing === true,
      parsedResultCount: Array.isArray(responseData.ParsedResults)
        ? responseData.ParsedResults.length
        : 0,
      textFound: Boolean(result?.text),
      textLength: result?.text.length ?? 0,
    });

    // Quando o provedor não oferece score, aceita-se apenas parse explicitamente
    // bem-sucedido; um score disponível em outro contrato ainda respeita o limiar.
    const threshold = Math.min(1, Math.max(0, num(config, "confidenceThreshold", 0.7)));
    if (result && result.confidence !== null && result.confidence < threshold) {
      options.log?.info("OCR sem confianca suficiente", {
        guildId,
        confidence: result.confidence,
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
