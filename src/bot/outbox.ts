/**
 * Processamento da fila de saida.
 *
 * O painel e o bot sao processos diferentes: a unica ponte e o arquivo de
 * runtime. O painel enfileira, o bot publica e grava o resultado de volta.
 *
 * A parte pura (decidir o que esta pendente, marcar resultado) fica aqui e e
 * testavel; o envio em si mora em `outbox-send.ts`, que depende do discord.js.
 */
import type { OutboxJob } from "../lib/wumpus/runtime.server.ts";

/** Pedidos ainda nao processados deste servidor. */
export function pendingJobs(jobs: OutboxJob[] | undefined, guildId: string): OutboxJob[] {
  if (!Array.isArray(jobs)) return [];
  return jobs.filter((job) => job.guildId === guildId && job.status === "queued");
}

/**
 * Marca um pedido como concluido ou falho.
 *
 * Devolve uma lista NOVA: o runtime e lido e reescrito inteiro, e mutar o array
 * recebido deixaria o cache em memoria divergindo do arquivo.
 */
export function settleJob(
  jobs: OutboxJob[] | undefined,
  jobId: string,
  result: { ok: true; channelId: string; messageId: string } | { ok: false; error: string }
): OutboxJob[] {
  if (!Array.isArray(jobs)) return [];

  return jobs.map((job) => {
    if (job.id !== jobId) return job;

    if (result.ok) {
      return {
        ...job,
        status: "done" as const,
        channelId: result.channelId,
        messageId: result.messageId,
        at: Date.now(),
        detail: "Publicado."
      };
    }

    return {
      ...job,
      status: "failed" as const,
      at: Date.now(),
      detail: result.error.slice(0, 300)
    };
  });
}

/**
 * Descarta o que ja foi processado ha tempo.
 *
 * Sem isto a fila so cresce: cada publicacao bem-sucedida ficaria no arquivo
 * para sempre. Mantem as falhas mais tempo porque elas sao o que o usuario
 * precisa ver no painel.
 */
export function pruneOutbox(jobs: OutboxJob[] | undefined, now = Date.now()): OutboxJob[] {
  if (!Array.isArray(jobs)) return [];

  const DONE_TTL = 10 * 60_000;
  const FAILED_TTL = 24 * 60 * 60_000;

  return jobs.filter((job) => {
    if (job.status === "queued") return true;
    const age = now - (job.at ?? job.createdAt);
    return age < (job.status === "failed" ? FAILED_TTL : DONE_TTL);
  });
}

/** Resumo legivel para o log — quantos de cada estado. */
export function outboxSummary(jobs: OutboxJob[] | undefined): string {
  const list = Array.isArray(jobs) ? jobs : [];
  const queued = list.filter((job) => job.status === "queued").length;
  const done = list.filter((job) => job.status === "done").length;
  const failed = list.filter((job) => job.status === "failed").length;
  return `${queued} na fila, ${done} publicados, ${failed} com erro`;
}
