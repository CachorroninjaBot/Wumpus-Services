/**
 * Seguranca — anti-raid, anti-nuke e lockdown.
 *
 * No bot antigo o anti-raid vivia num `Map()` de processo: cada restart zerava
 * a contagem, e uma raid em andamento passava despercebida logo depois de um
 * deploy. Aqui a janela de entradas e persistida.
 *
 * O anti-nuke vigia o audit log: banimentos em massa e canais apagados em
 * sequencia sao o padrao classico de conta comprometida com cargo alto.
 */
import { AuditLogEvent, ChannelType, PermissionFlagsBits, type Guild, type GuildMember } from "discord.js";
import { bool, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { resolveChannel, resolveRoles } from "./resolve.ts";

const raidWindows = new Map<string, { at: number }[]>();
const nukeWindows = new Map<string, { at: number; actorId: string }[]>();

function push(map: Map<string, { at: number }[]>, key: string, windowMs: number): number {
  const now = Date.now();
  const kept = (map.get(key) ?? []).filter((entry) => now - entry.at <= windowMs);
  kept.push({ at: now });
  map.set(key, kept);
  return kept.length;
}

/**
 * Entrada de membro: conta a janela e decide se e raid.
 * Tambem barra conta nova demais quando o servidor exige idade minima.
 */
export async function handleMemberAdd(member: GuildMember, log: Logger): Promise<void> {
  const guild = member.guild;
  const config = await moduleConfig(guild.id, "security");
  if (!isEnabled(config)) return;

  const trusted = resolveRoles(guild, list(config, "trustedRoleIds"));
  const isTrusted = trusted.some((role) => member.roles.cache.has(role.id));

  const minAgeHours = Math.max(0, Math.trunc(num(config, "minAccountAgeHours", 0)));
  if (!isTrusted && minAgeHours > 0) {
    const ageHours = (Date.now() - member.user.createdTimestamp) / 3_600_000;
    if (ageHours < minAgeHours) {
      await auditAndLog(
        guild,
        {
          module: "security",
          category: "members",
          eventType: "security_young_account",
          targetId: member.id,
          severity: "warning",
          title: "CONTA NOVA",
          description: `<@${member.id}> entrou com conta de **${ageHours.toFixed(1)}h**.`,
          accentColor: "#f5a524",
          fields: [
            { name: "Idade minima", value: `${minAgeHours}h` },
            { name: "Criada em", value: member.user.createdAt.toISOString() }
          ]
        },
        log
      );

      if (bool(config, "quarantineNewMembers", false)) {
        const minutes = Math.max(1, Math.trunc(num(config, "timeoutMinutes", 60)));
        await member.timeout(minutes * 60_000, "conta nova — quarentena").catch(() => undefined);
        log.info("conta nova em quarentena", { guildId: guild.id, userId: member.id, minutes });
      }
    }
  }

  const threshold = Math.max(2, Math.trunc(num(config, "raidJoinThreshold", 12)));
  const windowMs = Math.max(5, Math.trunc(num(config, "raidWindowSeconds", 60))) * 1000;
  const count = push(raidWindows, guild.id, windowMs);

  if (count < threshold) return;

  // Avisa uma vez por janela, senao cada entrada seguinte repete o alerta.
  raidWindows.set(guild.id, []);

  const alertChannel = resolveChannel(guild, str(config, "alertChannelId"));
  const staffRoles = resolveRoles(guild, list(config, "alertStaffRoleIds"));
  const ping = staffRoles.map((role) => `<@&${role.id}>`).join(" ");

  await auditAndLog(
    guild,
    {
      module: "security",
      category: "members",
      eventType: "security_raid_suspected",
      targetId: member.id,
      severity: "critical",
      title: "SUSPEITA DE RAID",
      description: `**${count}** entradas em ${Math.round(windowMs / 1000)}s.`,
      accentColor: "#ff5c6c",
      fields: [
        { name: "Limite", value: `${threshold} entradas` },
        { name: "Ultima entrada", value: `<@${member.id}>` },
        { name: "Modo", value: str(config, "raidMode", "smart") }
      ],
      data: { count, threshold, windowMs }
    },
    log
  );

  if (alertChannel?.isTextBased() && ping) {
    await alertChannel.send({ content: ping }).catch(() => undefined);
  }

  if (str(config, "response", "") === "lockdown" || str(config, "raidMode", "") === "strict") {
    await setLockdown(guild, true, log);
  }

  log.warn("possivel raid", { guildId: guild.id, count, threshold });
}

/**
 * Liga/desliga o lockdown: nega `SendMessages` para @everyone nos canais de
 * texto. Reversivel — o lockdown nao pode ser uma porta sem volta.
 */
export async function setLockdown(guild: Guild, on: boolean, log: Logger): Promise<number> {
  let changed = 0;

  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) continue;
    try {
      await channel.permissionOverwrites.edit(
        guild.roles.everyone,
        { SendMessages: on ? false : null },
        { reason: on ? "lockdown do Wumpus" : "fim do lockdown" }
      );
      changed += 1;
    } catch {
      // Canal sem permissao de edicao e simplesmente ignorado.
    }
  }

  const config = await moduleConfig(guild.id, "security");
  await auditAndLog(
    guild,
    {
      module: "security",
      category: "channels",
      eventType: on ? "security_lockdown_on" : "security_lockdown_off",
      severity: on ? "critical" : "info",
      title: on ? "LOCKDOWN ATIVADO" : "LOCKDOWN ENCERRADO",
      description: on
        ? str(config, "lockdownMessage", "O servidor esta em modo de protecao.")
        : "O envio de mensagens foi liberado.",
      accentColor: on ? "#ff5c6c" : "#3ecf8e",
      fields: [{ name: "Canais afetados", value: String(changed) }]
    },
    log
  );

  log.info(on ? "lockdown ativado" : "lockdown encerrado", { guildId: guild.id, channels: changed });
  return changed;
}

/**
 * Anti-nuke: observa o audit log. Banimentos e exclusoes em sequencia pelo
 * MESMO autor disparam o alerta — e o sinal de conta comprometida.
 */
export async function handleAuditLogEntry(
  guild: Guild,
  entry: { action: number; executorId: string | null; targetId?: string | null },
  log: Logger
): Promise<void> {
  const config = await moduleConfig(guild.id, "security");
  if (!isEnabled(config)) return;

  const executorId = entry.executorId;
  if (!executorId || executorId === guild.client.user?.id) return;

  const trusted = resolveRoles(guild, list(config, "trustedRoleIds")).map((role) => role.id);
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (member && trusted.some((roleId) => member.roles.cache.has(roleId))) return;

  const isBan = entry.action === AuditLogEvent.MemberBanAdd;
  const isChannelDelete = entry.action === AuditLogEvent.ChannelDelete;

  if (isBan && !bool(config, "alertOnMassBan", true)) return;
  if (isChannelDelete && !bool(config, "alertOnMassChannelDelete", true)) return;
  if (!isBan && !isChannelDelete) return;

  const windowMs = Math.max(5, Math.trunc(num(config, "nukeWindowSeconds", 30))) * 1000;
  const key = `${guild.id}:${isBan ? "ban" : "channel"}`;
  const threshold = Math.max(2, Math.trunc(num(config, "nukeActionThreshold", 5)));

  const now = Date.now();
  const kept = (nukeWindows.get(key) ?? []).filter(
    (item) => now - item.at <= windowMs && item.actorId === executorId
  );
  kept.push({ at: now, actorId: executorId });
  nukeWindows.set(key, kept);

  if (kept.length < threshold) return;
  nukeWindows.set(key, []);

  await auditAndLog(
    guild,
    {
      module: "security",
      category: isBan ? "bans" : "channels",
      eventType: isBan ? "security_mass_ban" : "security_mass_channel_delete",
      actorId: executorId,
      severity: "critical",
      title: isBan ? "BANIMENTO EM MASSA" : "EXCLUSAO DE CANAIS EM MASSA",
      description: `<@${executorId}> executou **${kept.length}** acoes em ${Math.round(windowMs / 1000)}s.`,
      accentColor: "#ff5c6c",
      fields: [
        { name: "Autor", value: `<@${executorId}>` },
        { name: "Acoes", value: String(kept.length) },
        { name: "Limite", value: String(threshold) }
      ],
      data: { count: kept.length, threshold }
    },
    log
  );

  log.warn("possivel nuke", { guildId: guild.id, executorId, count: kept.length, kind: isBan ? "ban" : "channel" });
}

/** Permissao minima que o bot precisa para os modulos de seguranca funcionarem. */
export const SECURITY_PERMISSIONS = [
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ViewAuditLog
];
