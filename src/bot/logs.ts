import {
  type Channel,
  type Client,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  type Role,
  type PartialMessage,
  type PartialGuildMember
} from "discord.js";
import { resolveModuleConfig } from "../server/db/index.js";
import { buildLogPayload } from "./panels.js";

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

type LogsConfig = {
  channelId?: string;
  logModeration?: boolean;
  logMembers?: boolean;
  logMessages?: boolean;
  logVoice?: boolean;
  logRoles?: boolean;
  logChannels?: boolean;
  logBans?: boolean;
  ignoreBotMessages?: boolean;
  ignoreChannelIds?: string[];
  logThreadEvents?: boolean;
  logAutoMod?: boolean;
  compactMode?: boolean;
  includeTimestamp?: boolean;
  mentionOnCritical?: boolean;
  mentionRoleId?: string;
};

const ICONS = {
  member_join: "📥",
  member_leave: "📤",
  message_edit: "✏️",
  message_delete: "🗑️",
  role_create: "🎭",
  role_delete: "🎭",
  channel_create: "📁",
  channel_delete: "📁",
  ban_add: "🔨",
  ban_remove: "🔓",
  thread_create: "🧵",
  thread_delete: "🧵"
};

function ts(): string {
  return `<t:${Math.floor(Date.now() / 1000)}:R>`;
}

async function getLogChannel(client: Client, guildId: string): Promise<{ channel: GuildTextBasedChannel; config: LogsConfig } | null> {
  const mod = await resolveModuleConfig(guildId, "logs").catch(() => null);
  if (!mod?.enabled) return null;
  const config = mod.config as LogsConfig;
  const channelId = typeof config.channelId === "string" ? config.channelId : "";
  if (!channelId) return null;
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch || !("send" in ch)) return null;
    return { channel: ch as GuildTextBasedChannel, config };
  } catch {
    return null;
  }
}

function isIgnored(channelId: string, config: LogsConfig): boolean {
  const ignored = Array.isArray(config.ignoreChannelIds) ? config.ignoreChannelIds as string[] : [];
  return ignored.includes(channelId);
}

async function send(client: Client, guildId: string, title: string, description: string, color = "#7c5cff", fields?: Array<{ name: string; value: string; inline?: boolean }>): Promise<void> {
  const dest = await getLogChannel(client, guildId);
  if (!dest) return;
  try {
    await client.rest.post(`/channels/${dest.channel.id}/messages`, {
      body: buildLogPayload({ title, description, accentColor: color, fields })
    });
  } catch { /* sem permissão */ }
}

/* ------------------------------------------------------------------ *
 * Handlers públicos — chamados pelo client.ts
 * ------------------------------------------------------------------ */

export async function logMemberJoin(member: GuildMember, log: Logger): Promise<void> {
  if (member.user.bot) return;
  const dest = await getLogChannel(member.client, member.guild.id);
  if (!dest || dest.config.logMembers === false) return;

  const desc = `<@${member.user.id}> (${member.user.username}) entrou no servidor.\nConta criada: ${ts()}`;
  await send(member.client, member.guild.id, `${ICONS.member_join} Membro entrou`, desc, "#3dd68c", [
    { name: "ID", value: member.user.id, inline: true },
    { name: "Membros", value: String(member.guild.memberCount), inline: true }
  ]);
}

export async function logMemberLeave(member: GuildMember | PartialGuildMember, log: Logger): Promise<void> {
  if (member.user.bot) return;
  const dest = await getLogChannel(member.client, member.guild.id);
  if (!dest || dest.config.logMembers === false) return;

  const name = member.user.username ?? "desconhecido";
  const roles = member.roles?.cache
    .filter((r) => r.id !== member.guild.id)
    .map((r) => `<@&${r.id}>`)
    .join(", ") || "nenhum";

  await send(member.client, member.guild.id, `${ICONS.member_leave} Membro saiu`, `<@${member.user.id}> (${name}) saiu do servidor.`, "#ff5c6c", [
    { name: "Cargos", value: roles.slice(0, 1024), inline: false }
  ]);
}

export async function logMessageEdit(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage, log: Logger): Promise<void> {
  if (!newMsg.guild) return;
  if (newMsg.author?.bot) {
    const dest = await getLogChannel(newMsg.client, newMsg.guild.id);
    if (!dest || dest.config.ignoreBotMessages !== false) return;
  }
  const dest = await getLogChannel(newMsg.client, newMsg.guild.id);
  if (!dest || dest.config.logMessages === false) return;
  if (isIgnored(newMsg.channelId, dest.config)) return;

  const before = oldMsg.content?.slice(0, 500) || "(vazio)";
  const after = newMsg.content?.slice(0, 500) || "(vazio)";
  if (before === after) return;

  await send(newMsg.client, newMsg.guild.id, `${ICONS.message_edit} Mensagem editada`, `<@${newMsg.author?.id}> em <#${newMsg.channelId}>`, "#f5a524", [
    { name: "Antes", value: before.slice(0, 1024), inline: false },
    { name: "Depois", value: after.slice(0, 1024), inline: false }
  ]);
}

export async function logMessageDelete(message: Message | PartialMessage, log: Logger): Promise<void> {
  if (!message.guild) return;
  if (message.author?.bot) {
    const dest = await getLogChannel(message.client, message.guild.id);
    if (!dest || dest.config.ignoreBotMessages !== false) return;
  }
  const dest = await getLogChannel(message.client, message.guild.id);
  if (!dest || dest.config.logMessages === false) return;
  if (isIgnored(message.channelId, dest.config)) return;

  const content = message.content?.slice(0, 500) || "(sem conteúdo ou embed)";
  const author = message.author ? `<@${message.author.id}>` : "desconhecido";

  await send(message.client, message.guild.id, `${ICONS.message_delete} Mensagem apagada`, `${author} em <#${message.channelId}>`, "#ff5c6c", [
    { name: "Conteúdo", value: content.slice(0, 1024), inline: false }
  ]);
}

export async function logRoleCreate(role: Role, log: Logger): Promise<void> {
  const dest = await getLogChannel(role.client, role.guild.id);
  if (!dest || dest.config.logRoles === false) return;

  await send(role.client, role.guild.id, `${ICONS.role_create} Cargo criado`, `**${role.name}** foi criado.`, "#3dd68c", [
    { name: "ID", value: role.id, inline: true },
    { name: "Cor", value: role.hexColor, inline: true },
    { name: "Menção", value: role.mentionable ? "Sim" : "Não", inline: true }
  ]);
}

export async function logRoleDelete(role: Role, log: Logger): Promise<void> {
  const dest = await getLogChannel(role.client, role.guild.id);
  if (!dest || dest.config.logRoles === false) return;

  await send(role.client, role.guild.id, `${ICONS.role_delete} Cargo removido`, `**${role.name}** foi deletado.`, "#ff5c6c", [
    { name: "ID", value: role.id, inline: true }
  ]);
}

export async function logChannelCreate(channel: Channel, log: Logger): Promise<void> {
  if (!("guild" in channel) || !channel.guild) return;
  const dest = await getLogChannel(channel.client, channel.guild.id);
  if (!dest || dest.config.logChannels === false) return;

  const name = "name" in channel ? channel.name : "desconhecido";
  const type = channel.type;
  await send(channel.client, channel.guild.id, `${ICONS.channel_create} Canal criado`, `**#${name}** foi criado.`, "#3dd68c", [
    { name: "Tipo", value: String(type), inline: true },
    { name: "ID", value: channel.id, inline: true }
  ]);
}

export async function logChannelDelete(channel: Channel, log: Logger): Promise<void> {
  if (!("guild" in channel) || !channel.guild) return;
  const dest = await getLogChannel(channel.client, channel.guild.id);
  if (!dest || dest.config.logChannels === false) return;

  const name = "name" in channel ? channel.name : "desconhecido";
  await send(channel.client, channel.guild.id, `${ICONS.channel_delete} Canal removido`, `**#${name}** foi deletado.`, "#ff5c6c", [
    { name: "ID", value: channel.id, inline: true }
  ]);
}

export async function logBanAdd(guildId: string, client: Client, userId: string, log: Logger): Promise<void> {
  const dest = await getLogChannel(client, guildId);
  if (!dest || dest.config.logBans === false) return;

  await send(client, guildId, `${ICONS.ban_add} Membro banido`, `<@${userId}> foi banido do servidor.`, "#ff5c6c");
}

export async function logBanRemove(guildId: string, client: Client, userId: string, log: Logger): Promise<void> {
  const dest = await getLogChannel(client, guildId);
  if (!dest || dest.config.logBans === false) return;

  await send(client, guildId, `${ICONS.ban_remove} Ban removido`, `<@${userId}> teve o ban revogado.`, "#3dd68c");
}