/** Mensagens de entrada/saída e modo de manutenção configurados no painel. */
import type { GuildMember, PartialGuildMember } from "discord.js";
import { bool, isEnabled, moduleConfig, str } from "./config.ts";
import type { Logger } from "./logger.ts";
import { asSendable, resolveChannel } from "./resolve.ts";

function renderMemberMessage(template: string, member: GuildMember | PartialGuildMember): string {
  return template
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{mention}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{count}", String(member.guild.memberCount))
    .replaceAll("{userId}", member.id)
    .slice(0, 2000);
}

async function sendMemberNotice(member: GuildMember | PartialGuildMember, kind: "join" | "leave", log: Logger): Promise<void> {
  const config = await moduleConfig(member.guild.id, "servers");
  if (!isEnabled(config)) return;

  const channelRef = str(config, kind === "join" ? "announceJoinChannelId" : "announceLeaveChannelId");
  const template = str(config, kind === "join" ? "joinMessage" : "leaveMessage");
  if (!channelRef || !template) return;

  const channel = asSendable(resolveChannel(member.guild, channelRef));
  if (!channel) {
    log.warn("canal de entrada/saida nao encontrado", { guildId: member.guild.id, kind, channel: channelRef });
    return;
  }

  const content = renderMemberMessage(template, member);
  try {
    await channel.send({ content, allowedMentions: { users: [member.id], parse: [] } });
  } catch (error) {
    log.warn("falha ao enviar mensagem de entrada/saida", { guildId: member.guild.id, kind, channelId: channel.id, error: String(error) });
  }
}

export async function handleMemberWelcome(member: GuildMember, log: Logger): Promise<void> {
  await sendMemberNotice(member, "join", log);
}

export async function handleMemberLeave(member: GuildMember | PartialGuildMember, log: Logger): Promise<void> {
  await sendMemberNotice(member, "leave", log);
}

/**
 * Manutenção pausa apenas novas entradas nos serviços do Wumpus.
 * Moderação, segurança, logs e tickets já abertos continuam funcionando.
 */
export async function maintenanceNotice(guildId: string): Promise<string | null> {
  const config = await moduleConfig(guildId, "servers");
  if (!config || !bool(config, "maintenanceMode", false)) return null;
  return str(config, "maintenanceMessage", "Estamos em manutenção. Voltamos em instantes.").slice(0, 1000);
}
