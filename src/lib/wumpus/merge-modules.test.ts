/**
 * Testes do merge de defaults.
 *
 * O defeito que isto cobre e silencioso: sem o merge, uma chave nova de padrao
 * simplesmente nao existe para quem ja usava a dashboard. Nada quebra, nada
 * aparece no log — a tela so parece nao ter efeito.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleDefaults } from "./defaults.ts";
import { mergeGuildModules, mergeModuleDefaults } from "./merge-modules.ts";
import type { GuildModules } from "./types";

const KEYS = Object.keys(moduleDefaults);

/** Estado parcial, como o que vem de um workspace salvo por uma versao antiga. */
function partial(value: Record<string, unknown>): GuildModules {
  return value as unknown as GuildModules;
}

/* ------------------------------------------------------------- estrutura --- */

test("servidor sem estado salvo ganha todos os modulos com padrao", () => {
  const merged = mergeGuildModules(undefined);
  assert.deepEqual(Object.keys(merged).sort(), [...KEYS].sort());
});

test("modulo desconhecido no estado salvo e descartado", () => {
  const merged = mergeGuildModules(partial({ inventado: { enabled: true, config: {} } }));
  assert.equal((merged as Record<string, unknown>)["inventado"], undefined);
});

/* ------------------------------------------------------------------ valor --- */

test("valor salvo ganha do padrao", () => {
  const merged = mergeGuildModules(partial({ tickets: { enabled: true, config: { panelTitle: "Meu painel" } } }));
  assert.equal(merged.tickets.config.panelTitle, "Meu painel");
});

test("chave de padrao ausente no estado salvo aparece", () => {
  // Este e o caso do `fields`: a chave nasceu depois, o estado salvo nao tinha.
  const merged = mergeGuildModules(partial({ tickets: { enabled: true, config: {} } }));
  assert.equal(merged.tickets.config.panelTitle, moduleDefaults.tickets.panelTitle);
});

test("lista salva e substituida, nao misturada", () => {
  const merged = mergeGuildModules(partial({ forms: { enabled: true, config: { questions: ["so uma"] } } }));
  assert.deepEqual(merged.forms.config.questions, ["so uma"]);
});

/* ---------------------------------------------------------------- ligado --- */

test("modulo desligado continua desligado", () => {
  const merged = mergeGuildModules(partial({ tickets: { enabled: false, config: {} } }));
  assert.equal(merged.tickets.enabled, false);
});

test("modulo ausente no estado salvo nasce ligado", () => {
  const merged = mergeGuildModules(partial({ tickets: { enabled: false, config: {} } }));
  assert.equal(merged.forms.enabled, true);
});

/* -------------------------------------------------------------- servidores --- */

test("estado sem nenhum servidor devolve objeto vazio", () => {
  assert.deepEqual(mergeModuleDefaults(undefined), {});
});

test("merge cobre todos os servidores salvos", () => {
  const merged = mergeModuleDefaults({
    a: partial({ tickets: { enabled: true, config: {} } }),
    b: partial({ tickets: { enabled: true, config: {} } }),
  });
  assert.deepEqual(Object.keys(merged).sort(), ["a", "b"]);
});
