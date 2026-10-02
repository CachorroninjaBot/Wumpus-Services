/**
 * Testes do resolvedor de referencias.
 *
 * `resolve.ts` existe porque o painel guarda NOME de canal/cargo ("ch_logs") e
 * o cache do Discord indexa por snowflake. Sem esta traducao, todo campo de
 * canal e cargo fica silenciosamente inutil — foi o defeito central do bot
 * antigo. As funcoes puras aqui sao a base dessa traducao.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isSnowflake, normalize } from "./resolve.ts";

test("isSnowflake aceita id real do Discord", () => {
  assert.ok(isSnowflake("1187601667559002225"));
});

test("isSnowflake recusa nome de canal ou cargo", () => {
  assert.equal(isSnowflake("ch_logs"), false);
  assert.equal(isSnowflake("role_staff"), false);
  assert.equal(isSnowflake(""), false);
  assert.equal(isSnowflake("123"), false);
});

test("isSnowflake ignora espacos nas pontas", () => {
  assert.ok(isSnowflake("  1187601667559002225  "));
});

test("normalize remove # e @ e baixa a caixa", () => {
  assert.equal(normalize("#Logs-Gerais"), "logs-gerais");
  assert.equal(normalize("@Staff"), "staff");
  assert.equal(normalize("  atendimento  "), "atendimento");
});

test("normalize nao quebra com acento", () => {
  assert.equal(normalize("#denúncias"), "denúncias");
});
