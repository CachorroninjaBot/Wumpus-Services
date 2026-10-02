/**
 * Cliente de IA — Groq (endpoint compativel com OpenAI).
 *
 * As credenciais reais do projeto sao do Groq (`WUMPUS_GROQ_API_KEY`), com dois
 * modelos: um de qualidade e um de visao. O `analyze.ts` do painel procura
 * `XAI_API_KEY`, que nao existe no ambiente — por isso a analise de IA do
 * dashboard responde sempre "IA indisponivel". Aqui usamos a chave que existe.
 *
 * Duas regras que o bot precisa e o painel nao:
 *   1. timeout agressivo — um handler de mensagem nao pode pendurar o bot
 *   2. cache — a mesma pergunta nao deve custar duas chamadas
 */
import { createHash } from "node:crypto";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 20_000;

/** Modelo de qualidade (analise, redacao) e modelo rapido (busca, resposta curta). */
export function qualityModel(): string {
  return process.env.WUMPUS_GROQ_MODEL || "openai/gpt-oss-120b";
}

export function fastModel(): string {
  return process.env.WUMPUS_GROQ_MODEL || "openai/gpt-oss-120b";
}

export function visionModel(): string {
  return process.env.WUMPUS_GROQ_VISION_MODEL || "qwen/qwen3.6-27b";
}

export function groqConfigured(): boolean {
  return Boolean(process.env.WUMPUS_GROQ_API_KEY);
}

/** Cache de resposta: mesma pergunta + mesmo modelo devolve o mesmo texto. */
const cache = new Map<string, { text: string; at: number }>();
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 200;

function cacheKey(payload: unknown): string {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.text;
}

function cacheSet(key: string, text: string): void {
  if (cache.size >= CACHE_MAX) {
    // Descarta o mais antigo — o Map preserva ordem de insercao.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { text, at: Date.now() });
}

type GroqContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type GroqChoice = { message?: { content?: string } };

/**
 * Uma chamada ao Groq. Devolve `null` em qualquer falha — IA indisponivel nao
 * pode virar excecao no meio de um atendimento.
 */
export async function groqChat(
  messages: Array<{ role: string; content: GroqContent }>,
  options: { model?: string; maxTokens?: number; timeoutMs?: number; noCache?: boolean } = {}
): Promise<string | null> {
  const apiKey = process.env.WUMPUS_GROQ_API_KEY;
  if (!apiKey) return null;

  const model = options.model ?? qualityModel();
  const body = {
    model,
    max_tokens: options.maxTokens ?? 700,
    temperature: 0.2,
    messages
  };

  const key = cacheKey(body);
  if (!options.noCache) {
    const hit = cacheGet(key);
    if (hit) return hit;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: GroqChoice[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    if (!options.noCache) cacheSet(key, text);
    return text;
  } catch {
    // Timeout, rede ou resposta invalida: indistinguiveis para quem chamou.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analise com contexto — usada por tickets e candidaturas.
 * Recebe o historico ja montado por quem chamou, para o prompt nao depender
 * de o modulo saber formatar.
 */
export async function analyzeWithContext(input: {
  task: string;
  context: string;
  maxTokens?: number;
}): Promise<string | null> {
  return groqChat(
    [
      {
        role: "system",
        content: [
          "Voce e o Wumpus, assistente de staff de comunidades no Discord.",
          "Responda em portugues do Brasil, curto e operacional.",
          "Nunca invente fatos que nao estejam no material fornecido.",
          "Se faltar contexto, diga o que falta em vez de supor.",
          input.task
        ].join(" ")
      },
      { role: "user", content: input.context }
    ],
    { model: qualityModel(), maxTokens: input.maxTokens ?? 700 }
  );
}
