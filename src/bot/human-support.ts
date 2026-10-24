import { ChannelType, type ForumChannel, type Guild } from "discord.js";
import type { OutboxJob } from "../lib/wumpus/runtime.server.ts";
import type { Logger } from "./logger.ts";

const DISCORD_MESSAGE_LIMIT = 1800;
const MAX_HISTORY_LENGTH = 8_000;

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
      message: { content: messages[0]!, allowedMentions: { parse: [] } },
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
