/**
 * Persistencia do bot — colecoes em JSON, com escrita serializada.
 *
 * O bot antigo guardava tickets abertos e contadores de anti-raid em `Map()`,
 * ou seja: tudo sumia a cada restart, e `maxOpenPerUser` virava ficcao depois
 * do primeiro deploy. Aqui o estado sobrevive ao processo.
 *
 * Cada colecao e um arquivo em `data/`. A escrita e serializada por colecao e
 * usa troca atomica (grava `.tmp` e renomeia), entao um crash no meio nao deixa
 * arquivo pela metade, e dois eventos simultaneos nao se sobrescrevem.
 *
 * Seam para Postgres: este arquivo e o UNICO ponto que toca disco. Migrar para
 * SQL significa reimplementar so estas funcoes — nenhum handler muda.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data");

const memory = new Map<string, unknown[]>();
const queues = new Map<string, Promise<unknown>>();

function fileFor(name: string): string {
  return join(DIR, `${name}.json`);
}

/** Le uma colecao. Arquivo ausente ou corrompido vale como lista vazia. */
export async function read<T>(name: string): Promise<T[]> {
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
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(rows, null, 2));
  await rename(tmp, target);
}

/**
 * Aplica uma mudanca numa colecao e grava.
 *
 * As chamadas sao encadeadas por colecao: sem isso, dois eventos que chegam
 * juntos leem o mesmo estado inicial e a segunda gravacao apaga a primeira.
 * O callback recebe as linhas atuais e devolve as novas (ou muta no lugar).
 */
export async function mutate<T>(name: string, fn: (rows: T[]) => T[] | void): Promise<T[]> {
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
