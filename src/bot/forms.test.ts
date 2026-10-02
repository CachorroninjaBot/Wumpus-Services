/**
 * Testes da construcao de formulario.
 *
 * Aqui moram as duas armadilhas do Discord: o modal aceita no maximo 5
 * componentes, e o `custom_id` tem teto de 100 caracteres. Um formulario que
 * estoura qualquer um dos dois simplesmente nao abre — e o erro so aparece
 * quando alguem tenta usar.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeChoices,
  parseFields,
  pendingSelects,
  selectFields,
  textFields,
  MODAL_TEXT_LIMIT,
  SELECT_OPTION_LIMIT
} from "./forms.ts";

/* ----------------------------------------------------------- conversao --- */

test("formato novo com fields e lido", () => {
  const fields = parseFields({
    fields: [
      { id: "a", label: "Assunto", type: "select", options: ["X", "Y"] },
      { id: "b", label: "Nome", type: "short" }
    ]
  });
  assert.equal(fields.length, 2);
  assert.equal(fields[0]!.type, "select");
  assert.deepEqual(fields[0]!.options, ["X", "Y"]);
  assert.equal(fields[1]!.type, "short");
});

test("formato antigo (questions) continua funcionando", () => {
  const fields = parseFields({ questions: ["Nome?", "Por que?"] });
  assert.equal(fields.length, 2);
  assert.equal(fields[0]!.type, "short", "a primeira pergunta antiga era curta");
  assert.equal(fields[1]!.type, "paragraph");
});

test("sem config nenhuma, usa as perguntas padrao", () => {
  const fields = parseFields(null);
  assert.equal(fields.length, 3);
  assert.ok(fields.every((field) => field.label.length > 0));
});

test("select com menos de 2 opcoes vira texto", () => {
  // Um menu com uma opcao so (ou nenhuma) e impossivel de responder.
  const fields = parseFields({ fields: [{ label: "Assunto", type: "select", options: ["unica"] }] });
  assert.equal(fields[0]!.type, "paragraph");
});

test("campo sem rotulo e descartado", () => {
  const fields = parseFields({ fields: [{ label: "  " }, { label: "Valido" }] });
  assert.equal(fields.length, 1);
  assert.equal(fields[0]!.label, "Valido");
});

test("tipos desconhecidos caem em paragraph", () => {
  const fields = parseFields({ fields: [{ label: "X", type: "banana" }] });
  assert.equal(fields[0]!.type, "paragraph");
});

test("required ausente significa obrigatorio", () => {
  const fields = parseFields({ fields: [{ label: "X" }] });
  assert.equal(fields[0]!.required, true);
});

test("required false e respeitado", () => {
  const fields = parseFields({ fields: [{ label: "X", required: false }] });
  assert.equal(fields[0]!.required, false);
});

test("maxLength e preso em 1..1000", () => {
  const alto = parseFields({ fields: [{ label: "X", maxLength: 99999 }] });
  const baixo = parseFields({ fields: [{ label: "X", maxLength: -5 }] });
  assert.equal(alto[0]!.maxLength, 1000);
  assert.ok(baixo[0]!.maxLength >= 1);
});

test("opcoes de select sao limitadas a 25", () => {
  const many = Array.from({ length: 60 }, (_, i) => `op${i}`);
  const fields = parseFields({ fields: [{ label: "X", type: "select", options: many }] });
  assert.equal(fields[0]!.options.length, SELECT_OPTION_LIMIT);
});

test("opcoes vazias sao removidas", () => {
  const fields = parseFields({ fields: [{ label: "X", type: "select", options: ["a", "  ", "b"] }] });
  assert.deepEqual(fields[0]!.options, ["a", "b"]);
});

test("campo ganha id quando nao tem", () => {
  const fields = parseFields({ fields: [{ label: "X" }, { label: "Y" }] });
  assert.equal(fields[0]!.id, "f1");
  assert.equal(fields[1]!.id, "f2");
});

/* ------------------------------------------------------------ limites --- */

test("o modal recebe no maximo 5 campos de texto", () => {
  const fields = parseFields({
    fields: Array.from({ length: 12 }, (_, i) => ({ label: `p${i}`, type: "paragraph" }))
  });
  assert.equal(textFields(fields).length, MODAL_TEXT_LIMIT);
});

test("selects nao consomem o limite do modal", () => {
  const fields = parseFields({
    fields: [
      { label: "S", type: "select", options: ["a", "b"] },
      ...Array.from({ length: 5 }, (_, i) => ({ label: `p${i}`, type: "paragraph" }))
    ]
  });
  assert.equal(textFields(fields).length, 5);
  assert.equal(selectFields(fields).length, 1);
});

/* ------------------------------------------------------------ escolhas --- */

test("select obrigatorio sem resposta fica pendente", () => {
  const fields = parseFields({ fields: [{ id: "s", label: "Assunto", type: "select", options: ["a", "b"] }] });
  assert.equal(pendingSelects(fields, {}).length, 1);
  assert.equal(pendingSelects(fields, { s: "a" }).length, 0);
});

test("select opcional nao bloqueia o envio", () => {
  const fields = parseFields({
    fields: [{ id: "s", label: "Extra", type: "select", required: false, options: ["a", "b"] }]
  });
  assert.equal(pendingSelects(fields, {}).length, 0);
});

test("resumo mostra o que ja foi escolhido", () => {
  const fields = parseFields({ fields: [{ id: "s", label: "Assunto", type: "select", options: ["a", "b"] }] });
  assert.match(describeChoices(fields, { s: "Parceria" }), /Parceria/);
});

test("resumo lista o que ainda falta", () => {
  const fields = parseFields({
    fields: [
      { id: "a", label: "Assunto", type: "select", options: ["x", "y"] },
      { id: "b", label: "Area", type: "select", options: ["p", "q"] }
    ]
  });
  const text = describeChoices(fields, { a: "x" });
  assert.match(text, /Falta: Area/);
});

test("sem nada escolhido, o resumo orienta", () => {
  const fields = parseFields({ fields: [{ id: "a", label: "A", type: "select", options: ["x", "y"] }] });
  assert.match(describeChoices(fields, {}), /Escolha/);
});
