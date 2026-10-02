/**
 * Testes do token de sessao.
 *
 * Isto e a fronteira de confianca: se a verificacao aceitar um token
 * adulterado, qualquer pessoa volta a poder se declarar o dono — que e
 * exatamente o defeito que estamos corrigindo.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { signSession, verifySession, type SessionPayload } from "./session-token.ts";

const SECRET = new TextEncoder().encode("segredo-de-teste");
const OUTRO = new TextEncoder().encode("segredo-diferente");

const PAYLOAD: SessionPayload = {
  userId: "928871447940710480",
  username: "dono",
  globalName: "Dono",
  avatar: null,
  mfaEnabled: true,
  guilds: [{ id: "123", name: "Meu Servidor", iconUrl: null, owner: true }],
};

/* ------------------------------------------------------------- caminho bom --- */

test("assina e verifica de volta", async () => {
  const token = await signSession(PAYLOAD, SECRET);
  const back = await verifySession(token, SECRET);

  assert.equal(back?.userId, PAYLOAD.userId);
  assert.equal(back?.username, "dono");
  assert.equal(back?.mfaEnabled, true);
  assert.equal(back?.guilds.length, 1);
  assert.equal(back?.guilds[0]!.owner, true);
});

test("avatar ausente vira null", async () => {
  const back = await verifySession(await signSession(PAYLOAD, SECRET), SECRET);
  assert.equal(back?.avatar, null);
});

test("sessão preserva MFA desativado como restrição administrativa", async () => {
  const back = await verifySession(await signSession({ ...PAYLOAD, mfaEnabled: false }, SECRET), SECRET);
  assert.equal(back?.mfaEnabled, false);
});

/* --------------------------------------------------------------- ataques --- */

test("token assinado com outro segredo e recusado", async () => {
  const token = await signSession(PAYLOAD, OUTRO);
  assert.equal(await verifySession(token, SECRET), null);
});

test("payload adulterado e recusado", async () => {
  const token = await signSession(PAYLOAD, SECRET);
  const [header, , signature] = token.split(".");

  // A troca que interessa: alguem se declarando o dono da plataforma.
  const forged = Buffer.from(JSON.stringify({ userId: "928871447940710480", guilds: [] })).toString("base64url");

  assert.equal(await verifySession(`${header}.${forged}.${signature}`, SECRET), null);
});

test("assinatura removida e recusada", async () => {
  const token = await signSession(PAYLOAD, SECRET);
  const [header, body] = token.split(".");
  assert.equal(await verifySession(`${header}.${body}.`, SECRET), null);
});

test("token expirado e recusado", async () => {
  const token = await new SignJWT({ ...PAYLOAD })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(SECRET);

  assert.equal(await verifySession(token, SECRET), null);
});

test("alg 'none' e recusado", async () => {
  // Monta um token sem assinatura, declarando alg none.
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ userId: "928871447940710480" })).toString("base64url");

  assert.equal(await verifySession(`${header}.${body}.`, SECRET), null);
});

/* ----------------------------------------------------------- formato ruim --- */

test("texto que nao e token nao lanca", async () => {
  assert.equal(await verifySession("nao-e-um-token", SECRET), null);
  assert.equal(await verifySession("", SECRET), null);
  assert.equal(await verifySession("a.b.c", SECRET), null);
});

test("payload sem userId e recusado", async () => {
  const token = await new SignJWT({ guilds: [] }).setProtectedHeader({ alg: "HS256" }).sign(SECRET);
  assert.equal(await verifySession(token, SECRET), null);
});

test("servidor sem id e descartado", async () => {
  const token = await new SignJWT({
    userId: "1",
    guilds: ["lixo", { name: "sem id" }, { id: "9", name: "ok", owner: false }],
  })
    .setProtectedHeader({ alg: "HS256" })
    .sign(SECRET);

  const back = await verifySession(token, SECRET);
  assert.equal(back?.guilds.length, 1);
  assert.equal(back?.guilds[0]!.id, "9");
  assert.equal(back?.guilds[0]!.owner, false);
});

test("guilds que nao e lista vira lista vazia", async () => {
  const token = await new SignJWT({ userId: "1", guilds: "nada" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(SECRET);

  assert.deepEqual((await verifySession(token, SECRET))?.guilds, []);
});
