import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleDefaults } from "./defaults.ts";
import { publishInputSchema } from "./runtime-validation.ts";

const valid = {
  token: "signed-session",
  guildId: "12345678901234567",
  modules: {
    tickets: {
      enabled: true,
      panelTitle: "Suporte",
      departments: ["Suporte"],
    },
  },
};

test("aceita configuração conhecida e tipada", () => {
  assert.equal(publishInputSchema.safeParse(valid).success, true);
});

test("aceita os defaults que o workspace do cliente publica", () => {
  const modules = Object.fromEntries(Object.entries(moduleDefaults).map(([key, config]) => [
    key,
    { ...config, enabled: true },
  ]));
  assert.equal(publishInputSchema.safeParse({ ...valid, modules }).success, true);
});

test("recusa módulo ou campo não reconhecido", () => {
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { mystery: { enabled: true } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { panelTitle: "Ok", sendToken: "secret" } },
  }).success, false);
});

test("recusa tipo inválido, lista exagerada e corpo grande", () => {
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { slaWarningMinutes: "60" } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { departments: Array.from({ length: 101 }, () => "Suporte") } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { panelDescription: "x".repeat(65_000) } },
  }).success, false);
});

test("recusa estrutura aninhada incompatível com o contrato", () => {
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { forms: { fields: [{ label: "Nome", type: "unknown" }] } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { forms: { fields: [{ id: "nome", label: "Nome", type: "short" }] } },
  }).success, false);
});
