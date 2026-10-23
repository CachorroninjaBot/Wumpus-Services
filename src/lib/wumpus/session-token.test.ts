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
import {
  signSession,
  verifySession,
  type SessionPayload,
} from "./session-token.ts";

const SECRET = new TextEncoder().encode("segredo-de-teste-com-pelo-menos-trinta-e-dois-bytes");
const OUTRO = new TextEncoder().encode("outro-segredo-de-teste-com-pelo-menos-trinta-e-dois-bytes");

const PAYLOAD: SessionPayload = {
  sessionId: "94f7ff4c-97da-4e6b-b9dd-730645b56289",
  userId: "928871447940710480",
  username: "dono",
  globalName: "Dono",
  avatar: null,
  mfaEnabled: true,
  guilds: [{ id: "123", name: "Meu Servidor", iconUrl: null, owner: true }],
};

/* ------------------------------------------------------------- caminho bom --- */

test("assina a identidade e não inclui os servidores no cookie", async () => {
  const token = await signSession(PAYLOAD, SECRET);
  const back = await verifySession(token, SECRET);

  assert.equal(back?.userId, PAYLOAD.userId);
  assert.equal(back?.username, "dono");
  assert.equal(back?.mfaEnabled, true);
  assert.deepEqual(back?.guilds, []);
  assert.ok(token.length < 4096);
});

test("avatar ausente vira null", async () => {
  const back = await verifySession(await signSession(PAYLOAD, SECRET), SECRET);
  assert.equal(back?.avatar, null);
});

test("sessão preserva MFA desativado como restrição administrativa", async () => {
  const back = await verifySession(await signSession({ ...PAYLOAD, mfaEnabled: false }, SECRET), SECRET);
  assert.equal(back?.mfaEnabled, false);
});

test("cookie permanece pequeno mesmo para usuários com muitos servidores", async () => {
  const guilds = Array.from({ length: 200 }, (_, index) => ({
    id: String(10000000000000000n + BigInt(index)),
    name: `Comunidade ${index} ${"nome-longo-".repeat(7)}`,
    iconUrl: `https://cdn.discordapp.com/icons/10000000000000000/${"a".repeat(32)}.gif?size=128`,
    owner: true,
  }));
  const token = await signSession({ ...PAYLOAD, guilds }, SECRET);

  assert.ok(token.length < 4096);
  assert.deepEqual((await verifySession(token, SECRET))?.guilds, []);
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
    userId: PAYLOAD.userId,
    guilds: ["lixo", { name: "sem id" }, { id: "9", name: "ok", owner: false }],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(PAYLOAD.sessionId)
    .sign(SECRET);

  const back = await verifySession(token, SECRET);
  assert.equal(back?.guilds.length, 1);
  assert.equal(back?.guilds[0]!.id, "9");
  assert.equal(back?.guilds[0]!.owner, false);
});

test("guilds que nao e lista vira lista vazia", async () => {
  const token = await new SignJWT({ userId: PAYLOAD.userId, guilds: "nada" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(PAYLOAD.sessionId)
    .sign(SECRET);

  assert.deepEqual((await verifySession(token, SECRET))?.guilds, []);
});
