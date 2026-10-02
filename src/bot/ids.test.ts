/**
 * Testes dos custom_id versionados.
 *
 * Este e o contrato entre um botao publicado no Discord e o handler que o
 * recebe. Se o formato muda sem o parse acompanhar, o botao vira decoracao —
 * exatamente o que aconteceu com os paineis da geracao anterior.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { id, parseId } from "./ids.ts";

test("id monta e parseId le de volta", () => {
  const parsed = parseId(id("ticket", "open", 42));
  assert.deepEqual(parsed, { kind: "ticket", action: "open", args: ["42"] });
});

test("parseId recusa id de outra origem", () => {
  // Formato da geracao anterior: nao deve ser interpretado como nosso.
  assert.equal(parseId("tkt:open:0"), null);
  assert.equal(parseId(""), null);
  assert.equal(parseId("wumpus:v1:ticket"), null);
});

test("parseId recusa versao diferente", () => {
  assert.equal(parseId("wumpus:v2:ticket:open"), null);
});

test("id cabe no limite de 100 caracteres do Discord", () => {
  assert.ok(id("a".repeat(200), "b").length <= 100);
});
