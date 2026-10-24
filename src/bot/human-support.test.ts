import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHumanSupportMessages } from "./human-support.ts";

test("prepara o tópico humano com seção, solicitante e conversa", () => {
  const messages = buildHumanSupportMessages({
    requesterId: "12345678901234567",
    serverId: "23456789012345678",
    page: "Atendimento",
    messages: [
      { role: "user", content: "Como abro um ticket?" },
      { role: "assistant", content: "Clique em **Publicar painel**." },
    ],
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Solicitante: <@12345678901234567>/);
  assert.match(messages[0]!, /Servidor selecionado na dashboard: 23456789012345678/);
  assert.match(messages[0]!, /Seção: Atendimento/);
  assert.match(messages[0]!, /Pessoa:\nComo abro um ticket\?/);
  assert.match(messages[0]!, /Ajuda do Wumpus:\nClique em \*\*Publicar painel\*\*\./);
});

test("divide históricos longos dentro do limite das mensagens do Discord", () => {
  const messages = buildHumanSupportMessages({
    requesterId: "12345678901234567",
    serverId: "23456789012345678",
    page: "Tickets",
    messages: [{ role: "user", content: "x".repeat(8000) }],
  });
  assert.ok(messages.length > 1);
  assert.ok(messages.every((message) => message.length <= 1800));
  assert.ok(messages.join("").includes("x".repeat(100)));
});

test("preserva emojis ao dividir o histórico em mensagens", () => {
  const messages = buildHumanSupportMessages({
    requesterId: "12345678901234567",
    serverId: "23456789012345678",
    page: "Tickets",
    messages: [{ role: "user", content: `${"x".repeat(1700)}😀` }],
  });
  assert.ok(messages.every((message) => !message.includes("\uFFFD")));
  assert.ok(messages.join("").includes("😀"));
});
