/**
 * Persistência das coleções do bot.
 *
 * O bot antigo guardava tickets abertos e contadores de anti-raid em `Map()`,
 * ou seja: tudo sumia a cada restart, e `maxOpenPerUser` virava ficcao depois
 * do primeiro deploy. Aqui o estado sobrevive ao processo.
 *
 * Em produção, cada coleção é armazenada no PostgreSQL e as alterações usam
 * transações com lock por coleção. Sem DATABASE_URL, o modo local usa arquivos.
 *
 * JSON permanece apenas como fallback de desenvolvimento sem DATABASE_URL.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { isDatabaseConfigured, mutatePersistentState, readPersistentState } from "../lib/wumpus/database.server.ts";

const DIR = process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data");

const memory = new Map<string, unknown[]>();
const queues = new Map<string, Promise<unknown>>();

/** Clear the in-process cache when tests simulate a fresh bot process. */
export function resetStoreCacheForTests(name?: string): void {
  if (name) memory.delete(name);
  else memory.clear();
}

function fileFor(name: string): string {
  return join(DIR, `${name}.json`);
}

/** Le uma colecao. Arquivo ausente ou corrompido vale como lista vazia. */
export async function read<T>(name: string): Promise<T[]> {
  if (isDatabaseConfigured()) {
    return (await readPersistentState<T[]>(`bot-collection:${name}`)) ?? [];
  }

  const cached = memory.get(name);
  if (cached) return cached as T[];

  try {
    const parsed = JSON.parse(await readFile(fileFor(name), "utf8"));
    const rows = Array.isArray(parsed) ? parsed : [];
    memory.set(name, rows);
    return rows as T[];
  } catch {
    memory.set(name, []);
    return [];
  }
}

async function persist(name: string, rows: unknown[]): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const target = fileFor(name);
  const tmp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(rows, null, 2));
  try {
    await rename(tmp, target);
  } catch (error) {
    // No Windows, rename nao substitui um destino existente. Remove o arquivo
    // antigo e tenta novamente; em outros erros, preserva a falha original.
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EEXIST" && code !== "EACCES") throw error;
    await rm(target, { force: true });
    await rename(tmp, target);
  } finally {
    await rm(tmp, { force: true });
  }
}

/**
 * Aplica uma mudanca numa colecao e grava.
 *
 * As chamadas sao encadeadas por colecao: sem isso, dois eventos que chegam
 * juntos leem o mesmo estado inicial e a segunda gravacao apaga a primeira.
 * O callback recebe as linhas atuais e devolve as novas (ou muta no lugar).
 */
export async function mutate<T>(name: string, fn: (rows: T[]) => T[] | void): Promise<T[]> {
  if (isDatabaseConfigured()) {
    return mutatePersistentState(`bot-collection:${name}`, () => [], fn);
  }

  const previous = queues.get(name) ?? Promise.resolve();

  const next = previous.then(async () => {
    const rows = await read<T>(name);
    const result = fn(rows) ?? rows;
    memory.set(name, result);
    await persist(name, result);
    return result;
  });

  // A fila segue mesmo se uma gravacao falhar, para nao travar as proximas.
  queues.set(name, next.catch(() => undefined));
  return next;
}

/**
 * Proximo id de uma sequencia (tickets, ocorrencias, candidaturas).
 * Guardado em `counters` para nao reutilizar numero depois de um restart.
 */
export async function nextId(name: string): Promise<number> {
  let assigned = 0;

  await mutate<{ key: string; value: number }>("counters", (rows) => {
    const found = rows.find((row) => row.key === name);
    if (found) {
      found.value += 1;
      assigned = found.value;
    } else {
      rows.push({ key: name, value: 1 });
      assigned = 1;
    }
    return rows;
  });

  return assigned;
}

/**
 * Mutacoes agrupadas por coalescencia.
 *
 * `mutate` regrava a colecao inteira (transacao com `SELECT ... FOR UPDATE` no
 * PostgreSQL) a cada chamada. Para eventos de alta frequencia — auditoria,
 * mensagens de ticket — isso era uma transacao por evento. Aqui as mutacoes
 * acumulam por um curto periodo e viram UMA escrita: os callbacks rodam em
 * sequencia sobre as mesmas linhas, com a mesma semantica de `mutate`.
 *
 * So use para mutacoes sem leitura imediata posterior (read-after-write): o
 * resultado so existe apos o flush. Chamadas que dependem de ordem com outras
 * escritas devem continuar em `mutate` puro.
 */
type BatchedMutation = {
  fn: (rows: unknown[]) => unknown[] | void;
  resolve: (rows: unknown[]) => void;
  reject: (reason: unknown) => void;
};

const BATCH_DELAY_MS = 2_000;
const BATCH_MAX_PENDING = 50;
const batchedQueues = new Map<string, BatchedMutation[]>();
const batchedTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function mutateBatched<T>(name: string, fn: (rows: T[]) => T[] | void): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const queue = batchedQueues.get(name) ?? [];
    queue.push({
      fn: fn as (rows: unknown[]) => unknown[] | void,
      resolve: resolve as (rows: unknown[]) => void,
      reject,
    });
    batchedQueues.set(name, queue);

    if (queue.length >= BATCH_MAX_PENDING) {
      void flushBatchedMutations(name);
      return;
    }
    if (!batchedTimers.has(name)) {
      const timer = setTimeout(() => {
        batchedTimers.delete(name);
        void flushBatchedMutations(name);
      }, BATCH_DELAY_MS);
      timer.unref?.();
      batchedTimers.set(name, timer);
    }
  });
}

/**
 * Despeja imediatamente as mutacoes pendentes (de uma colecao ou de todas).
 * Chamado no shutdown do bot e antes de operacoes que precisam ver o estado
 * mais recente, como a poda da auditoria.
 */
export async function flushBatchedMutations(name?: string): Promise<void> {
  const names = name ? [name] : [...batchedQueues.keys()];
  for (const key of names) {
    const timer = batchedTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      batchedTimers.delete(key);
    }
    const queue = batchedQueues.get(key);
    if (!queue?.length) continue;
    batchedQueues.delete(key);
    try {
      const result = await mutate<unknown>(key, (rows) => {
        let current = rows;
        for (const item of queue) current = (item.fn(current) ?? current) as unknown[];
        return current;
      });
      for (const item of queue) item.resolve(result);
    } catch (error) {
      for (const item of queue) item.reject(error);
    }
  }
}
