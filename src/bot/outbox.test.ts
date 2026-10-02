/**
 * Testes da fila de saida.
 *
 * O defeito que isto cobre e o mais caro do painel: "Publicar painel" dizia
 * "publicado" e nada chegava ao Discord. A fila e o que faz o pedido atravessar
 * de um processo para o outro, e o `settleJob` e o que impede o painel de
 * mentir sobre o resultado.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { outboxSummary, pendingJobs, pruneOutbox, settleJob } from "./outbox.ts";
import type { OutboxJob } from "../lib/wumpus/runtime.server.ts";

function job(over: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: "j1",
    guildId: "g1",
    kind: "panel",
    target: "tickets",
    channelRef: "ch_atendimento",
    createdAt: 1_000,
    status: "queued",
    ...over,
  };
}

/* --------------------------------------------------------------- pendentes --- */

test("fila ausente nao quebra", () => {
  assert.deepEqual(pendingJobs(undefined, "g1"), []);
});

test("so devolve pendente do servidor pedido", () => {
  const jobs = [
    job({ id: "a", guildId: "g1", status: "queued" }),
    job({ id: "b", guildId: "g2", status: "queued" }),
    job({ id: "c", guildId: "g1", status: "done" }),
  ];
  assert.deepEqual(pendingJobs(jobs, "g1").map((j) => j.id), ["a"]);
});

/* -------------------------------------------------------------- resultado --- */

test("sucesso marca publicado com canal e mensagem", () => {
  const out = settleJob([job()], "j1", { ok: true, channelId: "c9", messageId: "m9" });
  assert.equal(out[0]!.status, "done");
  assert.equal(out[0]!.channelId, "c9");
  assert.equal(out[0]!.messageId, "m9");
});

test("falha guarda o motivo para o painel mostrar", () => {
  const out = settleJob([job()], "j1", { ok: false, error: "Canal ch_atendimento nao existe." });
  assert.equal(out[0]!.status, "failed");
  assert.match(out[0]!.detail ?? "", /nao existe/);
});

test("motivo de falha muito longo e cortado", () => {
  const out = settleJob([job()], "j1", { ok: false, error: "x".repeat(5000) });
  assert.ok((out[0]!.detail ?? "").length <= 300);
});

test("settle nao altera outros pedidos", () => {
  const jobs = [job({ id: "a" }), job({ id: "b" })];
  const out = settleJob(jobs, "a", { ok: true, channelId: "c", messageId: "m" });
  assert.equal(out[1]!.status, "queued");
});

test("settle de id desconhecido nao muda nada", () => {
  const out = settleJob([job({ id: "a" })], "zzz", { ok: true, channelId: "c", messageId: "m" });
  assert.equal(out[0]!.status, "queued");
});

test("settle devolve lista nova, sem mutar a entrada", () => {
  const jobs = [job()];
  const out = settleJob(jobs, "j1", { ok: true, channelId: "c", messageId: "m" });
  assert.notEqual(out, jobs);
  assert.equal(jobs[0]!.status, "queued", "a entrada nao pode ser alterada");
});

/* --------------------------------------------------------------- limpeza --- */

test("pedido publicado ha muito tempo sai da fila", () => {
  const velho = job({ status: "done", at: 1_000 });
  assert.deepEqual(pruneOutbox([velho], 1_000 + 20 * 60_000), []);
});

test("pedido recem-publicado continua para o painel confirmar", () => {
  const novo = job({ status: "done", at: 1_000 });
  assert.equal(pruneOutbox([novo], 1_000 + 60_000).length, 1);
});

test("falha fica mais tempo que sucesso", () => {
  const falha = job({ status: "failed", at: 1_000 });
  assert.equal(pruneOutbox([falha], 1_000 + 60 * 60_000).length, 1);
  assert.deepEqual(pruneOutbox([falha], 1_000 + 30 * 60 * 60_000), []);
});

test("pendente nunca e descartado", () => {
  const pendente = job({ status: "queued" });
  assert.equal(pruneOutbox([pendente], 1_000 + 365 * 24 * 60 * 60_000).length, 1);
});

test("limpeza de fila ausente nao quebra", () => {
  assert.deepEqual(pruneOutbox(undefined), []);
});

/* --------------------------------------------------------------- resumo --- */

test("resumo conta cada estado", () => {
  const jobs = [
    job({ id: "a", status: "queued" }),
    job({ id: "b", status: "done" }),
    job({ id: "c", status: "done" }),
    job({ id: "d", status: "failed" }),
  ];
  assert.equal(outboxSummary(jobs), "1 na fila, 2 publicados, 1 com erro");
});

test("resumo de fila vazia", () => {
  assert.equal(outboxSummary(undefined), "0 na fila, 0 publicados, 0 com erro");
});
