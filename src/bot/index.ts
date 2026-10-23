/**
 * Ponto de entrada do bot — eventos e despacho.
 *
 * Substitui o `scripts/bot.mjs` monolítico. Cada evento aqui e so encanamento:
 * a regra vive no modulo correspondente (tickets, forms, moderation, automod,
 * security, logs), entao da para testar cada um sem subir o Discord.
 *
 * Diferente do bot antigo, a config e lida do runtime publicado pelo painel —
 * e o `/config status` mostra exatamente o que foi lido, para o caso de o
 * painel e o bot discordarem.
 */
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Client,
  AuditLogEvent,
  Events,
  GatewayIntentBits,
  Partials,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type Guild,
  type Interaction,
  type Message,
  type PartialMessage,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction
} from "discord.js";
import { handleGhostPing, handleImageContent, handleMessage } from "./automod.ts";
import { handleCommand, registerCommands } from "./commands.ts";
import { bool, isEnabled, list, moduleConfig } from "./config.ts";
import { buildFormModal, handleFormSelect, openForm, parseFields, readDraft, reviewForm, submitForm } from "./forms.ts";
import { id, parseId } from "./ids.ts";
import { handleKnowledgeMessage } from "./knowledge.ts";
import { consoleLogger, type Logger } from "./logger.ts";
import { auditAndLog, logToChannel, pruneAudit, recordAudit, shouldIgnoreLogEvent } from "./logs.ts";
import { renderAuditDiff } from "./log-diff.ts";
import { renderLogEvent } from "./log-render.ts";
import { applyDefaultRole, removeManagedRolesOnLeave } from "./roles.ts";
import { checkInactivity, checkOverload } from "./staff.ts";
import { bump, maybeSendDigest, pruneStatistics } from "./statistics.ts";
import {
  claimTicket,
  checkSla,
  closeTicket,
  openTicket,
  recordFeedback,
  recordTicketMessage,
  reopenClosedTicket,
  setTicketPriority
} from "./tickets.ts";
import { clearPersistedSecurityWindow, gateNewChannel, handleAuditLogEntry, handleMassMention, handleMemberAdd, grantVerifiedRole, isVerificationActive, readPersistedSecurityWindow, setLockdown } from "./security.ts";
import { processOutbox } from "./outbox-send.ts";
import { writeBotHealth } from "../lib/wumpus/health.server.ts";

export type BotHandle = {
  client: Client;
  stop: () => Promise<void>;
};

const SLA_INTERVAL_MS = 5 * 60_000;
const PRUNE_INTERVAL_MS = 6 * 60 * 60_000;

/** Permissoes que o bot precisa. Sem elas, os modulos falham em silencio. */
export const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.MessageContent
];

async function recordMessageLog(message: Message | PartialMessage, eventType: string, title: string, content: string, log: Logger): Promise<void> {
  if (!message.guild) return;
  const config = await moduleConfig(message.guild.id, "logs");
  if (!isEnabled(config) || !bool(config, "logMessages", false)) return;
  const details = { actorId: message.author?.id, targetId: message.author?.id, channelId: message.channelId };
  if (await shouldIgnoreLogEvent(message.guild, config, details)) return;
  const text = content.slice(0, 1800);
  await auditAndLog(message.guild, {
    module: "messages", category: "messages", eventType,
    ...details,
    title, description: `<@${message.author?.id}> · <#${message.channelId}>\n\n${text || "(sem texto)"}`,
  }, log);
}

const AUDIT_CATEGORIES: Partial<Record<AuditLogEvent, { module: string; category: string; title: string }>> = {
  [AuditLogEvent.GuildUpdate]: { module: "server", category: "channels", title: "SERVIDOR ATUALIZADO" },
  [AuditLogEvent.ChannelCreate]: { module: "channels", category: "channels", title: "CANAL CRIADO" },
  [AuditLogEvent.ChannelUpdate]: { module: "channels", category: "channels", title: "CANAL ATUALIZADO" },
  [AuditLogEvent.ChannelDelete]: { module: "channels", category: "channels", title: "CANAL APAGADO" },
  [AuditLogEvent.ChannelOverwriteCreate]: { module: "channels", category: "channels", title: "PERMISSÃO DE CANAL CRIADA" },
  [AuditLogEvent.ChannelOverwriteUpdate]: { module: "channels", category: "channels", title: "PERMISSÃO DE CANAL ATUALIZADA" },
  [AuditLogEvent.ChannelOverwriteDelete]: { module: "channels", category: "channels", title: "PERMISSÃO DE CANAL REMOVIDA" },
  [AuditLogEvent.MemberKick]: { module: "members", category: "members", title: "MEMBRO EXPULSO" },
  [AuditLogEvent.MemberPrune]: { module: "members", category: "members", title: "MEMBROS REMOVIDOS POR INATIVIDADE" },
  [AuditLogEvent.MemberBanAdd]: { module: "bans", category: "bans", title: "MEMBRO BANIDO" },
  [AuditLogEvent.MemberBanRemove]: { module: "bans", category: "bans", title: "BANIMENTO REMOVIDO" },
  [AuditLogEvent.MemberUpdate]: { module: "members", category: "members", title: "MEMBRO ATUALIZADO" },
  [AuditLogEvent.MemberRoleUpdate]: { module: "roles", category: "roles", title: "CARGOS DO MEMBRO ALTERADOS" },
  [AuditLogEvent.MemberMove]: { module: "voice", category: "voice", title: "MEMBRO MOVIDO DE CANAL DE VOZ" },
  [AuditLogEvent.MemberDisconnect]: { module: "voice", category: "voice", title: "MEMBRO DESCONECTADO DA VOZ" },
  [AuditLogEvent.MessagePin]: { module: "messages", category: "messages", title: "MENSAGEM FIXADA" },
  [AuditLogEvent.MessageUnpin]: { module: "messages", category: "messages", title: "MENSAGEM DESAFIXADA" },
  [AuditLogEvent.MessageBulkDelete]: { module: "messages", category: "messages", title: "MENSAGENS APAGADAS EM MASSA" },
  [AuditLogEvent.BotAdd]: { module: "members", category: "members", title: "BOT ADICIONADO" },
  [AuditLogEvent.RoleCreate]: { module: "roles", category: "roles", title: "CARGO CRIADO" },
  [AuditLogEvent.RoleUpdate]: { module: "roles", category: "roles", title: "CARGO ATUALIZADO" },
  [AuditLogEvent.RoleDelete]: { module: "roles", category: "roles", title: "CARGO APAGADO" },
  [AuditLogEvent.InviteCreate]: { module: "invites", category: "channels", title: "CONVITE CRIADO" },
  [AuditLogEvent.InviteUpdate]: { module: "invites", category: "channels", title: "CONVITE ATUALIZADO" },
  [AuditLogEvent.InviteDelete]: { module: "invites", category: "channels", title: "CONVITE APAGADO" },
  [AuditLogEvent.WebhookCreate]: { module: "integrations", category: "channels", title: "WEBHOOK CRIADO" },
  [AuditLogEvent.WebhookUpdate]: { module: "integrations", category: "channels", title: "WEBHOOK ATUALIZADO" },
  [AuditLogEvent.WebhookDelete]: { module: "integrations", category: "channels", title: "WEBHOOK APAGADO" },
  [AuditLogEvent.IntegrationCreate]: { module: "integrations", category: "channels", title: "INTEGRAÇÃO ADICIONADA" },
  [AuditLogEvent.IntegrationUpdate]: { module: "integrations", category: "channels", title: "INTEGRAÇÃO ATUALIZADA" },
  [AuditLogEvent.IntegrationDelete]: { module: "integrations", category: "channels", title: "INTEGRAÇÃO REMOVIDA" },
  [AuditLogEvent.EmojiCreate]: { module: "server", category: "channels", title: "EMOJI CRIADO" },
  [AuditLogEvent.EmojiUpdate]: { module: "server", category: "channels", title: "EMOJI ATUALIZADO" },
  [AuditLogEvent.EmojiDelete]: { module: "server", category: "channels", title: "EMOJI APAGADO" },
  [AuditLogEvent.StickerCreate]: { module: "server", category: "channels", title: "FIGURINHA CRIADA" },
  [AuditLogEvent.StickerUpdate]: { module: "server", category: "channels", title: "FIGURINHA ATUALIZADA" },
  [AuditLogEvent.StickerDelete]: { module: "server", category: "channels", title: "FIGURINHA APAGADA" },
  [AuditLogEvent.ThreadCreate]: { module: "channels", category: "threads", title: "THREAD CRIADA" },
  [AuditLogEvent.ThreadUpdate]: { module: "channels", category: "threads", title: "THREAD ATUALIZADA" },
  [AuditLogEvent.ThreadDelete]: { module: "channels", category: "threads", title: "THREAD APAGADA" },
  [AuditLogEvent.StageInstanceCreate]: { module: "events", category: "stages", title: "STAGE CRIADO" },
  [AuditLogEvent.StageInstanceUpdate]: { module: "events", category: "stages", title: "STAGE ATUALIZADO" },
  [AuditLogEvent.StageInstanceDelete]: { module: "events", category: "stages", title: "STAGE ENCERRADO" },
  [AuditLogEvent.GuildScheduledEventCreate]: { module: "events", category: "scheduled", title: "EVENTO AGENDADO CRIADO" },
  [AuditLogEvent.GuildScheduledEventUpdate]: { module: "events", category: "scheduled", title: "EVENTO AGENDADO ATUALIZADO" },
  [AuditLogEvent.GuildScheduledEventDelete]: { module: "events", category: "scheduled", title: "EVENTO AGENDADO APAGADO" },
  [AuditLogEvent.AutoModerationRuleCreate]: { module: "automod", category: "automod", title: "REGRA DO AUTOMOD CRIADA" },
  [AuditLogEvent.AutoModerationRuleUpdate]: { module: "automod", category: "automod", title: "REGRA DO AUTOMOD ATUALIZADA" },
  [AuditLogEvent.AutoModerationRuleDelete]: { module: "automod", category: "automod", title: "REGRA DO AUTOMOD APAGADA" },
  [AuditLogEvent.AutoModerationBlockMessage]: { module: "automod", category: "automod", title: "MENSAGEM BLOQUEADA PELO AUTOMOD" },
  [AuditLogEvent.AutoModerationFlagToChannel]: { module: "automod", category: "automod", title: "MENSAGEM SINALIZADA PELO AUTOMOD" },
  [AuditLogEvent.AutoModerationUserCommunicationDisabled]: { module: "automod", category: "automod", title: "USUÁRIO LIMITADO PELO AUTOMOD" },
  [AuditLogEvent.AutoModerationQuarantineUser]: { module: "automod", category: "automod", title: "USUÁRIO EM QUARENTENA PELO AUTOMOD" },
  [AuditLogEvent.SoundboardSoundCreate]: { module: "server", category: "channels", title: "SOM DO SOUNDBOARD CRIADO" },
  [AuditLogEvent.SoundboardSoundUpdate]: { module: "server", category: "channels", title: "SOM DO SOUNDBOARD ATUALIZADO" },
  [AuditLogEvent.SoundboardSoundDelete]: { module: "server", category: "channels", title: "SOM DO SOUNDBOARD APAGADO" },
  [AuditLogEvent.OnboardingPromptCreate]: { module: "server", category: "channels", title: "PERGUNTA DE ONBOARDING CRIADA" },
  [AuditLogEvent.OnboardingPromptUpdate]: { module: "server", category: "channels", title: "PERGUNTA DE ONBOARDING ATUALIZADA" },
  [AuditLogEvent.OnboardingPromptDelete]: { module: "server", category: "channels", title: "PERGUNTA DE ONBOARDING REMOVIDA" },
  [AuditLogEvent.OnboardingCreate]: { module: "server", category: "channels", title: "ONBOARDING CONFIGURADO" },
  [AuditLogEvent.OnboardingUpdate]: { module: "server", category: "channels", title: "ONBOARDING ATUALIZADO" },
  [AuditLogEvent.HomeSettingsCreate]: { module: "server", category: "channels", title: "CONFIGURAÇÃO DA PÁGINA INICIAL CRIADA" },
  [AuditLogEvent.HomeSettingsUpdate]: { module: "server", category: "channels", title: "CONFIGURAÇÃO DA PÁGINA INICIAL ATUALIZADA" },
  [AuditLogEvent.VoiceChannelStatusCreate]: { module: "voice", category: "voice", title: "STATUS DO CANAL DE VOZ CRIADO" },
  [AuditLogEvent.VoiceChannelStatusDelete]: { module: "voice", category: "voice", title: "STATUS DO CANAL DE VOZ REMOVIDO" },
  [AuditLogEvent.ApplicationCommandPermissionUpdate]: { module: "integrations", category: "channels", title: "PERMISSÕES DE COMANDO ATUALIZADAS" },
  [AuditLogEvent.CreatorMonetizationRequestCreated]: { module: "server", category: "channels", title: "PEDIDO DE MONETIZAÇÃO CRIADO" },
  [AuditLogEvent.CreatorMonetizationTermsAccepted]: { module: "server", category: "channels", title: "TERMOS DE MONETIZAÇÃO ACEITOS" },
};

async function recordGatewayAudit(entry: import("discord.js").GuildAuditLogsEntry, guild: Guild, log: Logger): Promise<void> {
  let mapped = AUDIT_CATEGORIES[entry.action as AuditLogEvent];
  if (!mapped) return;
  const isTimeout = entry.action === AuditLogEvent.MemberUpdate && entry.changes.some((change) => change.key === "communication_disabled_until");
  if (isTimeout) mapped = { module: "moderation", category: "moderation", title: "TIMEOUT DE MEMBRO" };
  const changes = renderAuditDiff(entry.changes, 900);
  const target = entry.target as { id?: string; name?: string } | null;
  const targetId = target?.id;
  const details = {
    actorId: entry.executorId ?? undefined,
    targetId,
    channelId: entry.extra && "channel" in entry.extra ? (entry.extra.channel as { id?: string } | null)?.id : undefined,
  };
  const severity = isTimeout || entry.action === AuditLogEvent.MemberBanAdd || entry.action === AuditLogEvent.ChannelDelete
    ? "warning" as const : "info" as const;
  const eventType = mapped.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const diffSummary = changes.map((field) => field.value.replaceAll("**", "")).join(" · ").slice(0, 900);
  await recordAudit({
    guildId: guild.id, module: mapped.module, eventType, actorId: details.actorId, targetId, channelId: details.channelId, severity,
    data: { targetName: target?.name, summary: `${mapped.title}${target?.name ? ` · ${target.name}` : ""}${diffSummary ? ` · ${diffSummary}` : ""}`, changes: entry.changes },
  });
  const config = await moduleConfig(guild.id, "logs");
  const rendered = renderLogEvent({
    title: mapped.title,
    description: `${target?.name ?? (targetId ? `<@${targetId}>` : "Evento do servidor")} · ação de auditoria do Discord.`,
    ...details,
    at: entry.createdTimestamp,
    changes: changes.map((field) => field.value).join("\n"),
  });
  if (await shouldIgnoreLogEvent(guild, config, details)) return;
  const burstKey = `${guild.id}:${entry.action}`;
  const current = auditBursts.get(burstKey);
  const item = { summary: target?.name ?? (targetId ? `<@${targetId}>` : "evento"), changes: rendered.fields.find((field) => field.name === "Alterações")?.value };
  if (current) {
    current.items.push(item);
    return;
  }
  const burst = { items: [item], timer: setTimeout(() => {
    auditBursts.delete(burstKey);
    const items = burst.items.slice(0, 10);
    const compact = items.map((row) => `• ${row.summary}${row.changes ? ` — ${row.changes.replaceAll("\n", "; ")}` : ""}`).join("\n");
    void logToChannel(guild, mapped.category, {
      title: items.length > 1 ? `${mapped.title} · ${items.length} eventos` : mapped.title,
      description: items.length > 1 ? compact.slice(0, 1800) : rendered.description,
      fields: items.length > 1 ? [] : rendered.fields,
      accentColor: severity === "warning" ? "#f5a524" : "#7c5cff",
    }, log, {});
  }, 1500) };
  auditBursts.set(burstKey, burst);
}

const auditBursts = new Map<string, { items: { summary: string; changes?: string }[]; timer: ReturnType<typeof setTimeout> }>();

async function respond(interaction: Interaction, content: string): Promise<void> {
  try {
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
      else await interaction.reply({ content, ephemeral: true });
    }
  } catch {
    // Interacao expirada: nada a fazer.
  }
}

/**
 * Select de departamento — o padrao que tickets.bot e tickettool usam.
 *
 * Antes eram botoes: cada departamento virava um botao, e o Discord limita a 5
 * por linha. Com select cabem 25, da para por descricao em cada opcao, e a
 * escolha fica num unico controle em vez de uma fileira de botoes.
 */
async function promptDepartment(interaction: ButtonInteraction, log: Logger): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const config = await moduleConfig(guild.id, "tickets");
  const departments = list(config, "departments").filter(Boolean).slice(0, 25);

  if (departments.length <= 1) {
    await interaction.deferReply({ ephemeral: true });
    const result = await openTicket(guild, interaction.user.id, departments[0] ?? null, log);
    await interaction.editReply(result.ok ? `Atendimento aberto em <#${result.channelId}>.` : result.error);
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(id("ticket", "dept"))
    .setPlaceholder("Escolha o departamento")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      departments.map((department) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(department.slice(0, 100))
          .setValue(department.slice(0, 100))
      )
    );

  await interaction.reply({
    content: "Escolha o departamento para abrir o atendimento:",
    ephemeral: true,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]
  });
}

/** Abre o atendimento no departamento escolhido no select. */
async function handleDepartmentSelect(
  interaction: StringSelectMenuInteraction,
  log: Logger
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const department = interaction.values[0] ?? null;

  await interaction.deferReply({ ephemeral: true });
  const result = await openTicket(guild, interaction.user.id, department, log);
  await interaction.editReply(
    result.ok ? `Atendimento aberto em <#${result.channelId}>.` : result.error
  );
}

async function handleButton(interaction: ButtonInteraction, log: Logger): Promise<void> {
  const parsed = parseId(interaction.customId);
  if (!parsed) return;

  const guild = interaction.guild;
  if (!guild) return;

  const { kind, action, args } = parsed;

  if (kind === "security") {
    if (action === "verify") {
      await interaction.deferReply({ ephemeral: true });
      const result = await grantVerifiedRole(guild, interaction.user.id, log);
      await interaction.editReply(result.detail);
      return;
    }
    if (!interaction.memberPermissions?.has("ManageGuild")) {
      await interaction.reply({ content: "Você precisa de Gerenciar servidor para usar essa ação.", ephemeral: true });
      return;
    }
    if (action === "lockdown") {
      await interaction.deferReply({ ephemeral: true });
      const count = await setLockdown(guild, true, log);
      await interaction.editReply(`Lockdown ativado em ${count} canais.`);
      return;
    }
    if (action === "ignore") {
      const windowKind = (args[0] ?? "raid-alert") as "raid-alert" | "nuke-cooldown";
      await clearPersistedSecurityWindow(guild.id, windowKind);
      await auditAndLog(guild, { module: "security", category: "automod", eventType: "security_alert_ignored", actorId: interaction.user.id, severity: "info", title: "ALERTA DE SEGURANÇA REVISADO", description: `<@${interaction.user.id}> marcou o alerta como revisado.` }, log);
      await interaction.reply({ content: "Alerta marcado como revisado. A próxima detecção poderá gerar novo alerta.", ephemeral: true });
      return;
    }
    if (action === "ban_recent") {
      const modal = new ModalBuilder().setCustomId(id("security", "ban_confirm")).setTitle("Banir membros recentes");
      const count = new TextInputBuilder().setCustomId("count").setLabel("Quantidade (1 a 10)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setPlaceholder("5");
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(count));
      await interaction.showModal(modal);
      return;
    }
  }

  if (kind === "ticket" && action === "open") {
    await promptDepartment(interaction, log);
    return;
  }

  if (kind === "ticket" && action === "claim") {
    const ticketId = Number(args[0]);
    await interaction.deferReply({ ephemeral: true });
    const result = await claimTicket(guild, ticketId, interaction.user.id, log);

    if (result.alreadyBy) await interaction.editReply(`<@${result.alreadyBy}> ja assumiu este atendimento.`);
    else if (result.ok) await interaction.editReply("Voce assumiu o atendimento.");
    else await interaction.editReply("Nao foi possivel assumir este atendimento.");
    return;
  }

  if (kind === "ticket" && action === "close") {
    const ticketId = Number(args[0]);
    await interaction.deferReply({ ephemeral: true });
    const result = await closeTicket(guild, ticketId, interaction.user.id, log);
    await interaction.editReply(result.ok ? "Atendimento encerrado." : "Este atendimento ja estava encerrado.");
    return;
  }

  if (kind === "ticket" && action === "rate") {
    const ticketId = Number(args[0]);
    const rating = Number(args[1]);
    await recordFeedback(guild.id, ticketId, rating, log);
    await interaction.update({ content: `Obrigado! Nota **${rating}/5** registrada.`, components: [] });
    return;
  }

  if (kind === "ticket" && action === "prior") {
    const ticketId = Number(args[0]);
    const priority = args[1] ?? "normal";
    const applied = await setTicketPriority(guild, ticketId, priority, interaction.user.id, log);
    await interaction.reply({
      content: applied
        ? `Prioridade do atendimento **#${ticketId}** agora e **${priority}**.`
        : "Este atendimento nao existe ou ja foi encerrado.",
      ephemeral: true
    });
    return;
  }

  if (kind === "ticket" && action === "reopen") {
    const ticketId = Number(args[0]);
    await interaction.deferReply({ ephemeral: true });
    const result = await reopenClosedTicket(guild, ticketId, interaction.user.id, log);
    await interaction.editReply(
      result.ok ? `Atendimento reaberto em <#${result.channelId}>.` : (result.error ?? "Nao foi possivel reabrir.")
    );
    return;
  }

  if (kind === "form" && action === "open") {
    // Duas etapas: se o formulario tem selecoes, elas vem antes do modal.
    await openForm(interaction, log);
    return;
  }

  if (kind === "form" && action === "continue") {
    // Terminou de escolher: abre o modal levando as escolhas do rascunho.
    const config = await moduleConfig(guild.id, "forms");
    const draft = await readDraft(guild.id, interaction.user.id);
    await interaction.showModal(buildFormModal(parseFields(config), id("form", "submit"), draft?.values ?? {}));
    return;
  }

  if (kind === "form" && (action === "approve" || action === "reject")) {
    const submissionId = Number(args[0]);

    if (action === "approve") {
      await interaction.deferReply({ ephemeral: true });
      const result = await reviewForm(guild, submissionId, interaction.user.id, "approved", null, log);
      await interaction.editReply(result.ok ? "Candidatura aprovada." : (result.error ?? "Falhou."));
      return;
    }

    // Recusa pede motivo: abre modal com um campo.
    const modal = {
      title: "Recusar candidatura",
      custom_id: id("form", "rejectreason", submissionId),
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "motivo",
              label: "Motivo da recusa",
              style: 2,
              required: true,
              max_length: 500
            }
          ]
        }
      ]
    };

    await interaction.showModal(modal as never);
    return;
  }
}

async function handleModal(interaction: ModalSubmitInteraction, log: Logger): Promise<void> {
  const parsed = parseId(interaction.customId);
  if (!parsed) return;

  if (parsed.kind === "security" && parsed.action === "ban_confirm" && interaction.guild) {
    if (!interaction.memberPermissions?.has("ManageGuild")) { await interaction.reply({ content: "Você precisa de Gerenciar servidor para usar essa ação.", ephemeral: true }); return; }
    const requested = Number(interaction.fields.getTextInputValue("count"));
    if (!Number.isInteger(requested) || requested < 1 || requested > 10) { await interaction.reply({ content: "Informe uma quantidade entre 1 e 10.", ephemeral: true }); return; }
    await interaction.deferReply({ ephemeral: true });
    const config = await moduleConfig(interaction.guild.id, "security");
    const trusted = new Set([...list(config, "trustedRoleIds"), ...list(config, "whitelistRoleIds")]);
    const windowMs = Math.max(5, Number(config?.raidWindowSeconds ?? 60)) * 1000;
    const entries = await readPersistedSecurityWindow(interaction.guild.id, "raid", windowMs);
    const ids = [...new Set(entries.slice().reverse().map((entry) => entry.actorId).filter((value): value is string => Boolean(value)))].slice(0, requested);
    let banned = 0;
    for (const userId of ids) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member || member.id === interaction.user.id || member.user.bot || member.roles.cache.some((role) => trusted.has(role.id)) || !member.bannable) continue;
      await member.ban({ reason: `ação manual de resposta ao alerta anti-raid por ${interaction.user.tag}` }).then(async () => {
        banned++;
        await auditAndLog(interaction.guild!, { module: "security", category: "bans", eventType: "security_recent_member_ban", actorId: interaction.user.id, targetId: member.id, severity: "critical", title: "BAN MANUAL APÓS ALERTA DE RAID", description: `<@${member.id}> banido por <@${interaction.user.id}>.` }, log);
      }).catch((error) => log.warn("falha ao banir membro recente", { guildId: interaction.guildId, userId, error: String(error) }));
    }
    await interaction.editReply(`Banidos ${banned} de ${ids.length} membros recentes elegíveis. Membros protegidos ou acima do cargo do bot foram ignorados.`);
    return;
  }

  const guild = interaction.guild;
  if (!guild) return;

  const { kind, action, args } = parsed;

  if (kind === "form" && action === "submit") {
    await interaction.deferReply({ ephemeral: true });
    const result = await submitForm(interaction, log);
    await interaction.editReply(result.ok ? "Candidatura enviada. Boa sorte!" : result.error);
    return;
  }

  if (kind === "form" && action === "rejectreason") {
    const submissionId = Number(args[0]);
    const reason = interaction.fields.getTextInputValue("motivo");

    await interaction.deferReply({ ephemeral: true });
    const result = await reviewForm(guild, submissionId, interaction.user.id, "rejected", reason, log);
    await interaction.editReply(result.ok ? "Candidatura recusada." : (result.error ?? "Falhou."));
  }
}

export function createBot(token: string, log: Logger = consoleLogger): BotHandle {
  const client = new Client({ intents: INTENTS, partials: [Partials.Channel, Partials.Message] });

  let healthTimer: ReturnType<typeof setInterval> | null = null;
  const reportHealth = (status: "online" | "offline") =>
    writeBotHealth({
      status,
      at: Date.now(),
      startedAt,
      guildCount: client.guilds.cache.size,
      pingMs: client.ws.ping >= 0 ? client.ws.ping : null,
    });
  const startedAt = Date.now();

  client.once(Events.ClientReady, async () => {
    log.info("online", { user: client.user?.tag, guilds: client.guilds.cache.size });
    await reportHealth("online").catch((error) => log.error("falha ao publicar saúde do bot", { error: String(error) }));
    healthTimer = setInterval(() => {
      void reportHealth("online").catch((error) => log.error("falha ao publicar saúde do bot", { error: String(error) }));
    }, 30_000);
    if (client.user) await registerCommands(client.user.id, token, log);
  });

  client.on(Events.GuildCreate, (guild: Guild) => {
    log.info("entrou em servidor", { guildId: guild.id, name: guild.name, members: guild.memberCount });
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void handleMemberAdd(member, log).then(async () => {
      // Não atribuir cargos padrão que possam contornar a barreira de verificação.
      if (!(await isVerificationActive(member.guild.id))) await applyDefaultRole(member, log);
    }).catch((error) => log.error("falha no fluxo de entrada de membro", { error: String(error) }));
    void bump(member.guild.id, "joins").catch(() => undefined);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void removeManagedRolesOnLeave(member.guild, member, log).catch(() => undefined);
    void bump(member.guild.id, "leaves").catch(() => undefined);
  });

  client.on(Events.ChannelCreate, (channel) => {
    void gateNewChannel(channel, log).catch((error) => log.error("falha ao restringir canal novo", { channelId: channel.id, error: String(error) }));
  });

  client.on(Events.MessageCreate, (message: Message) => {
    if (message.author.bot || !message.guild) return;
    void recordMessageLog(message, "message_created", "Mensagem enviada", message.content, log);

    void handleMessage(message, log).catch((error) =>
      log.error("falha no automod", { error: String(error) })
    );
    void handleMassMention(message, log).catch((error) => log.error("falha no detector de menções em massa", { error: String(error) }));
    void handleImageContent(message, log).catch((error) =>
      log.error("falha no automod de imagem", { error: String(error) })
    );
    void recordTicketMessage(message).catch(() => undefined);
    void bump(message.guild.id, "messages").catch(() => undefined);
    void handleKnowledgeMessage(message, log).catch((error) =>
      log.error("falha na base de conhecimento", { error: String(error) })
    );
  });

  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    void recordMessageLog(message, "message_deleted", "Mensagem apagada", message.content ?? "(conteúdo indisponível)", log);
    void handleGhostPing(message, log).catch(() => undefined);
  });

  client.on(Events.MessageUpdate, (before, after) => {
    if (!after.guild || after.author?.bot) return;
    if (before.content === after.content) return;
    void recordMessageLog(after, "message_edited", "Mensagem editada", `**Antes:** ${before.content || "(vazio)"}\n**Depois:** ${after.content || "(vazio)"}`, log);
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void auditAndLog(member.guild, {
      module: "members", category: "members", eventType: "member_joined", targetId: member.id,
      title: "MEMBRO ENTROU", description: `<@${member.id}> entrou no servidor.`,
      fields: [{ name: "Conta criada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }],
    }, log);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void auditAndLog(member.guild, {
      module: "members", category: "members", eventType: "member_left", targetId: member.id,
      title: "MEMBRO SAIU", description: `<@${member.id}> saiu do servidor.`,
    }, log);
  });

  client.on(Events.GuildMemberUpdate, (before, after) => {
    const changes: string[] = [];
    if (before.nickname !== after.nickname) changes.push(`Apelido: ${before.nickname ?? "nenhum"} → ${after.nickname ?? "nenhum"}`);
    const oldRoles = new Set(before.roles.cache.keys());
    const newRoles = new Set(after.roles.cache.keys());
    const added = [...newRoles].filter((id) => !oldRoles.has(id));
    const removed = [...oldRoles].filter((id) => !newRoles.has(id));
    if (added.length) changes.push(`Cargos adicionados: ${added.map((id) => `<@&${id}>`).join(", ")}`);
    if (removed.length) changes.push(`Cargos removidos: ${removed.map((id) => `<@&${id}>`).join(", ")}`);
    if (!changes.length) return;
    void auditAndLog(after.guild, {
      module: "members", category: "members", eventType: "member_updated", targetId: after.id,
      title: "MEMBRO ATUALIZADO", description: `Alterações em <@${after.id}>.`,
      fields: [{ name: "Antes → depois", value: changes.join("\n").slice(0, 900) }],
    }, log);
  });

  client.on(Events.VoiceStateUpdate, (before, after) => {
    const guild = after.guild;
    const oldChannel = before.channel;
    const newChannel = after.channel;
    if (oldChannel?.id === newChannel?.id) return;
    const eventType = !oldChannel ? "voice_joined" : !newChannel ? "voice_left" : "voice_moved";
    const transition = !oldChannel ? `entrou em <#${newChannel!.id}>` : !newChannel ? `saiu de <#${oldChannel.id}>` : `moveu-se de <#${oldChannel.id}> para <#${newChannel.id}>`;
    void auditAndLog(guild, {
      module: "voice", category: "voice", eventType, targetId: after.id,
      title: "ATIVIDADE DE VOZ", description: `<@${after.id}> ${transition}.`,
      channelId: newChannel?.id ?? oldChannel?.id,
    }, log);
  });

  client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    void recordGatewayAudit(entry, guild, log).catch((error) =>
      log.warn("falha ao registrar evento do audit log", { guildId: guild.id, error: String(error) })
    );
  });

  // Sem anotacao de tipo: o evento ja carrega a assinatura correta, e
  // `GuildAuditLogEntryCreateAction` nao existe como export no discord.js.
  client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    void handleAuditLogEntry(guild, entry, log).catch(() => undefined);
  });

  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void (async () => {
      try {
        if (interaction.isChatInputCommand()) {
          await handleCommand(interaction, log);
          return;
        }
        if (interaction.isButton()) {
          await handleButton(interaction, log);
          return;
        }
        if (interaction.isStringSelectMenu()) {
          const parsed = parseId(interaction.customId);
          if (parsed?.kind === "form" && parsed.action === "pick") {
            await handleFormSelect(interaction, parsed.args[0] ?? "", log);
          } else if (parsed?.kind === "ticket" && parsed.action === "dept") {
            await handleDepartmentSelect(interaction, log);
          }
          return;
        }
        if (interaction.isModalSubmit()) {
          await handleModal(interaction, log);
        }
      } catch (error) {
        log.error("falha ao tratar interacao", {
          kind: interaction.type,
          error: String(error)
        });
        await respond(interaction, "Algo falhou do meu lado. A equipe foi avisada pelo log.");
      }
    })();
  });

  // SLA + fechamento automatico (vencimento e inatividade): um ciclo so,
  // porque os dois leem os mesmos tickets e um encerrado sai da conta do SLA.
  // Aproveita o mesmo ciclo para carga da equipe e digest — todos olham tickets.
  const slaTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await checkSla(guild, log).catch(() => 0);
        await checkOverload(guild, log).catch(() => 0);
        await maybeSendDigest(guild, log).catch(() => false);
      }
    })();
  }, SLA_INTERVAL_MS);

  // Poda: auditoria e estatisticas, para os arquivos nao crescerem para sempre.
  const pruneTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await pruneAudit(log, undefined, guild.id).catch(() => 0);
        await pruneStatistics(guild.id, log).catch(() => 0);
      }
    })();
  }, PRUNE_INTERVAL_MS);

  // Fila de saida: o painel pede, o bot publica. Roda a cada 20s porque e a
  // unica forma de "Publicar painel" na dashboard chegar a um canal de verdade
  // — o painel nao tem conexao com o gateway do Discord.
  const outboxTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await processOutbox(guild, log).catch(() => 0);
      }
    })();
  }, 20_000);

  // Uma passada logo apos conectar, para nao esperar o primeiro intervalo.
  client.once(Events.ClientReady, () => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await processOutbox(guild, log).catch(() => 0);
      }
    })();
  });

  // Inatividade da equipe roda uma vez por dia — nao precisa de mais que isso.
  const inactivityTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await checkInactivity(guild, log).catch(() => 0);
      }
    })();
  }, 24 * 60 * 60_000);

  const stop = async (): Promise<void> => {
    clearInterval(slaTimer);
    clearInterval(pruneTimer);
    clearInterval(inactivityTimer);
    clearInterval(outboxTimer);
    if (healthTimer) clearInterval(healthTimer);
    await reportHealth("offline").catch((error) => log.error("falha ao marcar bot offline", { error: String(error) }));
    await client.destroy();
    log.info("desconectado");
  };

  void client.login(token).catch((error) => {
    log.error("login falhou", { error: String(error) });
    process.exitCode = 1;
  });

  return { client, stop };
}

/**
 * Sobe o bot se houver token. Sem token o processo nao morre — quem sobe o
 * painel nao pode ser derrubado por falta de credencial do bot.
 */
export function startBot(token = process.env.DISCORD_TOKEN ?? process.env.WUMPUS_DISCORD_TOKEN, log: Logger = consoleLogger): BotHandle | null {
  if (!token) {
    log.info("sem token do Discord — bot nao iniciado");
    return null;
  }
  return createBot(token, log);
}

// Execucao direta: `node --experimental-strip-types src/bot/index.ts`
if (process.argv[1] && process.argv[1].endsWith("bot/index.ts")) {
  startBot();
}
