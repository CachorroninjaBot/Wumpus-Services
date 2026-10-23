import assert from "node:assert/strict";
import { test } from "node:test";
import { canManageDiscordGuild } from "./permissions.ts";

test("Gerenciar servidor permite administrar a guild", () => {
  assert.equal(canManageDiscordGuild(String(1 << 5)), true);
});

test("Administrador tambem permite administrar a guild", () => {
  assert.equal(canManageDiscordGuild(String(1 << 3)), true);
});

test("sem permissao administrativa a guild nao e gerenciavel", () => {
  assert.equal(canManageDiscordGuild("0"), false);
});

test("permissao invalida nao lanca e nao autoriza", () => {
  assert.equal(canManageDiscordGuild("invalid"), false);
});
