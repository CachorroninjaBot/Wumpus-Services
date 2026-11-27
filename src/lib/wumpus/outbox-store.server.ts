/**
 * Fila de saída do painel para o bot — tabela própria (`wumpus_outbox`).
 *
 * Antes cada envio ou liquidação de job reescrevia o JSONB inteiro do runtime
 * com `FOR UPDATE`; com auditoria e estatísticas gravando o tempo todo, esse
 * era o maior custo de escrita do banco. Agora o outbox tem linhas próprias e
 * cada operação toca só a linha do job.
 *
 * Sem `DATABASE_URL` (desenvolvimento local) a fila continua no JSON do
 * runtime, com a mesma API — os chamadores não precisam saber onde ela mora.
 */
import { isDatabaseConfigured, queryDatabase } from "./database.server.ts";
import {
  enqueueOutbox as enqueueRuntimeOutbox,
  mutateRuntime,
  readRuntime,
  type OutboxJob,
} from "./runtime.server.ts";
import { pendingJobs, pruneOutbox } from "../../bot/outbox.ts";

/** Janela para um job "reivindicado" voltar à fila caso o bot morra no meio. */
const CLAIM_TTL_SECONDS = 300;

export type OutboxSettlement = {
  ok: boolean;
  detail?: string;
  channelId?: string;
  messageId?: string;
};

function settlementPatch(result: OutboxSettlement): Partial<OutboxJob> {
  const detail = (result.detail ?? (result.ok ? "Publicado." : "Falhou.")).slice(0, 300);
  return {
    status: result.ok ? "done" : "failed",
    detail,
    ...(result.channelId ? { channelId: result.channelId } : {}),
    ...(result.messageId ? { messageId: result.messageId } : {}),
    at: Date.now(),
  };
}

export async function enqueueOutboxJob(job: OutboxJob): Promise<void> {
  if (!isDatabaseConfigured()) {
    await enqueueRuntimeOutbox(job);
    return;
  }
  await queryDatabase(
    `INSERT INTO wumpus_outbox (id, guild_id, job, status, created_at)
     VALUES ($1, $2, $3::jsonb, $4, to_timestamp($5 / 1000.0))
     ON CONFLICT (id) DO NOTHING`,
    [job.id, job.guildId, JSON.stringify(job), job.status, job.createdAt],
  );
}

/**
 * Pega os jobs pendentes de um servidor e os marca como reivindicados.
 *
 * `SKIP LOCKED` evita que dois processos (deploy sobreposto) processem o mesmo
 * job; a janela de `claimed_at` devolve à fila o que ficou preso se o bot cair.
 */
export async function claimPendingOutboxJobs(guildId: string): Promise<OutboxJob[]> {
  if (!isDatabaseConfigured()) {
    return pendingJobs((await readRuntime()).outbox, guildId);
  }
  const rows = await queryDatabase<{ job: OutboxJob }>(
    `UPDATE wumpus_outbox SET claimed_at = now(), updated_at = now()
     WHERE id IN (
       SELECT id FROM wumpus_outbox
       WHERE guild_id = $1 AND status = 'queued'
         AND (claimed_at IS NULL OR claimed_at < now() - ($2::int * interval '1 second'))
       ORDER BY created_at
       LIMIT 50
       FOR UPDATE SKIP LOCKED
     )
     RETURNING job`,
    [guildId, CLAIM_TTL_SECONDS],
  );
  return rows.map((row) => row.job);
}

export async function findOutboxJob(jobId: string, guildId?: string): Promise<OutboxJob | null> {
  if (!isDatabaseConfigured()) {
    return (await readRuntime()).outbox?.find(
      (job) => job.id === jobId && (guildId === undefined || job.guildId === guildId),
    ) ?? null;
  }
  const rows = await queryDatabase<{ job: OutboxJob }>(
    `SELECT job FROM wumpus_outbox
     WHERE id = $1 AND ($2::text IS NULL OR guild_id = $2)
     LIMIT 1`,
    [jobId, guildId ?? null],
  );
  return rows[0]?.job ?? null;
}

/** Jobs recentes do servidor, do mais novo para o mais antigo. */
export async function listGuildOutbox(guildId: string, limit = 100): Promise<OutboxJob[]> {
  if (!isDatabaseConfigured()) {
    return (await readRuntime()).outbox
      ?.filter((job) => job.guildId === guildId)
      .slice(-limit)
      .reverse() ?? [];
  }
  const rows = await queryDatabase<{ job: OutboxJob }>(
    `SELECT job FROM wumpus_outbox
     WHERE guild_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [guildId, limit],
  );
  return rows.map((row) => row.job);
}

export async function settleOutboxJob(jobId: string, result: OutboxSettlement): Promise<void> {
  const patch = settlementPatch(result);
  if (!isDatabaseConfigured()) {
    await mutateRuntime((current) => {
      current.outbox = (current.outbox ?? []).map((job) =>
        job.id === jobId ? { ...job, ...patch } : job,
      );
      current.updatedAt = Date.now();
    });
    return;
  }
  await queryDatabase(
    `UPDATE wumpus_outbox
     SET job = job || $2::jsonb, status = $3, updated_at = now()
     WHERE id = $1`,
    [jobId, JSON.stringify(patch), patch.status],
  );
}

/** Licença ausente: derruba tudo o que estava na fila deste servidor. */
export async function failQueuedOutboxJobs(guildId: string, detail: string): Promise<void> {
  const message = detail.slice(0, 300);
  const at = Date.now();
  if (!isDatabaseConfigured()) {
    await mutateRuntime((current) => {
      current.outbox = (current.outbox ?? []).map((job) =>
        job.guildId === guildId && job.status === "queued"
          ? { ...job, status: "failed" as const, detail: message, at }
          : job,
      );
      current.updatedAt = at;
    });
    return;
  }
  const patch = { status: "failed", detail: message, at };
  await queryDatabase(
    `UPDATE wumpus_outbox
     SET status = 'failed', job = job || $2::jsonb, updated_at = now()
     WHERE guild_id = $1 AND status = 'queued'`,
    [guildId, JSON.stringify(patch)],
  );
}

/** Limpeza periódica: concluídos saem em 10 min, falhas em 24 h. */
export async function pruneOutboxTable(): Promise<void> {
  if (!isDatabaseConfigured()) {
    await mutateRuntime((current) => {
      current.outbox = pruneOutbox(current.outbox);
      current.updatedAt = Date.now();
    });
    return;
  }
  await queryDatabase(
    `DELETE FROM wumpus_outbox
     WHERE (status = 'done' AND updated_at < now() - interval '10 minutes')
        OR (status = 'failed' AND updated_at < now() - interval '24 hours')`,
  );
}
