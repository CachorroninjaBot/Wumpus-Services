import { ChannelType, type ForumChannel, type Guild, type ThreadChannel } from "discord.js";
import { readBotCollection, updateBotCollection, type OutboxJob, type SupportChatRecord } from "../lib/wumpus/runtime.server.ts";
import type { Logger } from "./logger.ts";
import { id } from "./ids.ts";

const DISCORD_MESSAGE_LIMIT = 1800;
const MAX_HISTORY_LENGTH = 8_000;

async function updateSupportChat(
  chatId: string,
  update: (chat: SupportChatRecord) => SupportChatRecord,
): Promise<SupportChatRecord | null> {
  let updated: SupportChatRecord | null = null;
  await updateBotCollection<SupportChatRecord>("support-chats", (chats) => chats.map((chat) => {
    if (chat.id !== chatId) return chat;
    updated = update(chat);
    return updated;
  }));
  return updated;
}

export async function findSupportChatByThread(threadId: string): Promise<SupportChatRecord | null> {
  return (await readBotCollection<SupportChatRecord>("support-chats")).find((chat) => chat.threadId === threadId) ?? null;
}

export async function addSupportStaffMessage(threadId: string, authorId: string, content: string): Promise<boolean> {
  const chat = await findSupportChatByThread(threadId);
  if (!chat || chat.status !== "open" || !content.trim()) return false;
  let added = false;
  await updateSupportChat(chat.id, (current) => {
    if (current.status !== "open") return current;
    added = true;
    return {
      ...current,
      messages: [...current.messages, {
        id: `staff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        role: "staff" as const,
        authorId,
        content: content.trim().slice(0, 4000),
        at: Date.now(),
      }].slice(-100),
      updatedAt: Date.now(),
    };
  });
  return added;
}

export async function claimSupportChat(chatId: string, staffId: string): Promise<"claimed" | "already_claimed" | "closed" | "missing"> {
  let result: "claimed" | "already_claimed" | "closed" | "missing" = "missing";
  const chat = await updateSupportChat(chatId, (current) => {
    if (current.status !== "open") { result = "closed"; return current; }
    if (current.claimedBy) { result = current.claimedBy === staffId ? "claimed" : "already_claimed"; return current; }
    result = "claimed";
    return { ...current, claimedBy: staffId, updatedAt: Date.now() };
  });
  return chat ? result : "missing";
}

export async function closeSupportChat(chatId: string, staffId: string): Promise<SupportChatRecord | null> {
  return updateSupportChat(chatId, (chat) => chat.status === "open"
    ? { ...chat, status: "closed", updatedAt: Date.now(), claimedBy: chat.claimedBy ?? staffId }
    : chat);
}

export async function setSupportChatThread(chatId: string, forumGuildId: string, threadId: string): Promise<void> {
  await updateSupportChat(chatId, (chat) => ({
    ...chat,
    forumGuildId,
    threadId,
    status: "open",
    messages: [...chat.messages, {
      id: `system_${Date.now().toString(36)}`,
      role: "assistant",
      content: "Em breve uma pessoa da equipe entrará em contato por aqui. Você pode continuar conversando neste chat do site.",
      at: Date.now(),
    }],
    updatedAt: Date.now(),
  }));
}

export async function failSupportChat(chatId: string): Promise<void> {
  await updateSupportChat(chatId, (chat) => ({ ...chat, status: "failed", updatedAt: Date.now() }));
}

export async function setSupportMessageDelivery(chatId: string, messageId: string, delivery: "sent" | "failed"): Promise<void> {
  await updateSupportChat(chatId, (chat) => ({
    ...chat,
    messages: chat.messages.map((message) => message.id === messageId ? { ...message, delivery } : message),
    updatedAt: Date.now(),
  }));
}

export async function saveSupportChatRating(chatId: string, rating: number): Promise<SupportChatRecord | null> {
  return updateSupportChat(chatId, (chat) => chat.status === "closed" && !chat.rating && rating >= 1 && rating <= 5
    ? { ...chat, rating, ratedAt: Date.now(), updatedAt: Date.now() }
    : chat);
}

export function buildHumanSupportMessages(input: {
  requesterId: string;
  serverId: string;
  page: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): string[] {
  const header = [
    "Pedido de atendimento humano pela ajuda do Wumpus",
    `Solicitante: <@${input.requesterId}>`,
    `Servidor selecionado na dashboard: ${input.serverId}`,
    `Seção: ${input.page.slice(0, 100)}`,
    "",
    "Histórico da conversa com a IA:",
    "",
  ].join("\n");
  const fullHistory = input.messages
    .map((message) => `${message.role === "user" ? "Pessoa" : "Ajuda do Wumpus"}:\n${message.content.trim()}`)
    .join("\n\n");
  const history = fullHistory.length > MAX_HISTORY_LENGTH
    ? `${fullHistory.slice(0, MAX_HISTORY_LENGTH)}\n\n[Histórico limitado para caber no tópico.]`
    : fullHistory;
  const full = `${header}${history}`;
  const chunks: string[] = [];
  let chunk = "";
  for (const character of full) {
    if (chunk.length + character.length > DISCORD_MESSAGE_LIMIT) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [header];
}

function forumIdFromEnvironment(): string | null {
  const id = process.env.WUMPUS_SUPPORT_FORUM_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

export async function createHumanSupportThread(
  guild: Guild,
  job: OutboxJob,
  log: Logger,
): Promise<{ ok: boolean; detail: string; channelId?: string }> {
  if (!job.actorId || !job.supportPage || !job.supportMessages?.length) {
    return { ok: false, detail: "O pedido de atendimento humano está incompleto." };
  }

  const forumId = forumIdFromEnvironment();
  if (!forumId) {
    return { ok: false, detail: "Configure WUMPUS_SUPPORT_FORUM_ID com o ID do canal fórum no ambiente do serviço." };
  }

  let channel;
  try {
    channel = await guild.client.channels.fetch(forumId);
  } catch (error) {
    log.warn("canal fórum de atendimento humano inacessível", {
      guildId: guild.id,
      forumId,
      error: String(error).slice(0, 200),
    });
    return { ok: false, detail: "Não foi possível acessar o fórum configurado. Confira o ID e as permissões do bot." };
  }
  if (!channel || channel.type !== ChannelType.GuildForum) {
    return { ok: false, detail: "WUMPUS_SUPPORT_FORUM_ID precisa apontar para um canal fórum acessível pelo bot." };
  }

  const username = await guild.client.users.fetch(job.actorId)
    .then((user) => user.globalName || user.username)
    .catch(() => `usuário ${job.actorId}`);
  let safeUsername = "";
  for (const character of username.replace(/[\r\n]/g, " ")) {
    if (safeUsername.length + character.length > 84) break;
    safeUsername += character;
  }
  const threadName = `Ajuda - ${safeUsername}`.trim();
  const messages = buildHumanSupportMessages({
    requesterId: job.actorId,
    serverId: job.guildId,
    page: job.supportPage,
    messages: job.supportMessages,
  });

  try {
    const thread = await (channel as ForumChannel).threads.create({
      name: threadName,
      message: {
        content: messages[0]!,
        allowedMentions: { parse: [] },
        components: [{
          type: 1,
          components: [
            { type: 2, style: 3, label: "Reivindicar atendimento", custom_id: id("support", "claim", job.id) },
            { type: 2, style: 4, label: "Fechar atendimento", custom_id: id("support", "close", job.id) },
          ],
        }],
      },
      reason: "Solicitação de atendimento humano pela ajuda do Wumpus",
    });
    let historyComplete = true;
    for (const content of messages.slice(1)) {
      try {
        await thread.send({ content, allowedMentions: { parse: [] } });
      } catch (error) {
        historyComplete = false;
        log.warn("histórico parcial no tópico de atendimento humano", {
          guildId: guild.id,
          threadId: thread.id,
          error: String(error).slice(0, 200),
        });
        break;
      }
    }
    await setSupportChatThread(job.id, thread.guildId, thread.id);
    log.info("tópico de atendimento humano criado", {
      guildId: guild.id,
      threadId: thread.id,
      requesterId: job.actorId,
      historyComplete,
    });
    return {
      ok: true,
      detail: historyComplete
        ? "Atendimento humano criado no fórum."
        : "Tópico criado, mas parte do histórico não pôde ser enviada.",
      channelId: thread.id,
    };
  } catch (error) {
    log.warn("falha ao criar tópico de atendimento humano", {
      guildId: guild.id,
      forumId,
      requesterId: job.actorId,
      error: String(error).slice(0, 200),
    });
    return { ok: false, detail: "O Discord não conseguiu criar o tópico. Confira as permissões do bot no fórum." };
  }
}

export async function sendSupportChatMessage(guild: Guild, chatId: string, messageId: string, content: string): Promise<{ ok: boolean; detail: string }> {
  const chat = (await readBotCollection<SupportChatRecord>("support-chats")).find((entry) =>
    entry.id === chatId && entry.guildId === guild.id);
  if (!chat?.threadId || chat.status !== "open") return { ok: false, detail: "Este atendimento não está aberto." };
  const thread = await guild.client.channels.fetch(chat.threadId).catch(() => null) as ThreadChannel | null;
  if (!thread?.isThread()) return { ok: false, detail: "O tópico do atendimento não está disponível no Discord." };
  try {
    await thread.send({ content: `**${(await guild.client.users.fetch(chat.requesterId).catch(() => null))?.username ?? "Usuário"} · pelo site**\n${content.slice(0, 1800)}`, allowedMentions: { parse: [] } });
    await setSupportMessageDelivery(chat.id, messageId, "sent");
    return { ok: true, detail: "Mensagem enviada ao tópico." };
  } catch {
    await setSupportMessageDelivery(chat.id, messageId, "failed");
    return { ok: false, detail: "Não foi possível enviar sua mensagem ao Discord." };
  }
}

export async function postSupportRating(guild: Guild, chatId: string, rating: number): Promise<{ ok: boolean; detail: string }> {
  const channelId = process.env.WUMPUS_SUPPORT_RATINGS_CHANNEL_ID?.trim();
  if (!channelId || !/^\d{17,20}$/.test(channelId)) {
    return { ok: false, detail: "Configure WUMPUS_SUPPORT_RATINGS_CHANNEL_ID com o ID do canal de avaliações." };
  }
  const chat = (await readBotCollection<SupportChatRecord>("support-chats")).find((entry) =>
    entry.id === chatId && entry.guildId === guild.id && entry.rating === rating);
  if (!chat) return { ok: false, detail: "A avaliação não está associada a este atendimento." };
  const channel = await guild.client.channels.fetch(channelId).catch(() => null);
  if (!channel || !("send" in channel) || typeof channel.send !== "function") {
    return { ok: false, detail: "O canal de avaliações não está disponível para o bot." };
  }
  try {
    await channel.send({
      content: `Avaliação do atendimento\nServidor: ${guild.name} (${guild.id})\nSolicitante: <@${chat.requesterId}>\nNota: ${"⭐".repeat(rating)} (${rating}/5)\nTópico: ${chat.threadId ? `https://discord.com/channels/${chat.forumGuildId ?? guild.id}/${chat.threadId}` : "indisponível"}`,
      allowedMentions: { parse: [] },
    });
    return { ok: true, detail: "Avaliação publicada." };
  } catch {
    return { ok: false, detail: "Não foi possível publicar a avaliação no canal configurado." };
  }
}
