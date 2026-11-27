import assert from "node:assert/strict";
import { test } from "node:test";
import { hasBlockingIssues, ticketPanelPreflight } from "./preflight.ts";

const base = {
  panelChannelId: "123",
  categoryId: "456",
  staffRoleIds: ["789"],
  departmentDisplayMode: "select",
  departmentSettings: [{ id: "support", name: "Suporte", intakeQuestions: ["Como podemos ajudar?"] }],
  namingPattern: "atendimento-{user}",
  slaWarningMinutes: 60,
};

function messages(config: Record<string, unknown>) {
  return ticketPanelPreflight(config).map((issue) => issue.message);
}

test("configuração completa não gera erros", () => {
  const issues = ticketPanelPreflight(base);
  assert.equal(issues.filter((issue) => issue.level === "error").length, 0);
  assert.equal(hasBlockingIssues(issues), false);
});

test("canal ausente bloqueia publicação", () => {
  const issues = ticketPanelPreflight({ ...base, panelChannelId: "" });
  assert.equal(hasBlockingIssues(issues), true);
  assert.ok(messages({ ...base, panelChannelId: "" }).some((message) => message.includes("canal")));
});

test("categoria ausente apenas avisa", () => {
  const issues = ticketPanelPreflight({ ...base, categoryId: "" });
  assert.equal(hasBlockingIssues(issues), false);
  assert.equal(issues.some((issue) => issue.level === "warn"), true);
});

test("sem tipos de atendimento bloqueia", () => {
  const issues = ticketPanelPreflight({ ...base, departmentSettings: [], departments: [] });
  assert.equal(hasBlockingIssues(issues), true);
});

test("types legados em departments ainda são validados", () => {
  const issues = ticketPanelPreflight({ ...base, departmentSettings: [], departments: ["Suporte"] });
  assert.equal(hasBlockingIssues(issues), false);
});

test("nomes repetidos bloqueiam", () => {
  const issues = ticketPanelPreflight({
    ...base,
    departmentSettings: [
      { id: "a", name: "Suporte", intakeQuestions: [] },
      { id: "b", name: " suporte ", intakeQuestions: [] },
    ],
  });
  assert.equal(hasBlockingIssues(issues), true);
});

test("formato de botões acima de 5 tipos bloqueia", () => {
  const departmentSettings = Array.from({ length: 6 }, (_, index) => ({
    id: `type-${index}`,
    name: `Tipo ${index}`,
    intakeQuestions: [],
  }));
  const issues = ticketPanelPreflight({ ...base, departmentDisplayMode: "buttons", departmentSettings });
  assert.equal(hasBlockingIssues(issues), true);
});

test("pergunta acima de 45 caracteres bloqueia", () => {
  const issues = ticketPanelPreflight({
    ...base,
    departmentSettings: [
      {
        id: "support",
        name: "Suporte",
        intakeQuestions: ["Explique com detalhes o que aconteceu e o que você esperava que acontecesse"],
      },
    ],
  });
  assert.equal(hasBlockingIssues(issues), true);
});

test("pergunta vazia bloqueia", () => {
  const issues = ticketPanelPreflight({
    ...base,
    departmentSettings: [{ id: "support", name: "Suporte", intakeQuestions: ["   "] }],
  });
  assert.equal(hasBlockingIssues(issues), true);
});

test("equipe vazia e SLA zero viram aviso, não bloqueio", () => {
  const issues = ticketPanelPreflight({ ...base, staffRoleIds: [], slaWarningMinutes: 0 });
  assert.equal(hasBlockingIssues(issues), false);
  assert.equal(issues.filter((issue) => issue.level === "warn").length >= 2, true);
});
