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
import { AuditLogEvent, ChannelType, PermissionFlagsBits, type Guild, type GuildBasedChannel, type GuildMember, type Message } from "discord.js";
import { bool, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { resolveChannel, resolveRole, resolveRoles } from "./resolve.ts";
import { asSendable } from "./resolve.ts";
import { id } from "./ids.ts";
import { buildPanelPayload, type ButtonSpec } from "./panels.ts";
import { mutate, read } from "./store.ts";
import { pushPersistedSecurityWindow, readPersistedSecurityWindow } from "./security/windows.ts";
import type { SecurityWindowKind } from "./security/windows.ts";
export { clearPersistedSecurityWindow, pushPersistedSecurityWindow, readPersistedSecurityWindow } from "./security/windows.ts";
export type { SecurityWindowKind } from "./security/windows.ts";

type VerificationOverwrite = { channelId: string; everyoneExists: boolean; everyoneAllow: boolean; everyoneDeny: boolean; roleExists: boolean; roleAllow: boolean; roleDeny: boolean };
type VerificationState = { guildId: string; channelId: string; roleId: string; active: boolean; snapshots: VerificationOverwrite[]; updatedAt: number };
type LockdownOverwrite = { channelId: string; existed: boolean; allow: boolean; deny: boolean };
async function verificationState(guildId: string): Promise<VerificationState | undefined> {
  return (await read<VerificationState>("security-verification")).find((row) => row.guildId === guildId);
}
export async function isVerificationActive(guildId: string): Promise<boolean> {
  return Boolean((await verificationState(guildId))?.active);
}
async function saveVerificationState(state: VerificationState | null, guildId: string): Promise<void> {
  await mutate<VerificationState>("security-verification", (rows) => {
    const next = rows.filter((row) => row.guildId !== guildId);
    if (state) next.push(state);
    return next;
  });
}

export function verificationSetupFailure(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  const message = String(error);
  if (code === 350003 || /Onboarding channels must be readable by everyone/i.test(message)) {
    return "O Discord não permite restringir um canal usado no Onboarding: ele precisa continuar visível para @everyone. Remova esse canal do Onboarding nas configurações do servidor ou escolha outro canal para a verificação e tente novamente.";
  }
  return `Não consegui aplicar todas as permissões: ${message.slice(0, 180)}`;
}

/** Apply and persist a reversible @everyone gate before sending the verification panel. */
export async function setupVerification(guild: Guild, channelId: string, roleId: string): Promise<{ ok: boolean; detail: string }> {
  const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  const role = resolveRole(guild, roleId);
  const verificationChannel = resolveChannel(guild, channelId);
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles)) return { ok: false, detail: "O bot precisa de Gerenciar canais e Gerenciar cargos." };
  if (!role) return { ok: false, detail: "O cargo selecionado não foi encontrado neste servidor. Atualize os cargos e selecione novamente." };
  if (role.managed) return { ok: false, detail: `O cargo "${role.name}" é gerenciado por uma integração do Discord e não pode ser atribuído pelo Wumpus. Escolha um cargo criado no servidor.` };
  if (role.position >= me.roles.highest.position) {
    return {
      ok: false,
      detail: `O cargo "${role.name}" está acima ou na mesma posição do cargo mais alto do Wumpus ("${me.roles.highest.name}"). Em Configurações do servidor > Cargos, mova o cargo do Wumpus acima de "${role.name}" e tente novamente.`,
    };
  }
  if (!verificationChannel?.isTextBased() || !("permissionOverwrites" in verificationChannel)) return { ok: false, detail: "Canal de verificação inválido." };
  const old = await verificationState(guild.id);
  if (old?.active) return { ok: false, detail: "A verificação já está ativa. Restaure as permissões antes de configurar novamente." };
  const channels = [...guild.channels.cache.values()].filter((channel) => "permissionOverwrites" in channel);
  const snapshots: VerificationOverwrite[] = channels.map((channel) => {
    const everyone = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
    const verified = channel.permissionOverwrites.cache.get(role.id);
    const bit = PermissionFlagsBits.ViewChannel;
    return { channelId: channel.id, everyoneExists: Boolean(everyone), everyoneAllow: Boolean(everyone?.allow.has(bit)), everyoneDeny: Boolean(everyone?.deny.has(bit)), roleExists: Boolean(verified), roleAllow: Boolean(verified?.allow.has(bit)), roleDeny: Boolean(verified?.deny.has(bit)) };
  });
  const state: VerificationState = { guildId: guild.id, channelId: verificationChannel.id, roleId: role.id, active: false, snapshots, updatedAt: Date.now() };
  await saveVerificationState(state, guild.id);
  try {
    for (const channel of channels) {
      await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: channel.id === channelId });
      await channel.permissionOverwrites.edit(role, { ViewChannel: true });
    }
    state.active = true;
    state.updatedAt = Date.now();
    await saveVerificationState(state, guild.id);
    return { ok: true, detail: "Acesso restrito e cargo verificado liberado nos canais." };
  } catch (error) {
    await restoreVerification(guild).catch(() => undefined);
    return { ok: false, detail: verificationSetupFailure(error) };
  }
}

export async function restoreVerification(guild: Guild): Promise<{ ok: boolean; detail: string }> {
  const state = await verificationState(guild.id);
  if (!state) return { ok: false, detail: "Não há configuração de verificação salva." };
  const failures: string[] = [];
  for (const snapshot of state.snapshots) {
    const channel = guild.channels.cache.get(snapshot.channelId);
    if (!channel || !("permissionOverwrites" in channel)) continue;
    try {
      for (const [id, exists, allow, deny] of [[guild.roles.everyone.id, snapshot.everyoneExists, snapshot.everyoneAllow, snapshot.everyoneDeny], [state.roleId, snapshot.roleExists, snapshot.roleAllow, snapshot.roleDeny]] as const) {
        const overwrite = channel.permissionOverwrites.cache.get(id);
        if (!exists) { if (overwrite) await overwrite.delete("restaurar permissões anteriores à verificação"); }
        else await channel.permissionOverwrites.edit(id, { ViewChannel: allow ? true : deny ? false : null }, { reason: "restaurar permissões anteriores à verificação" });
      }
    } catch (error) { failures.push(`${channel.id}: ${String(error).slice(0, 80)}`); }
  }
  if (!failures.length) { await saveVerificationState(null, guild.id); return { ok: true, detail: "Permissões anteriores restauradas." }; }
  return { ok: false, detail: `Falha ao restaurar ${failures.length} canal(is): ${failures.slice(0, 3).join("; ")}` };
}

export async function grantVerifiedRole(guild: Guild, userId: string, log: Logger): Promise<{ ok: boolean; detail: string }> {
  const state = await verificationState(guild.id);
  if (!state?.active) return { ok: false, detail: "A verificação deste servidor não está ativa." };
  const role = guild.roles.cache.get(state.roleId);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!role || !member) return { ok: false, detail: "Membro ou cargo verificado não encontrado." };
  try {
    await member.roles.add(role, "verificação concluída pelo painel");
    await auditAndLog(guild, { module: "security", category: "members", eventType: "security_member_verified", actorId: userId, targetId: userId, severity: "info", title: "MEMBRO VERIFICADO", description: `<@${userId}> recebeu <@&${role.id}>.` }, log);
    return { ok: true, detail: "Verificação concluída. Seu acesso foi liberado." };
  } catch (error) { return { ok: false, detail: `Não consegui adicionar o cargo: ${String(error).slice(0, 160)}` }; }
}

async function sendSecurityAlert(guild: Guild, title: string, description: string, log: Logger, banRecent = false, details = "", ignoreKind: SecurityWindowKind = "raid-alert"): Promise<void> {
  const config = await moduleConfig(guild.id, "security");
  const channel = asSendable(resolveChannel(guild, str(config, "alertChannelId")));
  if (!channel) {
    log.warn("canal de alertas de segurança ausente ou indisponível", { guildId: guild.id, channelId: str(config, "alertChannelId") });
    return;
  }
  const staffRoles = resolveRoles(guild, list(config, "alertStaffRoleIds"));
  const mention = staffRoles.map((role) => `<@&${role.id}>`).join(" ");
  const buttons: ButtonSpec[] = [
    { label: "Ativar lockdown", customId: id("security", "lockdown"), style: 4 },
    ...(banRecent ? [{ label: "Banir últimos membros…", customId: id("security", "ban_recent"), style: 4 as const }] : []),
    { label: "Ignorar alerta", customId: id("security", "ignore", ignoreKind), style: 2 },
  ];
  const panel = buildPanelPayload({
    title,
    description: details ? `${description}\n\n${details}` : description,
    header: mention,
    accentColor: "#ff5c6c",
    buttons,
  });
  await channel.send({
    ...panel,
    allowedMentions: { parse: [], roles: staffRoles.map((role) => role.id) },
  }).catch((error) => log.warn("falha ao enviar alerta acionável de segurança", { guildId: guild.id, error: String(error) }));
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
          ],
          data: { accountAgeHours: Math.round(ageHours * 10) / 10, minAccountAgeHours: minAgeHours }
        },
        log
      );

      if (bool(config, "quarantineNewMembers", false)) {
        const minutes = Math.max(1, Math.trunc(num(config, "timeoutMinutes", 60)));
        await member.timeout(minutes * 60_000, "conta nova — quarentena").then(() => {
          log.info("conta nova em quarentena", { guildId: guild.id, userId: member.id, minutes });
        }).catch((error) => {
          log.error("falha ao colocar conta nova em quarentena", { guildId: guild.id, userId: member.id, minutes, error: String(error) });
          void auditAndLog(guild, {
            module: "security", category: "moderation", eventType: "security_quarantine_failed",
            targetId: member.id, severity: "warning", title: "FALHA NA QUARENTENA",
            description: `Não consegui aplicar timeout em <@${member.id}>. Confira a posição do cargo do Wumpus e a permissão Moderar membros.`,
            data: { error: String(error).slice(0, 300) },
          }, log);
        });
      }
    }
  }

  const threshold = Math.max(2, Math.trunc(num(config, "raidJoinThreshold", 12)));
  const windowMs = Math.max(5, Math.trunc(num(config, "raidWindowSeconds", 60))) * 1000;
  const count = await pushPersistedSecurityWindow(guild.id, "raid", windowMs, member.id);
  if (count < threshold) return;
  const alertCount = await pushPersistedSecurityWindow(guild.id, "raid-alert", windowMs);
  const firstAlert = alertCount === 1;
  if (firstAlert) {
    const recent = await readPersistedSecurityWindow(guild.id, "raid", windowMs);
    const latest = recent.slice(-5);
    const recentMembers = await Promise.all(latest.map(async (entry) => {
      const recentMember = entry.actorId === member.id ? member : await guild.members.fetch(entry.actorId ?? "").catch(() => null);
      if (!recentMember) return `<@${entry.actorId}> · conta indisponível`;
      const ageHours = Math.max(0, (Date.now() - recentMember.user.createdTimestamp) / 3_600_000);
      return `<@${recentMember.id}> · conta com ${ageHours.toFixed(1)}h`;
    }));

    await auditAndLog(
      guild,
      {
      module: "security",
      category: "members",
      eventType: "security_raid_suspected",
      targetId: member.id,
      severity: "critical",
      title: "SUSPEITA DE RAID",
      description: `**${count}** entradas em ${Math.round(windowMs / 1000)}s. Revisar quem entrou recentemente:`,
      accentColor: "#ff5c6c",
      fields: [
        { name: "Limite", value: `${threshold} entradas` },
        { name: "Entradas recentes", value: recentMembers.join("\n").slice(0, 900) },
        { name: "Conta mais recente", value: `criada em <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
        { name: "Modo", value: str(config, "raidMode", "smart") }
      ],
      data: { count, threshold, windowMs }
      },
      log
    );

    await sendSecurityAlert(
      guild,
      "SUSPEITA DE RAID",
      `${count} entradas em ${Math.round(windowMs / 1000)}s. Última entrada: <@${member.id}> (conta criada <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>).`,
      log,
      true,
      recentMembers.join("\n"),
    );
  }

  const response = str(config, "response", "lockdown_review");
  if (response === "lockdown_review") {
    if (firstAlert) await setLockdown(guild, true, log);
  } else if (response === "auto") {
    if (!bool(config, "autoResponseConfirmed", false)) {
      log.warn("resposta automática de raid ignorada sem confirmação explícita", { guildId: guild.id, userId: member.id });
      await auditAndLog(guild, {
        module: "security", category: "members", eventType: "security_auto_response_unconfirmed",
        targetId: member.id, severity: "warning", title: "RESPOSTA AUTOMÁTICA DESATIVADA",
        description: "A raid foi detectada, mas a resposta automática ainda não foi confirmada no painel.",
      }, log);
    } else {
      const minutes = Math.max(1, Math.trunc(num(config, "timeoutMinutes", 60)));
      await member.timeout(minutes * 60_000, "entrada durante raid detectada — resposta automática").then(async () => {
        await auditAndLog(guild, {
          module: "security", category: "moderation", eventType: "security_auto_timeout",
          actorId: guild.client.user?.id, targetId: member.id, severity: "critical",
          title: "TIMEOUT AUTOMÁTICO DE RAID",
          description: `Timeout de ${minutes} minutos aplicado em <@${member.id}> após suspeita de raid.`,
          data: { minutes, threshold, windowMs },
        }, log);
      }).catch(async (error) => {
        log.error("timeout automático da raid falhou", { guildId: guild.id, userId: member.id, error: String(error) });
        await auditAndLog(guild, {
          module: "security", category: "moderation", eventType: "security_auto_timeout_failed",
          targetId: member.id, severity: "critical", title: "TIMEOUT AUTOMÁTICO FALHOU",
          description: `Não consegui limitar <@${member.id}>. Verifique a hierarquia de cargos e a permissão Moderar membros.`,
          data: { error: String(error).slice(0, 300) },
        }, log);
      });
    }
  }

  log.warn("possivel raid", { guildId: guild.id, count, threshold });
}

/**
 * Liga/desliga o lockdown: nega `SendMessages` para @everyone nos canais de
 * texto. Reversivel — o lockdown nao pode ser uma porta sem volta.
 */
export async function setLockdown(guild: Guild, on: boolean, log: Logger): Promise<number> {
  let changed = 0;
  const lockdownRows = await read<LockdownOverwrite & { guildId: string }>("security-lockdown");
  const previous = lockdownRows.filter((row) => row.guildId === guild.id);

  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) continue;
    try {
      const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      if (on) {
        if (!previous.some((row) => row.channelId === channel.id)) {
          previous.push({ guildId: guild.id, channelId: channel.id, existed: Boolean(overwrite), allow: Boolean(overwrite?.allow.has(PermissionFlagsBits.SendMessages)), deny: Boolean(overwrite?.deny.has(PermissionFlagsBits.SendMessages)) });
        }
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: "lockdown do Wumpus" });
      } else {
        const saved = previous.find((row) => row.channelId === channel.id);
        if (!saved) continue;
        if (!saved.existed && overwrite) await overwrite.delete("restaurar permissões anteriores ao lockdown");
        else if (saved.existed) await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: saved.allow ? true : saved.deny ? false : null }, { reason: "fim do lockdown do Wumpus" });
      }
      changed += 1;
    } catch (error) {
      log.error("falha ao alterar permissões durante lockdown", {
        guildId: guild.id,
        channelId: channel.id,
        action: on ? "ativar" : "encerrar",
        error: String(error),
      });
    }
  }

  if (on) await mutate<LockdownOverwrite & { guildId: string }>("security-lockdown", (rows) => [...rows.filter((row) => row.guildId !== guild.id), ...previous]);
  else await mutate<LockdownOverwrite & { guildId: string }>("security-lockdown", (rows) => rows.filter((row) => row.guildId !== guild.id));

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

  const trusted = resolveRoles(guild, [...list(config, "trustedRoleIds"), ...list(config, "whitelistRoleIds")]).map((role) => role.id);
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (member && trusted.some((roleId) => member.roles.cache.has(roleId))) return;

  const action = new Map<number, { kind: SecurityWindowKind; enabled: string; module: string; eventType: string; title: string }>([
    [AuditLogEvent.MemberBanAdd, { kind: "nuke-ban", enabled: "alertOnMassBan", module: "bans", eventType: "security_mass_ban", title: "BANIMENTO EM MASSA" }],
    [AuditLogEvent.ChannelDelete, { kind: "nuke-channel", enabled: "alertOnMassChannelDelete", module: "channels", eventType: "security_mass_channel_delete", title: "EXCLUSÃO DE CANAIS EM MASSA" }],
    [AuditLogEvent.RoleDelete, { kind: "nuke-role", enabled: "alertOnMassRoleDelete", module: "roles", eventType: "security_mass_role_delete", title: "EXCLUSÃO DE CARGOS EM MASSA" }],
    [AuditLogEvent.WebhookCreate, { kind: "nuke-webhook", enabled: "alertOnMassWebhookCreate", module: "integrations", eventType: "security_mass_webhook_create", title: "CRIAÇÃO DE WEBHOOKS EM MASSA" }],
    [AuditLogEvent.InviteCreate, { kind: "nuke-invite", enabled: "alertOnMassInviteCreate", module: "channels", eventType: "security_mass_invite_create", title: "CRIAÇÃO DE CONVITES EM MASSA" }],
  ]).get(entry.action);
  if (!action || !bool(config, action.enabled, true)) return;

  const windowMs = Math.max(5, Math.trunc(num(config, "nukeWindowSeconds", 30))) * 1000;
  const threshold = Math.max(2, Math.trunc(num(config, "nukeActionThreshold", 5)));
  const kind = action.kind;
  const count = await pushPersistedSecurityWindow(guild.id, kind, windowMs, executorId);

  if (count < threshold) return;
  const alreadyAlerted = await pushPersistedSecurityWindow(guild.id, "nuke-cooldown", windowMs, `${kind}:${executorId}`);
  if (alreadyAlerted > 1) return;
  await auditAndLog(
    guild,
    {
      module: action.module,
      category: action.module === "bans" ? "bans" : action.module === "roles" ? "roles" : "channels",
      eventType: action.eventType,
      actorId: executorId,
      severity: "critical",
      title: action.title,
      description: `<@${executorId}> executou **${count}** acoes em ${Math.round(windowMs / 1000)}s.`,
      accentColor: "#ff5c6c",
      fields: [
        { name: "Autor", value: `<@${executorId}>` },
        { name: "Acoes", value: String(count) },
        { name: "Limite", value: String(threshold) }
      ],
      data: { count, threshold, action: action.kind }
    },
    log
  );

  await sendSecurityAlert(guild, action.title, `<@${executorId}> executou ${count} ações em ${Math.round(windowMs / 1000)} segundos. Revise os registros antes de tomar uma ação.`, log, false, "", "nuke-cooldown");
  if (bool(config, "autoBanRepeatOffenders", false) && bool(config, "autoBanRepeatOffendersConfirmed", false)) {
    if (!member?.bannable) {
      log.error("ban automático do anti-nuke indisponível por hierarquia ou falta do membro", { guildId: guild.id, executorId });
      await auditAndLog(guild, {
        module: "security", category: "bans", eventType: "security_repeat_offender_auto_ban_failed",
        targetId: executorId, severity: "critical", title: "BAN AUTOMÁTICO INDISPONÍVEL",
        description: `Não consegui banir <@${executorId}>. Verifique a permissão Banir membros e a hierarquia de cargos.`,
      }, log);
    } else {
      await member.ban({ reason: `ação destrutiva em massa detectada: ${action.kind}` }).then(() => auditAndLog(guild, {
        module: "security", category: "bans", eventType: "security_repeat_offender_auto_ban",
        actorId: guild.client.user?.id, targetId: executorId, severity: "critical",
        title: "AUTOR DO ANTI-NUKE BANIDO",
        description: `<@${executorId}> foi banido após ${count} ações na janela de ${Math.round(windowMs / 1000)}s.`,
        data: { action: action.kind, count, threshold },
      }, log)).catch(async (error) => {
        log.error("ban automático do autor do anti-nuke falhou", { guildId: guild.id, executorId, error: String(error) });
        await auditAndLog(guild, {
          module: "security", category: "bans", eventType: "security_repeat_offender_auto_ban_failed",
          targetId: executorId, severity: "critical", title: "BAN AUTOMÁTICO FALHOU",
          description: `Não consegui banir <@${executorId}>. Confira as permissões do bot.`,
          data: { error: String(error).slice(0, 300) },
        }, log);
      });
    }
  } else if (bool(config, "autoBanRepeatOffenders", false)) {
    log.warn("ban automático de reincidentes ignorado sem confirmação explícita", { guildId: guild.id, executorId });
  }
  log.warn("possível nuke", { guildId: guild.id, executorId, count, kind });
}

export async function handleMassMention(message: Message, log: Logger): Promise<void> {
  const guild = message.guild;
  if (!guild || !message.mentions.everyone) return;
  const config = await moduleConfig(guild.id, "security");
  if (!isEnabled(config) || !bool(config, "alertOnEveryoneMentions", true)) return;
  const privileged = resolveRoles(guild, [...list(config, "trustedRoleIds"), ...list(config, "whitelistRoleIds")]);
  if (message.member && privileged.some((role) => message.member!.roles.cache.has(role.id))) return;
  const windowMs = Math.max(5, Math.trunc(num(config, "nukeWindowSeconds", 30))) * 1000;
  const threshold = Math.max(2, Math.trunc(num(config, "nukeActionThreshold", 5)));
  const count = await pushPersistedSecurityWindow(guild.id, "nuke-mention", windowMs, message.author.id);
  if (count !== threshold) return;
  await auditAndLog(guild, {
    module: "security", category: "automod", eventType: "security_mass_everyone_mentions",
    actorId: message.author.id, channelId: message.channelId, severity: "critical",
    title: "MENÇÕES @EVERYONE EM MASSA",
    description: `<@${message.author.id}> usou @everyone ${count} vezes em ${Math.round(windowMs / 1000)}s.`,
    accentColor: "#ff5c6c", data: { count, threshold, windowMs },
  }, log);
  await sendSecurityAlert(guild, "MENÇÕES @EVERYONE EM MASSA", `<@${message.author.id}> fez ${count} menções em massa em ${Math.round(windowMs / 1000)} segundos. Confira as mensagens antes de banir.`, log);
}

/** Keep channels created after verification setup behind the same role gate. */
export async function gateNewChannel(channel: GuildBasedChannel, log: Logger): Promise<void> {
  const state = await verificationState(channel.guild.id);
  if (!state?.active || channel.id === state.channelId || !("permissionOverwrites" in channel)) return;
  const everyone = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
  const verified = channel.permissionOverwrites.cache.get(state.roleId);
  const bit = PermissionFlagsBits.ViewChannel;
  const snapshot: VerificationOverwrite = {
    channelId: channel.id, everyoneExists: Boolean(everyone), everyoneAllow: Boolean(everyone?.allow.has(bit)), everyoneDeny: Boolean(everyone?.deny.has(bit)),
    roleExists: Boolean(verified), roleAllow: Boolean(verified?.allow.has(bit)), roleDeny: Boolean(verified?.deny.has(bit)),
  };
  state.snapshots.push(snapshot);
  await saveVerificationState(state, channel.guild.id);
  try {
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { ViewChannel: false });
    await channel.permissionOverwrites.edit(state.roleId, { ViewChannel: true });
  } catch (error) {
    log.error("falha ao restringir canal novo durante verificação", { guildId: channel.guild.id, channelId: channel.id, error: String(error) });
  }
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
