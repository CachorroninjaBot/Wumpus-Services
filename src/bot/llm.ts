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
  return process.env.WUMPUS_GROQ_VISION_MODEL?.trim() || "qwen/qwen3.8-27b";
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
};

export type ChatResult = {
  text: string;
  model: string;
  durationMs: number;
};

export async function groqChat(request: ChatRequest): Promise<ChatResult> {
  const apiKey = process.env.WUMPUS_GROQ_API_KEY;
  if (!apiKey) throw new Error("WUMPUS_GROQ_API_KEY nao esta configurada.");

  const started = Date.now();
  const body: Record<string, unknown> = {
    model: request.model,
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxTokens ?? 800,
    messages: request.messages
  };
  if (request.json) {
    body.response_format = { type: "json_object" };
  }

  try {
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

    const durationMs = Date.now() - started;
    if (!response.ok) {
      const detail = await response.text();
      recordMetric({
        kind: "ai",
        name: request.purpose,
        durationMs,
        ok: false,
        status: response.status,
        data: { model: request.model }
      });
      throw new Error(`Provedor de IA respondeu ${response.status}: ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Resposta da IA sem conteudo.");

    recordMetric({
      kind: "ai",
      name: request.purpose,
      durationMs,
      ok: true,
      status: 200,
      data: { model: request.model }
    });

    return { text, model: request.model, durationMs };
  } catch (error) {
    const durationMs = Date.now() - started;
    if (!(error instanceof Error && error.message.startsWith("Provedor de IA"))) {
      recordMetric({
        kind: "ai",
        name: request.purpose,
        durationMs,
        ok: false,
        data: { model: request.model, error: error instanceof Error ? error.name : "unknown" }
      });
    }
    throw error;
  }
}
