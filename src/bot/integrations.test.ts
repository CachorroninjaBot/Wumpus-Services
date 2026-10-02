/**
 * Testes de assinatura de webhook.
 *
 * O painel oferece "segredo de assinatura" para integracoes. Aceitar um corpo
 * sem assinatura quando o segredo esta configurado anularia o proposito de
 * te-lo — e um webhook sem verificacao e uma porta aberta para o servidor.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifySignature } from "./integrations.ts";

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

test("sem segredo configurado, qualquer corpo passa", () => {
  assert.ok(verifySignature("", "corpo", undefined));
});

test("com segredo, corpo sem assinatura e recusado", () => {
  assert.equal(verifySignature("segredo", "corpo", undefined), false);
});

test("assinatura correta e aceita", () => {
  assert.ok(verifySignature("segredo", "corpo", sign("segredo", "corpo")));
});

test("assinatura com prefixo sha256= e aceita", () => {
  assert.ok(verifySignature("segredo", "corpo", `sha256=${sign("segredo", "corpo")}`));
});

test("assinatura de outro segredo e recusada", () => {
  assert.equal(verifySignature("segredo", "corpo", sign("outro", "corpo")), false);
});

test("corpo alterado invalida a assinatura", () => {
  const signature = sign("segredo", "corpo original");
  assert.equal(verifySignature("segredo", "corpo alterado", signature), false);
});

test("assinatura de tamanho errado nao lanca", () => {
  // timingSafeEqual exige buffers do mesmo tamanho.
  assert.equal(verifySignature("segredo", "corpo", "abc"), false);
});
