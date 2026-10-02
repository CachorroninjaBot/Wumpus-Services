/**
 * Testes do filtro de automod.
 *
 * `scanMessage` e pura de proposito: as regras do painel (convite, termo,
 * dominio, link, caps, mencao, tamanho, repeticao, flood) podem ser verificadas
 * sem Discord nenhum. Eram todas decorativas no bot antigo — o filtro so olhava
 * convite e termo, e apenas quando o modulo estava publicado (nunca estava).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { scanMessage } from "./automod.ts";

/** Contexto neutro: sem flood nem repeticao, a menos que o teste diga o contrario. */
const base = { windowMs: 10_000, floodCount: 0, duplicateCount: 0 };

test("detecta convite do Discord", () => {
  const hit = scanMessage({
    ...base,
    content: "entra no meu servidor discord.gg/abc123",
    config: { blockInvites: true, action: "delete" },
  });
  assert.equal(hit?.rule, "convite");
});

test("detecta termo bloqueado sem diferenciar caixa", () => {
  const hit = scanMessage({
    ...base,
    content: "isso e um GOLPE, nao clique",
    config: { blockedTerms: ["golpe"] },
  });
  assert.equal(hit?.rule, "termo:golpe");
});

test("bloqueia link fora da allowlist quando blockLinks esta ligado", () => {
  const hit = scanMessage({
    ...base,
    content: "olha isso https://site-estranho.com/oferta",
    config: { blockLinks: true, allowedDomains: ["aurora.store"] },
  });
  assert.equal(hit?.rule, "link:site-estranho.com");
});

test("permite link da allowlist", () => {
  const hit = scanMessage({
    ...base,
    content: "promo em https://aurora.store/promo",
    config: { blockLinks: true, allowedDomains: ["aurora.store"] },
  });
  assert.equal(hit, null);
});

test("allowlist cobre subdominio", () => {
  const hit = scanMessage({
    ...base,
    content: "https://loja.aurora.store/promo",
    config: { blockLinks: true, allowedDomains: ["aurora.store"] },
  });
  assert.equal(hit, null);
});

test("dominio bloqueado vence a permissao de links", () => {
  const hit = scanMessage({
    ...base,
    content: "https://golpes.com/x",
    config: { blockLinks: false, blockedDomains: ["golpes.com"] },
  });
  assert.equal(hit?.rule, "dominio:golpes.com");
});

test("detecta excesso de caixa alta", () => {
  const hit = scanMessage({
    ...base,
    content: "COMPRA AGORA MUITO BARATO MESMO",
    config: { capsThresholdPercent: 70 },
  });
  assert.equal(hit?.rule, "caps");
});

test("detecta mencao em massa", () => {
  const hit = scanMessage({
    ...base,
    content: "<@1> <@2> <@3> venham aqui",
    config: { mentionLimit: 3 },
  });
  assert.equal(hit?.rule, "mencao-em-massa");
});

test("detecta flood pela janela", () => {
  const hit = scanMessage({
    ...base,
    content: "oi",
    floodCount: 8,
    config: { messageLimit: 6, windowSeconds: 10 },
  });
  assert.equal(hit?.rule, "flood");
});

test("detecta repeticao", () => {
  const hit = scanMessage({
    ...base,
    content: "compra compra compra",
    duplicateCount: 3,
    config: { duplicateLimit: 3 },
  });
  assert.equal(hit?.rule, "repeticao");
});

test("detecta mensagem longa demais quando ha limite", () => {
  const hit = scanMessage({
    ...base,
    content: "x".repeat(50),
    config: { maxLength: 20 },
  });
  assert.equal(hit?.rule, "muito-longo");
});

test("mensagem normal passa", () => {
  const hit = scanMessage({
    ...base,
    content: "bom dia pessoal, tudo certo por aqui?",
    config: { blockInvites: true, blockedTerms: ["golpe"] },
  });
  assert.equal(hit, null);
});

test("texto curto nao e acusado de caps", () => {
  // Menos de 10 letras nao tem amostra suficiente para julgar caixa.
  const hit = scanMessage({ ...base, content: "OK", config: { capsThresholdPercent: 70 } });
  assert.equal(hit, null);
});
