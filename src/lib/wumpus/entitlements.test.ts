/**
 * Testes dos direitos de acesso.
 *
 * Este e o codigo que decide quem ve o que — antes dele o painel mostrava todos
 * os planos e todos os servidores para qualquer pessoa, e marcava todo login
 * como admin. Cada caso aqui corresponde a um defeito que existia.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { OWNER_DISCORD_ID, isPlatformOwner } from "./owner.ts";
import { canAddServer, planForUser, resolveEntitlements, type SubscriptionLite } from "./entitlements.ts";

const ME = { id: "111", username: "cliente" };
const OTHER = { id: "222", username: "outro" };

function sub(over: Partial<SubscriptionLite> = {}): SubscriptionLite {
  return {
    status: "active",
    planId: "pro",
    discordUsername: "cliente",
    ...over,
  };
}

/** Atalho: entrada em que a pessoa e dona de tudo e o bot esta em tudo. */
function input(over: Partial<Parameters<typeof resolveEntitlements>[0]> = {}) {
  return {
    discordUserId: ME.id,
    discordUsername: ME.username,
    ownedGuildIds: ["a"],
    botGuildIds: ["a"],
    subscriptions: [sub()],
    ...over,
  };
}

/* ---------------------------------------------------------------- owner --- */

test("o dono e reconhecido pelo id", () => {
  assert.ok(isPlatformOwner(OWNER_DISCORD_ID));
});

test("qualquer outro id nao e dono", () => {
  assert.equal(isPlatformOwner("111"), false);
  assert.equal(isPlatformOwner(""), false);
  assert.equal(isPlatformOwner(null), false);
  assert.equal(isPlatformOwner(undefined), false);
});

/* ----------------------------------------------------------- assinatura --- */

test("sem assinatura ativa nao ha plano", () => {
  assert.equal(planForUser([], ME.id, ME.username), null);
});

test("assinatura cancelada nao da plano", () => {
  assert.equal(planForUser([sub({ status: "canceled" })], ME.id, ME.username), null);
});

test("pagamento em atraso nao mantem acesso", () => {
  assert.equal(planForUser([sub({ status: "past_due" })], ME.id, ME.username), null);
});

test("assinatura de outra pessoa nao vale", () => {
  assert.equal(planForUser([sub({ discordUsername: OTHER.username })], ME.id, ME.username), null);
});

test("casa pelo id quando a ShardPay manda o id", () => {
  const found = planForUser([sub({ discordUsername: null, discordUserId: ME.id })], ME.id, ME.username);
  assert.equal(found?.plan, "pro");
});

test("nome de usuario nao diferencia caixa nem arroba", () => {
  const found = planForUser([sub({ discordUsername: "@CLIENTE" })], ME.id, ME.username);
  assert.equal(found?.plan, "pro");
});

test("entre varios planos ativos, vale o maior", () => {
  const found = planForUser(
    [sub({ planId: "essencial" }), sub({ planId: "escala" }), sub({ planId: "pro" })],
    ME.id,
    ME.username
  );
  assert.equal(found?.plan, "escala");
});

/* ------------------------------------------------------------ servidores --- */

test("servidor sem o bot nao entra, mesmo sendo o dono", () => {
  const result = resolveEntitlements(input({ ownedGuildIds: ["a", "b"], botGuildIds: ["a"] }));
  assert.deepEqual(result.guildIds, ["a"]);
});

test("servidor com o bot onde a pessoa NAO e dona nao entra", () => {
  // Este e o caso do staff: tem o bot, mas nao responde pelo servidor.
  const result = resolveEntitlements(input({ ownedGuildIds: [], botGuildIds: ["a", "b"] }));
  assert.deepEqual(result.guildIds, []);
});

test("administrador sem ser dono fica de fora", () => {
  // `ownedGuildIds` vem do OAuth so com `owner: true`. Quem e so admin nunca
  // aparece nessa lista — o painel e de quem contratou, nao de quem tem cargo.
  const result = resolveEntitlements(input({ ownedGuildIds: [], botGuildIds: ["a"] }));
  assert.deepEqual(result.guildIds, []);
  assert.equal(result.plan, "pro", "a assinatura continua valendo; so nao ha servidor dela");
});

test("sem assinatura, nenhum servidor e liberado", () => {
  const result = resolveEntitlements(input({ ownedGuildIds: ["a", "b"], botGuildIds: ["a", "b"], subscriptions: [] }));
  assert.deepEqual(result.guildIds, []);
  assert.equal(result.reason, "no-subscription");
  assert.equal(result.plan, null);
});

/* --------------------------------------------------------------- limites --- */

test("essencial libera no maximo 2 servidores", () => {
  const result = resolveEntitlements(
    input({
      ownedGuildIds: ["a", "b", "c", "d"],
      botGuildIds: ["a", "b", "c", "d"],
      subscriptions: [sub({ planId: "essencial" })],
    })
  );
  assert.equal(result.guildIds.length, 2);
  assert.equal(result.limit, 2);
});

test("o excedente e informado, nao escondido", () => {
  const result = resolveEntitlements(
    input({
      ownedGuildIds: ["a", "b", "c"],
      botGuildIds: ["a", "b", "c"],
      subscriptions: [sub({ planId: "essencial" })],
    })
  );
  assert.deepEqual(result.guildIds, ["a", "b"]);
  assert.deepEqual(result.overLimitGuildIds, ["c"]);
});

test("escala nao tem teto de servidores", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const result = resolveEntitlements(
    input({ ownedGuildIds: ids, botGuildIds: ids, subscriptions: [sub({ planId: "escala" })] })
  );
  assert.equal(result.guildIds.length, 6);
  assert.equal(result.limit, null);
  assert.deepEqual(result.overLimitGuildIds, []);
});

/* ------------------------------------------------------------------ dono --- */

test("o dono passa por cima do limite", () => {
  const ids = Array.from({ length: 30 }, (_, i) => `g${i}`);
  const result = resolveEntitlements(
    input({
      discordUserId: OWNER_DISCORD_ID,
      discordUsername: "dono",
      ownedGuildIds: ids,
      botGuildIds: ids,
      subscriptions: [],
    })
  );
  assert.equal(result.isOwner, true);
  assert.equal(result.reason, "owner");
  assert.equal(result.guildIds.length, 30);
  assert.equal(result.limit, null);
});

test("o dono tambem so ve servidor onde o bot esta", () => {
  const result = resolveEntitlements(
    input({
      discordUserId: OWNER_DISCORD_ID,
      discordUsername: "dono",
      ownedGuildIds: ["a", "b"],
      botGuildIds: ["a"],
      subscriptions: [],
    })
  );
  assert.deepEqual(result.guildIds, ["a"]);
});

/* ------------------------------------------------------------ addServer --- */

test("quem nao tem plano nao adiciona servidor", () => {
  const result = resolveEntitlements(input({ ownedGuildIds: [], botGuildIds: [], subscriptions: [] }));
  assert.equal(canAddServer(result, 0), false);
});

test("limite do plano barra o servidor a mais", () => {
  const result = resolveEntitlements(
    input({
      ownedGuildIds: ["a", "b"],
      botGuildIds: ["a", "b"],
      subscriptions: [sub({ planId: "essencial" })],
    })
  );
  assert.equal(canAddServer(result, 2), false);
  assert.equal(canAddServer(result, 1), true);
});

test("o dono sempre pode adicionar", () => {
  const result = resolveEntitlements(
    input({ discordUserId: OWNER_DISCORD_ID, discordUsername: "dono", subscriptions: [] })
  );
  assert.equal(canAddServer(result, 999), true);
});
