import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readBotCollection, writeBotCollection, type SupportChatRecord } from "../lib/wumpus/runtime.server.ts";
import {
  addSupportStaffMessage,
  buildHumanSupportMessages,
  claimSupportChat,
  closeSupportChat,
  findSupportChatByThread,
  setSupportChatThread,
} from "./human-support.ts";

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

test("atendimento humano sincroniza mensagens do tópico e mantém reivindicação e encerramento", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wumpus-human-support-"));
  const previousDataDir = process.env.WUMPUS_DATA_DIR;
  process.env.WUMPUS_DATA_DIR = directory;
  try {
    const chat: SupportChatRecord = {
      id: "support-test",
      guildId: "guild-test",
      requesterId: "requester-test",
      page: "Atendimento",
      status: "queued",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await writeBotCollection("support-chats", [chat]);

    await setSupportChatThread(chat.id, "forum-guild-test", "thread-test");
    assert.equal((await findSupportChatByThread("thread-test"))?.status, "open");
    assert.equal(await claimSupportChat(chat.id, "staff-one", "staff_one"), "claimed");
    assert.equal(await claimSupportChat(chat.id, "staff-two", "staff_two"), "already_claimed");
    assert.deepEqual(await Promise.all([
      addSupportStaffMessage("thread-test", "staff-one", "Já estou verificando."),
      addSupportStaffMessage("thread-test", "staff-two", "Também estou acompanhando."),
    ]), [true, true]);

    const updated = await closeSupportChat(chat.id, "staff-one");
    assert.equal(updated?.status, "closed");
    assert.equal(await addSupportStaffMessage("thread-test", "staff-one", "Mensagem após fechar"), false);
    assert.equal(updated?.messages.at(-1)?.role, "staff");
    assert.equal(updated?.messages.filter((message) => message.role === "staff").length, 2);
    assert.equal(updated?.messages.find((message) => message.role === "system")?.content, "staff_one está atendendo você agora.");
    assert.match(updated?.messages.find((message) => message.role === "assistant")?.content ?? "", /Em breve/);

    const persisted = await readBotCollection<SupportChatRecord>("support-chats");
    assert.equal(persisted[0]?.claimedBy, "staff-one");
    assert.equal(persisted[0]?.status, "closed");
  } finally {
    if (previousDataDir === undefined) delete process.env.WUMPUS_DATA_DIR;
    else process.env.WUMPUS_DATA_DIR = previousDataDir;
    await rm(directory, { recursive: true, force: true });
  }
});
