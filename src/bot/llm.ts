import { Agent, fetch as undiciFetch } from "undici";
import { recordMetric } from "../server/metrics.js";

/**
 * Cliente unico da Groq.
 *
 * Decisoes:
 *  - Keep-alive (undici Agent) para nao abrir TCP/TLS a cada analise.
 *  - Modelo de qualidade vs modelo rapido: analise de ticket usa o 120B;
 *    reescrita da base de conhecimento usa o 20B (~2x mais tokens/s).
 *  - JSON mode quando o chamador espera estrutura, para nao parsear prosa.
 *  - Retry com backoff exponencial para erros transitorios (429, 500+).
 *  - Fallback de modelo: se o modelo principal falhar, tenta o fallback.
 */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const agent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 8,
  pipelining: 1
});

export function qualityModel(): string {
  return process.env.WUMPUS_GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
}

export function fastModel(): string {
  return process.env.WUMPUS_GROQ_FAST_MODEL?.trim() || "openai/gpt-oss-20b";
}

export function visionModel(): string {
  return process.env.WUMPUS_GROQ_VISION_MODEL?.trim() || "qwen/qwen3.6-27b";
}

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "user"; content: Array<Record<string, unknown>> };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  purpose: string;
  /** Modelo de fallback se o principal falhar com erro transitorio. */
  fallbackModel?: string;
  /** Numero maximo de tentativas (padrao: 2). */
  maxRetries?: number;
};

export type ChatResult = {
  text: string;
  model: string;
  durationMs: number;
  retries: number;
};

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeRequest(
  request: ChatRequest,
  model: string,
  apiKey: string
): Promise<{ response: Response; durationMs: number }> {
  const body: Record<string, unknown> = {
    model,
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxTokens ?? 800,
    messages: request.messages
  };
  if (request.json) {
    body.response_format = { type: "json_object" };
  }

  const started = Date.now();
  const response = await undiciFetch(GROQ_ENDPOINT, {
    method: "POST",
    dispatcher: agent,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(request.timeoutMs ?? 18_000)
  });

  return { response, durationMs: Date.now() - started };
}

export async function groqChat(request: ChatRequest): Promise<ChatResult> {
  const apiKey = process.env.WUMPUS_GROQ_API_KEY;
  if (!apiKey) throw new Error("WUMPUS_GROQ_API_KEY nao esta configurada.");

  const maxRetries = request.maxRetries ?? 2;
  let lastError: Error | null = null;
  let retries = 0;
  const totalStarted = Date.now();

  // Tenta o modelo principal, depois o fallback
  const modelsToTry = [request.model];
  if (request.fallbackModel && request.fallbackModel !== request.model) {
    modelsToTry.push(request.fallbackModel);
  }

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { response, durationMs } = await executeRequest(request, model, apiKey);

        if (!response.ok) {
          const detail = await response.text();

          // Registra a metrica de falha
          recordMetric({
            kind: "ai",
            name: request.purpose,
            durationMs,
            ok: false,
            status: response.status,
            data: { model, attempt }
          });

          // Erro transitorio: retry com backoff
          if (isRetryable(response.status) && attempt < maxRetries) {
            retries++;
            const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
            await sleep(backoffMs);
            continue;
          }

          // Erro nao-transitorio ou ultima tentativa: tenta fallback
          lastError = new Error(
            `Provedor de IA respondeu ${response.status}: ${detail.slice(0, 200)}`
          );
          break;
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = payload.choices?.[0]?.message?.content?.trim();
        if (!text) {
          recordMetric({
            kind: "ai",
            name: request.purpose,
            durationMs,
            ok: false,
            data: { model, reason: "empty_response" }
          });
          lastError = new Error("Resposta da IA sem conteudo.");
          break;
        }

        // Sucesso
        const totalMs = Date.now() - totalStarted;
        recordMetric({
          kind: "ai",
          name: request.purpose,
          durationMs: totalMs,
          ok: true,
          status: 200,
          data: { model, retries }
        });

        return { text, model, durationMs: totalMs, retries };
      } catch (error) {
        const durationMs = Date.now() - totalStarted;

        // Timeout ou erro de rede: retry
        if (
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError" || error.name === "TypeError") &&
          attempt < maxRetries
        ) {
          retries++;
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          await sleep(backoffMs);
          continue;
        }

        recordMetric({
          kind: "ai",
          name: request.purpose,
          durationMs,
          ok: false,
          data: {
            model,
            attempt,
            error: error instanceof Error ? error.name : "unknown"
          }
        });

        lastError = error instanceof Error ? error : new Error(String(error));
        break;
      }
    }
  }

  throw lastError ?? new Error("Falha ao comunicar com o provedor de IA.");
}