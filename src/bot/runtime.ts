/**
 * Leitura do runtime publicado pelo painel — incluindo a base de conhecimento.
 *
 * `config.ts` cuida da config por modulo (com os acessores tipados). Aqui fica
 * o resto do arquivo: os artigos e o carimbo de publicacao.
 *
 * Compartilha o cache de `config.ts`? Nao — sao leituras independentes e raras
 * (a base so muda quando alguem edita no painel), e um cache proprio evita que
 * uma busca de conhecimento force recarregar a config dos modulos.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RuntimeArticle = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  approved: boolean;
};

export type RuntimeSnapshot = {
  updatedAt: number;
  articles: Record<string, RuntimeArticle[]>;
};

const TTL_MS = 30_000;

const EMPTY: RuntimeSnapshot = { updatedAt: 0, articles: {} };

let cache: { snapshot: RuntimeSnapshot; at: number } | null = null;

function runtimePath(): string {
  return process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");
}

/**
 * Le o runtime. Cache mais longo que o da config: a base de conhecimento muda
 * raramente, e a busca acontece em toda mensagem de duvida.
 */
export async function readRuntime(force = false): Promise<RuntimeSnapshot> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.snapshot;

  try {
    const parsed = JSON.parse(await readFile(runtimePath(), "utf8")) as {
      updatedAt?: number;
      articles?: Record<string, RuntimeArticle[]>;
    };

    const snapshot: RuntimeSnapshot = {
      updatedAt: Number(parsed?.updatedAt) || 0,
      articles: parsed?.articles && typeof parsed.articles === "object" ? parsed.articles : {}
    };

    cache = { snapshot, at: Date.now() };
    return snapshot;
  } catch {
    cache = { snapshot: EMPTY, at: Date.now() };
    return EMPTY;
  }
}
