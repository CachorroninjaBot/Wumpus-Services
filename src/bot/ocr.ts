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
import { bool, isEnabled, moduleConfig, num, str } from "./config.ts";
import type { Logger } from "./logger.ts";

export type OcrResult = { text: string; confidence: number | null };

/** Cache por URL: a mesma imagem nao precisa ser lida duas vezes. */
const cache = new Map<string, { result: OcrResult | null; at: number }>();
const CACHE_MAX = 300;

function cacheKey(url: string): string {
  return url;
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
    Array.isArray(record.results) ? (record.results[0] as Record<string, unknown> | undefined)?.text : undefined,
    Array.isArray(record.lines) ? record.lines.join("\n") : undefined
  ];

  const text = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!text) return null;

  const rawConfidence = record.confidence ?? (record.result as Record<string, unknown> | undefined)?.confidence;
  const confidence = Number.isFinite(Number(rawConfidence)) ? Number(rawConfidence) : null;

  return { text: text.trim(), confidence };
}

/**
 * Le o texto de uma imagem. Devolve `null` quando o modulo esta desligado,
 * a imagem e grande demais, a API falha ou nao ha texto.
 */
export async function readImage(
  guildId: string,
  imageUrl: string,
  options: { sizeBytes?: number; log?: Logger } = {}
): Promise<OcrResult | null> {
  const config = await moduleConfig(guildId, "ocr");
  if (!isEnabled(config)) return null;

  const endpoint = process.env.WUMPUS_HAIZ_OCR_URL;
  const internalKey = process.env.WUMPUS_INTERNAL_KEY;
  if (!endpoint || !internalKey) return null;

  // Limite de tamanho: uma imagem enorme nao deve pendurar o handler.
  const maxMb = num(config, "maxImageMb", 8);
  if (options.sizeBytes && options.sizeBytes > maxMb * 1024 * 1024) {
    options.log?.info("imagem ignorada por tamanho", { guildId, maxMb });
    return null;
  }

  const useCache = bool(config, "cacheResults", true);
  const ttlMinutes = Math.max(1, Math.trunc(num(config, "cacheTtlMinutes", 60)));

  if (useCache) {
    const hit = cacheGet(cacheKey(imageUrl), ttlMinutes);
    if (hit !== undefined) return hit;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": internalKey
      },
      body: JSON.stringify({
        imageUrl,
        url: imageUrl,
        guildId,
        language: str(config, "language", "pt"),
        provider: str(config, "provider", "hybrid")
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      options.log?.warn("OCR respondeu com erro", { guildId, status: res.status });
      if (useCache) cacheSet(cacheKey(imageUrl), null);
      return null;
    }

    const result = extractText(await res.json());

    // Confianca minima: leitura ruim nao deve virar acusacao de golpe.
    if (result && result.confidence !== null) {
      const threshold = num(config, "confidenceThreshold", 0.7);
      if (result.confidence < threshold) {
        options.log?.info("OCR abaixo da confianca minima", { guildId, confidence: result.confidence, threshold });
        if (useCache) cacheSet(cacheKey(imageUrl), null);
        return null;
      }
    }

    if (useCache) cacheSet(cacheKey(imageUrl), result);
    return result;
  } catch {
    if (useCache) cacheSet(cacheKey(imageUrl), null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Texto de todas as imagens de uma mensagem, concatenado. */
export async function extractTextFromAttachments(
  guildId: string,
  images: Array<{ url: string; size?: number }>,
  log?: Logger
): Promise<string> {
  const parts: string[] = [];

  for (const image of images) {
    const result = await readImage(guildId, image.url, { sizeBytes: image.size, log });
    if (result?.text) parts.push(result.text);
  }

  return parts.join("\n");
}
