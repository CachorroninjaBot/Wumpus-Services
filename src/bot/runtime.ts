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
import { readRuntime as readSharedRuntime } from "../lib/wumpus/runtime.server.ts";

export type RuntimeArticle = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  category?: string;
  exampleQuestions?: string[];
  approved: boolean;
};

export type RuntimeSnapshot = {
  updatedAt: number;
  articles: Record<string, RuntimeArticle[]>;
};

const TTL_MS = 30_000;

let cache: { snapshot: RuntimeSnapshot; at: number } | null = null;

/**
 * Le o runtime. Cache mais longo que o da config: a base de conhecimento muda
 * raramente, e a busca acontece em toda mensagem de duvida.
 */
export async function readRuntime(force = false): Promise<RuntimeSnapshot> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.snapshot;

  const parsed = await readSharedRuntime();
  const snapshot: RuntimeSnapshot = { updatedAt: parsed.updatedAt, articles: parsed.articles ?? {} };
  cache = { snapshot, at: Date.now() };
  return snapshot;
}
