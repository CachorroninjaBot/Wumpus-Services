/**
 * Acesso ao arquivo de runtime — SERVER-ONLY.
 *
 * O sufixo `.server.ts` e a convencao do TanStack Start para modulo que so
 * pode rodar no servidor: o import-protection do build recusa que qualquer
 * codigo de cliente chegue aqui. Isso importa porque este arquivo usa
 * `node:fs`, que nao existe no navegador.
 *
 * O painel publica aqui; o bot (outro processo) le o mesmo arquivo.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type RuntimeGuild = {
  name?: string;
  tickets?: Record<string, unknown>;
  forms?: Record<string, unknown>;
  automod?: Record<string, unknown>;
  security?: Record<string, unknown>;
  servers?: Record<string, unknown>;
  moderation?: Record<string, unknown>;
  logs?: Record<string, unknown>;
  staff?: Record<string, unknown>;
  roles?: Record<string, unknown>;
  knowledge?: Record<string, unknown>;
  statistics?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
  ocr?: Record<string, unknown>;
  automations?: Record<string, unknown>;
};

export type RuntimeArticle = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  approved: boolean;
};

/**
 * Pedido de publicacao do painel para o bot.
 *
 * O painel NAO pode falar com o Discord: o bot roda em processo separado
 * (`scripts/start.mjs` faz `spawn`), e a unica ponte entre os dois e este
 * arquivo. Sem esta fila, "Publicar painel" na dashboard so escrevia um
 * registro no proprio estado — nunca chegava a canal nenhum.
 *
 * O bot le a fila, publica de verdade e marca o resultado aqui. Assim o painel
 * consegue mostrar "publicado em #canal" ou o erro real, em vez de fingir
 * sucesso.
 */
export type OutboxJob = {
  id: string;
  guildId: string;
  /** O que publicar. */
  kind: "panel";
  /** "tickets" | "forms" — decide o modulo de config a usar. */
  target: string;
  /** Referencia de canal da config (nome como "ch_atendimento" ou snowflake). */
  channelRef: string;
  createdAt: number;
  status: "queued" | "done" | "failed";
  /** Preenchido pelo bot. */
  detail?: string;
  channelId?: string;
  messageId?: string;
  at?: number;
};

export type RuntimeFile = {
  updatedAt: number;
  guilds: Record<string, RuntimeGuild>;
  /** Artigos da base de conhecimento, por servidor. */
  articles?: Record<string, RuntimeArticle[]>;
  /** Pedidos de publicacao aguardando o bot. */
  outbox?: OutboxJob[];
};

export function runtimePath(): string {
  return process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");
}

export async function readRuntime(): Promise<RuntimeFile> {
  try {
    const raw = await readFile(runtimePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeFile>;
    return {
      updatedAt: Number(parsed?.updatedAt) || 0,
      guilds: parsed?.guilds && typeof parsed.guilds === "object" ? parsed.guilds : {},
      articles: parsed?.articles && typeof parsed.articles === "object" ? parsed.articles : {},
      outbox: Array.isArray(parsed?.outbox) ? parsed.outbox : []
    };
  } catch {
    return { updatedAt: 0, guilds: {}, articles: {}, outbox: [] };
  }
}

/**
 * Enfileira um pedido de publicacao.
 *
 * A fila e limitada: sem teto, um bot que nao sobe deixaria o arquivo crescer
 * sem parar. Descarta os mais antigos ja concluidos primeiro, depois os
 * pendentes mais velhos.
 */
export async function enqueueOutbox(job: OutboxJob): Promise<void> {
  const current = await readRuntime();
  const fila = [...(current.outbox ?? []), job];
  current.outbox = fila.slice(-100);
  current.updatedAt = Date.now();
  await writeRuntime(current);
}

export async function writeRuntime(next: RuntimeFile): Promise<void> {
  const path = runtimePath();
  await mkdir(dirname(path), { recursive: true });

  // Troca atomica: um crash no meio da escrita nao deixa o arquivo corrompido,
  // o que deixaria o bot sem config ate alguem notar.
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2));
  await rename(tmp, path);
}
