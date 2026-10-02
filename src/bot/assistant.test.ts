/**
 * Testes do assistente.
 *
 * O ponto sensivel aqui e o parsing: modelo de linguagem responde em formato
 * irregular com frequencia. Se o parser estourar ou aceitar lixo, o assistente
 * vira uma tela de erro no meio de um atendimento.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLogDigest, buildMemberDigest, clampRisk, formatAnalysis, normalizeSeverity, parseAnalysis } from "./assistant.ts";

/* ------------------------------------------------------------- parsing --- */

test("resposta ausente vira resultado indisponivel", () => {
  const result = parseAnalysis(null);
  assert.equal(result.source, "unavailable");
  assert.deepEqual(result.findings, []);
  assert.equal(result.risk, 0);
});

test("texto que nao e JSON vira indisponivel, sem lancar", () => {
  const result = parseAnalysis("desculpe, nao consegui analisar");
  assert.equal(result.source, "unavailable");
});

test("JSON cercado de texto ainda e lido", () => {
  const raw = 'Claro! Aqui esta:\n```json\n{"summary":"tudo normal","risk":10,"findings":[]}\n```';
  const result = parseAnalysis(raw);
  assert.equal(result.source, "ai");
  assert.equal(result.summary, "tudo normal");
  assert.equal(result.risk, 10);
});

test("le findings completos", () => {
  const raw = JSON.stringify({
    summary: "rajada de punicoes",
    risk: 80,
    findings: [
      { title: "Ban em massa", detail: "12 bans em 2 min", severity: "urgent", suggestion: "conferir o autor" },
    ],
  });
  const result = parseAnalysis(raw);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]!.severity, "urgent");
  assert.equal(result.findings[0]!.title, "Ban em massa");
});

test("findings sem titulo recebem rotulo padrao", () => {
  const result = parseAnalysis(JSON.stringify({ summary: "x", risk: 5, findings: [{ detail: "algo" }] }));
  assert.equal(result.findings[0]!.title, "Observacao");
});

test("findings que nao sao objeto sao descartados", () => {
  const result = parseAnalysis(JSON.stringify({ summary: "x", risk: 5, findings: ["texto solto", 42, null] }));
  assert.deepEqual(result.findings, []);
});

test("limita a 5 o numero de findings", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ title: `f${i}`, detail: "d", severity: "info" }));
  const result = parseAnalysis(JSON.stringify({ summary: "x", risk: 50, findings: many }));
  assert.equal(result.findings.length, 5);
});

/* ---------------------------------------------------------------- risco --- */

test("risco fora da faixa e preso em 0..100", () => {
  assert.equal(clampRisk(-40), 0);
  assert.equal(clampRisk(999), 100);
});

test("risco invalido vira zero", () => {
  assert.equal(clampRisk("muito alto"), 0);
  assert.equal(clampRisk(undefined), 0);
  assert.equal(clampRisk(null), 0);
});

test("risco fracionario e arredondado", () => {
  assert.equal(clampRisk(72.6), 73);
});

/* ------------------------------------------------------------ gravidade --- */

test("variacoes de gravidade urgente sao reconhecidas", () => {
  for (const value of ["urgent", "URGENTE", "critico", "crítico", "critical", "high", "grave"]) {
    assert.equal(normalizeSeverity(value), "urgent", `falhou em ${value}`);
  }
});

test("variacoes de atencao sao reconhecidas", () => {
  for (const value of ["attention", "atenção", "warn", "warning", "medium"]) {
    assert.equal(normalizeSeverity(value), "attention", `falhou em ${value}`);
  }
});

test("gravidade desconhecida cai em info", () => {
  assert.equal(normalizeSeverity("qualquer coisa"), "info");
  assert.equal(normalizeSeverity(undefined), "info");
});

/* -------------------------------------------------------------- digest --- */

test("sem eventos, o digest diz que nao ha nada", () => {
  assert.match(buildLogDigest([]), /Nenhum evento/);
});

test("digest respeita o limite de linhas", () => {
  const events = Array.from({ length: 200 }, (_, i) => ({
    at: Date.now(),
    actor: "a",
    category: "automod",
    summary: `evento ${i}`,
  }));
  const lines = buildLogDigest(events, 10).split("\n");
  assert.equal(lines.length, 10);
});

test("digest corta resumo longo em vez de estourar o prompt", () => {
  const digest = buildLogDigest([
    { at: Date.now(), actor: "a", category: "logs", summary: "x".repeat(5000) },
  ]);
  assert.ok(digest.length < 300, `digest ficou com ${digest.length} caracteres`);
});

test("digest sobrevive a data invalida", () => {
  const digest = buildLogDigest([{ at: Number.NaN, actor: "a", category: "logs", summary: "algo" }]);
  assert.match(digest, /\?/);
});

/* ------------------------------------------------------------- membro --- */

test("digest de membro traz os campos que importam", () => {
  const digest = buildMemberDigest({
    username: "novato",
    accountAgeDays: 1,
    joinedDaysAgo: 0,
    messages: 300,
    strikes: 3,
    timedOut: true,
    tickets: 0,
  });
  assert.match(digest, /novato/);
  assert.match(digest, /idade da conta: 1/);
  assert.match(digest, /advertencias acumuladas: 3/);
  assert.match(digest, /em castigo agora: sim/);
});

/* ---------------------------------------------------------- formatacao --- */

test("analise indisponivel nao finge resultado", () => {
  const text = formatAnalysis(parseAnalysis(null), "Logs");
  assert.match(text, /nao conseguiu analisar/);
});

test("formatacao mostra risco e sugestao", () => {
  const analysis = parseAnalysis(
    JSON.stringify({
      summary: "padrao suspeito",
      risk: 88,
      findings: [{ title: "Rajada", detail: "10 bans", severity: "urgent", suggestion: "revisar cargo" }],
    })
  );
  const text = formatAnalysis(analysis, "Logs");
  assert.match(text, /88\/100/);
  assert.match(text, /Rajada/);
  assert.match(text, /revisar cargo/);
});

test("sem findings, a formatacao diz que esta normal", () => {
  const analysis = parseAnalysis(JSON.stringify({ summary: "tudo ok", risk: 3, findings: [] }));
  assert.match(formatAnalysis(analysis, "Logs"), /Nada fora do normal/);
});

test("formatacao respeita o teto de caracteres do Discord", () => {
  const many = Array.from({ length: 5 }, (_, i) => ({
    title: "t".repeat(120),
    detail: "d".repeat(600),
    severity: "urgent",
    suggestion: "s".repeat(400),
  }));
  const text = formatAnalysis(parseAnalysis(JSON.stringify({ summary: "x", risk: 90, findings: many })), "Logs");
  assert.ok(text.length <= 1900, `texto ficou com ${text.length} caracteres`);
});
