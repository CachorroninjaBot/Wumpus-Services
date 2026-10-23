import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDiscordGuilds } from "./guilds.ts";

test("mantém donos mesmo se Discord não incluir a string de permissões", () => {
  const result = parseDiscordGuilds([
    { id: "12345678901234567", name: "Servidor do dono", owner: true },
  ]);

  assert.deepEqual(result?.guilds, [
    { id: "12345678901234567", name: "Servidor do dono", icon: null, owner: true },
  ]);
  assert.equal(result?.stats.owners, 1);
  assert.equal(result?.stats.missingPermissions, 0);
});

test("inclui servidor administrável por permissão e exclui membro comum", () => {
  const result = parseDiscordGuilds([
    { id: "12345678901234567", name: "Gerenciar servidor", owner: false, permissions: (1n << 5n).toString() },
    { id: "12345678901234568", name: "Membro", owner: false, permissions: "0" },
    { id: "12345678901234569", name: "Sem permissão", owner: false },
  ]);

  assert.deepEqual(result?.guilds.map((guild) => guild.name), ["Gerenciar servidor"]);
  assert.equal(result?.stats.received, 3);
  assert.equal(result?.stats.valid, 3);
  assert.equal(result?.stats.withPermissions, 2);
  assert.equal(result?.stats.manageableByPermissions, 1);
  assert.equal(result?.stats.missingPermissions, 1);
});

test("rejeita formato de lista inválido e ignora linhas sem identidade válida", () => {
  assert.equal(parseDiscordGuilds({}), null);
  const result = parseDiscordGuilds([
    null,
    { id: "inválido", name: "Ignorar", owner: true },
    { id: "12345678901234567", name: "Aceito", owner: true },
  ]);

  assert.equal(result?.stats.received, 3);
  assert.equal(result?.stats.valid, 1);
  assert.equal(result?.guilds.length, 1);
});
