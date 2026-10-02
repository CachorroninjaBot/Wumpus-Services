/**
 * Testes da pontuacao da base de conhecimento.
 *
 * `scoreArticle` decide se o bot responde ou fica calado. Errar para mais faz o
 * bot inventar resposta em cima de material irrelevante; errar para menos faz a
 * base parecer vazia. Por isso titulo e tags pesam mais que corpo.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreArticle, type KnowledgeArticle } from "./knowledge.ts";

const artigo: KnowledgeArticle = {
  id: "a1",
  title: "Como abrir um ticket",
  body: "Use o painel de atendimento no canal de suporte.",
  tags: ["atendimento"],
  approved: true,
};

test("sem termos na pergunta, pontuacao zero", () => {
  assert.equal(scoreArticle(artigo, []), 0);
});

test("titulo pesa mais que corpo", () => {
  const noTitulo = scoreArticle(artigo, ["ticket"]);
  const noCorpo = scoreArticle(artigo, ["painel"]);
  assert.ok(noTitulo > noCorpo, `titulo=${noTitulo} corpo=${noCorpo}`);
});

test("tag pesa mais que corpo", () => {
  const naTag = scoreArticle(artigo, ["atendimento"]);
  const noCorpo = scoreArticle(artigo, ["suporte"]);
  assert.ok(naTag > noCorpo, `tag=${naTag} corpo=${noCorpo}`);
});

test("termo ausente nao pontua", () => {
  assert.equal(scoreArticle(artigo, ["blockchain"]), 0);
});

test("pontuacao fica entre 0 e 1", () => {
  const score = scoreArticle(artigo, ["ticket", "atendimento", "painel"]);
  assert.ok(score > 0 && score <= 1, `score=${score}`);
});

test("mais acertos no titulo aumentam a pontuacao", () => {
  const um = scoreArticle(artigo, ["ticket", "blockchain"]);
  const dois = scoreArticle(artigo, ["ticket", "abrir"]);
  assert.ok(dois > um, `dois=${dois} um=${um}`);
});
