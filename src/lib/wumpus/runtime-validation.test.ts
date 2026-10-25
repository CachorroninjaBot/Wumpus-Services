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

test("aceita configurações de departamento para canais, cargos e mensagens", () => {
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: {
      tickets: {
        panelButtonLabel: "Falar com a equipe",
        panelButtonEmoji: "🎫",
        departments: ["Suporte"],
        departmentSettings: [{
          id: "support",
          name: "Suporte",
          description: "Ajuda com o servidor",
          emoji: "🛟",
          categoryId: "suporte",
          staffRoleIds: ["12345678901234567"],
          inheritStaff: false,
          welcomeMessage: "Conte como podemos ajudar.",
          intakeQuestions: ["Qual é a sua dúvida?"],
        }],
      },
    },
  }).success, true);
});

test("aceita personalização do painel e rejeita limites inválidos", () => {
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: {
      tickets: {
        departmentDisplayMode: "buttons",
        departmentButtonStyle: 3,
        panelButtonStyle: 1,
        panelFooter: "Atendimento de segunda a sexta.",
        departmentMenuPrompt: "Escolha o assunto:",
        departmentMenuPlaceholder: "Selecione uma opção",
        departments: ["Suporte"],
        departmentSettings: [{
          id: "support",
          name: "Suporte",
          description: "Ajuda com o servidor",
          emoji: "🛟",
          categoryId: "",
          staffRoleIds: [],
          inheritStaff: true,
          welcomeMessage: "",
          intakeQuestions: [],
        }],
      },
    },
  }).success, true);

  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { departmentDisplayMode: "buttons", departmentButtonStyle: 5 } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { panelFooter: "x".repeat(301) } },
  }).success, false);
});

test("recusa mais departamentos configurados do que o Discord suporta", () => {
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: {
      tickets: {
        departmentSettings: Array.from({ length: 26 }, (_, index) => ({
          id: `type-${index}`,
          name: `Tipo ${index}`,
          description: "",
          emoji: "",
          categoryId: "",
          staffRoleIds: [],
          inheritStaff: true,
          welcomeMessage: "",
          intakeQuestions: [],
        })),
      },
    },
  }).success, false);
});

test("recusa nomes repetidos e perguntas incompatíveis com o modal do Discord", () => {
  const department = {
    id: "support",
    name: "Suporte",
    description: "",
    emoji: "🎫",
    categoryId: "",
    staffRoleIds: [],
    inheritStaff: true,
    welcomeMessage: "",
    intakeQuestions: ["Pergunta válida"],
  };
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { departmentSettings: [department, { ...department, id: "support-copy" }] } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { departmentSettings: [department, { ...department, name: "Compras" }] } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { departmentSettings: [{ ...department, intakeQuestions: [""] }] } },
  }).success, false);
  assert.equal(publishInputSchema.safeParse({
    ...valid,
    modules: { tickets: { departmentSettings: [{ ...department, intakeQuestions: ["x".repeat(46)] }] } },
  }).success, false);
});
