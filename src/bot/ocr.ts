import type { Client } from "discord.js";

/**
 * Leitura de imagens (OCR) para revisao de conteudo suspeito.
 *
 * O ponto central: o AutoMod so enxerga TEXTO. Uma imagem com convite, link
 * malicioso ou termo bloqueado passa batido. Este modulo estende a moderacao
 * para dentro da imagem, alimentando a mesma deteccao do AutoMod.
 *
 * Dois provedores, com fallback:
 *  - "haiz": endpoint especializado (WUMPUS_HAIZ_OCR_URL).
 *  - "groq": modelo de visao da Groq.
 *  - "hybrid" (padrao): tenta o especializado e cai para a visao se falhar.
 *
 * A leitura NUNCA e obrigatoria: qualquer falha devolve null e o fluxo
 * normal do Discord segue. Moderacao nao pode derrubar mensagem legitima.
 */

export type OcrConfig = {
  provider?: string;
  language?: string;
  model?: string;
  retainExtractedText?: boolean;
  maxImageMb?: number;
  confidenceThreshold?: number;
  reviewChannelId?: string;
  autoDeleteSuspicious?: boolean;
  cacheResults?: boolean;
  cacheTtlMinutes?: number;
  logChannelId?: string;
};

export type OcrResult = {
  text: string;
  provider: "haiz" | "groq";
  /** Segundos aproximados nao sao medidos aqui; guardamos so o essencial. */
  truncated: boolean;
};

const OCR_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 4_000;

/** Aceita qualquer extensao de imagem que o Discord hospeda. */
export function isImage(contentType: string | null | undefined, name: string | null | undefined): boolean {
  if (contentType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name ?? "");
}

function languageName(code: string | undefined): string {
  if (code === "en") return "English";
  if (code === "es") return "espanol";
  return "portugues do Brasil";
}

/**
 * A resposta do endpoint especializado varia conforme a versao do servico.
 * Em vez de exigir um formato exato, procuramos o texto nos campos usuais —
 * assim uma mudanca do provedor nao quebra a moderacao.
 */
function pickText(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object" || payload === null) return null;

  const record = payload as Record<string, unknown>;
  for (const key of ["text", "content", "result", "extracted_text", "ocr_text"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  if (typeof record.data === "object" && record.data !== null) {
    return pickText(record.data);
  }
  return null;
}

async function readWithHaiz(imageUrl: string, config: OcrConfig): Promise<string | null> {
  const endpoint = process.env.WUMPUS_HAIZ_OCR_URL;
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WUMPUS_INTERNAL_KEY ? { "x-internal-key": process.env.WUMPUS_INTERNAL_KEY } : {})
      },
      body: JSON.stringify({
        image_url: imageUrl,
        url: imageUrl,
        language: config.language ?? "pt"
      }),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS)
    });

    if (!response.ok) return null;
    return pickText(await response.json());
  } catch {
    return null;
  }
}

async function readWithGroq(imageUrl: string, config: OcrConfig): Promise<string | null> {
  const apiKey = process.env.WUMPUS_GROQ_API_KEY;
  if (!apiKey) return null;

  const model = config.model || process.env.WUMPUS_GROQ_VISION_MODEL || "qwen/qwen3.6-27b";

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1_200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcreva TODO o texto visivel nesta imagem, em " +
                  `${languageName(config.language)}. ` +
                  "Devolva apenas o texto, sem comentarios. Se nao houver texto, responda vazio."
              },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS)
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Le o texto de uma imagem. Devolve null quando nada foi lido — o que inclui
 * "imagem sem texto", "provedor fora do ar" e "sem chave configurada".
 */
export async function extractText(
  _client: Client,
  imageUrl: string,
  size: number | null,
  config: OcrConfig
): Promise<OcrResult | null> {
  const maxBytes = (config.maxImageMb ?? 8) * 1024 * 1024;
  if (size !== null && size > maxBytes) return null;

  const provider = config.provider ?? "hybrid";

  let text: string | null = null;
  let used: "haiz" | "groq" = "haiz";

  if (provider === "haiz" || provider === "hybrid") {
    text = await readWithHaiz(imageUrl, config);
  }
  if (!text && (provider === "groq" || provider === "hybrid")) {
    text = await readWithGroq(imageUrl, config);
    used = "groq";
  }

  if (!text || !text.trim()) return null;

  const clean = text.trim();
  const truncated = clean.length > MAX_TEXT_CHARS;

  return {
    text: truncated ? clean.slice(0, MAX_TEXT_CHARS) : clean,
    provider: used,
    truncated
  };
}
