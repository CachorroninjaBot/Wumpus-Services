/**
 * Atendimento (tickets).
 *
 * O bot antigo mantinha `openTickets` num `Map()`: a cada restart o contador
 * zerava, `maxOpenPerUser` deixava de valer e o "ja tem atendimento aberto"
 * virava mentira. Nao havia historico, entao nao havia transcricao, metrica
 * nem contexto para a IA.
 *
 * Aqui o ticket e uma linha persistida e as mensagens ficam gravadas — o que
 * sustenta transcricao, SLA e analise.
 *
 * A matematica de SLA, fechamento automatico e transcricao mora em
 * `tickets-sla.ts` (pura, testavel); `tickets-metrics.ts` agrega por atendente
 * para o /stats, o plantao e o digest.
 */
import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type Message,
  type TextChannel
} from "discord.js";
import { bool, guildPlan, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { planAllows } from "../lib/wumpus/plan-features.ts";
import { id } from "./ids.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { buildPanelPayload, defaultButtons } from "./panels.ts";
import { resolveChannel, resolveRole, resolveRoles } from "./resolve.ts";
import { bump } from "./statistics.ts";
import { mutate, nextId, read } from "./store.ts";
import { generateTranscriptUrl } from "./transcript-api.ts";
import { autoCloseCandidate, buildTranscript, slaState, slaNotice } from "./tickets-sla.ts";

export type TicketStatus = "open" | "claimed" | "closed";

/** Mesmos niveis da dashboard (`lib/wumpus/types.ts`). */
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type Ticket = {
  id: number;
  guildId: string;
  channelId: string;
  openerId: string;
  subject?: string;
  department: string | null;
  status: TicketStatus;
  waitingOn?: "user" | "staff" | null;
  claimedBy: string | null;
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  /** Nivel de urgencia — mesmo vocabulario da dashboard. */
  priority: TicketPriority;
  /** Primeira resposta da equipe — base do SLA e das metricas por atendente. */
  firstResponseAt: string | null;
  firstRespondedBy: string | null;
  /** Ultima mensagem de qualquer um — base do fechamento por inatividade. */
  lastActivityAt: string;
  closeReason: string | null;
  feedback: { rating: number; comment: string | null } | null;
  feedbackAt: string | null;
  feedbackStaffId: string | null;
  /** Referência da cópia de transcript para aplicar a política de retenção. */
  transcriptChannelId?: string | null;
  transcriptMessageId?: string | null;
  /** URL hospedada pela API externa de transcripts, quando a retenção é ilimitada. */
  transcriptUrl?: string | null;
};

export type TicketMessage = {
  ticketId: number;
  authorId: string;
  authorName: string;
  content: string;
  at: string;
  internal?: boolean;
};

/** Atendimento ativo de um usuario. Tickets encerrados ou arquivados nao contam no limite. */
export async function openTicketFor(guildId: string, openerId: string): Promise<Ticket | null> {
  const rows = await read<Ticket>("tickets");
  return (
    rows.find(
      (row) => row.guildId === guildId && row.openerId === openerId && (row.status === "open" || row.status === "claimed")
    ) ?? null
  );
}

export async function getTicket(guildId: string, ticketId: number): Promise<Ticket | null> {
  const rows = await read<Ticket>("tickets");
  return rows.find((row) => row.guildId === guildId && row.id === ticketId) ?? null;
}

export async function getTicketMessages(ticketId: number): Promise<TicketMessage[]> {
  return (await read<TicketMessage>("ticket_messages")).filter((message) => message.ticketId === ticketId);
}

/** Grava a mensagem do canal de atendimento — base da transcricao e da IA. */
export async function recordTicketMessage(message: Message): Promise<void> {
  if (!message.guild || message.author.bot || !message.content) return;

  const rows = await read<Ticket>("tickets");
  const ticket = rows.find(
    (row) => row.guildId === message.guild!.id && row.channelId === message.channelId && row.status !== "closed"
  );
  if (!ticket) return;

  const at = new Date().toISOString();

  // Primeira resposta da equipe: o SLA mede ate aqui, nao ate o claim. Um
  // claim sem resposta nenhuma nao tira o ticket do estado de espera.
  const isStaff = ticket.claimedBy === message.author.id;
  let isStaffReply = isStaff;
  const member = message.member;
  if (ticket.waitingOn === "staff" && !isStaffReply && member) {
    const [ticketConfig, staffConfig] = await Promise.all([
      moduleConfig(message.guild.id, "tickets"),
      moduleConfig(message.guild.id, "staff"),
    ]);
    const staffRoles = resolveRoles(message.guild, [
      ...list(ticketConfig, "staffRoleIds"),
      ...list(staffConfig, "staffRoleIds"),
    ]);
    isStaffReply = member.permissions.has(PermissionFlagsBits.ManageGuild)
      || staffRoles.some((role) => member.roles.cache.has(role.id));
  }
  const firstResponse = isStaff && !ticket.firstResponseAt ? at : null;

  await mutate<Ticket>("tickets", (all) => {
    const row = all.find((entry) => entry.id === ticket.id && entry.guildId === ticket.guildId);
    if (!row) return all;
    row.lastActivityAt = at;
    if (
      (row.waitingOn === "user" && message.author.id === ticket.openerId) ||
      (row.waitingOn === "staff" && isStaffReply)
    ) row.waitingOn = null;
    if (firstResponse) {
      row.firstResponseAt = firstResponse;
      row.firstRespondedBy = message.author.id;
    }
    if (message.author.id === ticket.openerId && !row.subject) {
      row.subject = message.content.trim().slice(0, 80);
    }
    return all;
  });

  await mutate<TicketMessage>("ticket_messages", (messages) => {
    messages.push({
      ticketId: ticket.id,
      authorId: message.author.id,
      authorName: message.author.username,
      content: message.content.slice(0, 4000),
      at
    });
    return messages;
  });
}

/** Sends a dashboard reply through the bot and records it with the real staff identity. */
export async function sendTicketReply(
  guild: Guild,
  ticketId: number,
  actorId: string,
  content: string,
  log: Logger
): Promise<{ ok: boolean; error?: string }> {
  const ticket = await getTicket(guild.id, ticketId);
  if (!ticket || ticket.status === "closed") return { ok: false, error: "Este atendimento não está aberto." };
  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel?.isTextBased() || !("send" in channel)) return { ok: false, error: "O canal do atendimento não está disponível." };
  const member = await guild.members.fetch(actorId).catch(() => null);
  const authorName = member?.displayName ?? actorId;
  const at = new Date().toISOString();
  try {
    const safeAuthor = authorName.replace(/[*_]/g, "").replaceAll("`", "");
    await channel.send({ content: `**${safeAuthor}**: ${content.slice(0, 2000)}`, allowedMentions: { parse: [] } });
  } catch (error) {
    log.warn("falha ao responder atendimento pela dashboard", { guildId: guild.id, ticketId, error: String(error) });
    return { ok: false, error: "O Discord não aceitou a resposta neste canal." };
  }
  await mutate<TicketMessage>("ticket_messages", (rows) => {
    rows.push({ ticketId, authorId: actorId, authorName, content: content.slice(0, 2000), at });
    return rows;
  });
  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
    if (row) {
      row.lastActivityAt = at;
      row.waitingOn = null;
      if (row.claimedBy === actorId && !row.firstResponseAt) {
        row.firstResponseAt = at;
        row.firstRespondedBy = actorId;
      }
    }
    return rows;
  });
  return { ok: true };
}

/**
 * Abre um atendimento: cria o canal privado, persiste o ticket e publica o
 * cabecalho com os botoes. O canal so nasce depois da checagem de limite, para
 * nao deixar canal orfao quando o usuario ja tem um aberto.
 */
export async function openTicket(
  guild: Guild,
  userId: string,
  department: string | null,
  log: Logger,
  intakeAnswers: Array<{ question: string; answer: string }> = [],
): Promise<{ ok: true; ticket: Ticket; channelId: string } | { ok: false; error: string }> {
  const config = await moduleConfig(guild.id, "tickets");
  if (!config) return { ok: false, error: "O atendimento ainda nao foi configurado neste servidor." };
  if (!isEnabled(config)) return { ok: false, error: "O atendimento esta pausado neste servidor." };

  const maxOpen = Math.max(1, Math.trunc(num(config, "maxOpenPerUser", 1)));
  const mine = (await read<Ticket>("tickets")).filter(
    (row) => row.guildId === guild.id && row.openerId === userId && (row.status === "open" || row.status === "claimed")
  );
  if (mine.length >= maxOpen) {
    const existingChannel = mine[0]?.channelId;
    return {
      ok: false,
      error: existingChannel
        ? `Voce ja atingiu o limite de ${maxOpen} atendimento(s) aberto(s). Continue por <#${existingChannel}>.`
        : `Voce ja atingiu o limite de ${maxOpen} atendimento(s) aberto(s).`
    };
  }

  const departmentSettings = Array.isArray(config.departmentSettings)
    ? config.departmentSettings.find((entry) =>
        entry && typeof entry === "object" && "name" in entry
        && String((entry as { name?: unknown }).name).trim() === department
      ) as Record<string, unknown> | undefined
    : undefined;
  const departmentStaffIds = Array.isArray(departmentSettings?.staffRoleIds)
    ? departmentSettings.staffRoleIds.filter((roleId): roleId is string => typeof roleId === "string")
    : [];
  const staffRoles = resolveRoles(
    guild,
    departmentSettings?.inheritStaff === false ? departmentStaffIds : [...list(config, "staffRoleIds"), ...departmentStaffIds],
  );
  const category = resolveChannel(
    guild,
    typeof departmentSettings?.categoryId === "string" && departmentSettings.categoryId.trim()
      ? departmentSettings.categoryId
      : str(config, "categoryId"),
  );

  const pattern = str(config, "namingPattern", "atendimento-{user}");
  const username = (await guild.client.users.fetch(userId).catch(() => null))?.username ?? "membro";
  const departmentSlug = (department ?? "atendimento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  try {
    const ticketId = await nextId("tickets");
    const name = pattern
      .replace(/\{user\}/g, username)
      .replace(/\{department\}/g, departmentSlug)
      .replace(/\{number\}/g, String(ticketId))
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 90) || `atendimento-${username}`;
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category?.type === ChannelType.GuildCategory ? category.id : undefined,
      topic: `Atendimento de <@${userId}> · Wumpus`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        },
        {
          id: guild.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ]
        },
        ...staffRoles.map((role) => ({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ]
        }))
      ]
    });

    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: ticketId,
      guildId: guild.id,
      channelId: channel.id,
      openerId: userId,
      subject: intakeAnswers[0]?.answer.trim().slice(0, 80),
      department,
      status: "open",
      claimedBy: null,
      createdAt: now,
      claimedAt: null,
      closedAt: null,
      closedBy: null,
      priority: "normal",
      firstResponseAt: null,
      firstRespondedBy: null,
      lastActivityAt: now,
      closeReason: null,
      feedback: null,
      feedbackAt: null,
      feedbackStaffId: null
    };

    await mutate<Ticket>("tickets", (rows) => {
      rows.push(ticket);
      return rows;
    });
    await bump(guild.id, "tickets");

    const ping = bool(config, "pingStaffOnOpen", true) && staffRoles.length
      ? staffRoles.map((role) => `<@&${role.id}>`).join(" ")
      : "";

    await channel.send({
      content: [
        `<@${userId}> · atendimento **#${ticketId}**${department ? ` · **${department}**` : ""}`,
        ping
      ].filter(Boolean).join("\n"),
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 2, label: "Assumir", custom_id: id("ticket", "claim", ticketId) },
            { type: 2, style: 4, label: "Encerrar", custom_id: id("ticket", "close_reason", ticketId) },
            { type: 2, style: 2, label: "Transferir", custom_id: id("ticket", "transfer_pick", ticketId) },
            { type: 2, style: 2, emoji: { name: "⚙️" }, custom_id: id("ticket", "manage", ticketId) },
          ]
        }
      ]
    });

    for (const { question, answer } of intakeAnswers.slice(0, 5)) {
      const content = `**${question.slice(0, 45)}**\n${answer.slice(0, 1000)}`;
      try {
        await channel.send({ content, allowedMentions: { parse: [] } });
        await mutate<TicketMessage>("ticket_messages", (messages) => {
          messages.push({
            ticketId,
            authorId: userId,
            authorName: "Resposta inicial",
            content,
            at: new Date().toISOString(),
          });
          return messages;
        });
      } catch (error) {
        log.warn("falha ao registrar resposta inicial do ticket", {
          guildId: guild.id,
          ticketId,
          error: String(error).slice(0, 300),
        });
      }
    }

    const welcome = typeof departmentSettings?.welcomeMessage === "string" && departmentSettings.welcomeMessage.trim()
      ? departmentSettings.welcomeMessage.trim()
      : str(config, "welcomeMessage");
    if (welcome) await channel.send({ content: welcome.slice(0, 2000) }).catch(() => undefined);

    await auditAndLog(
      guild,
      {
        module: "tickets",
        category: "members",
        eventType: "ticket_opened",
        actorId: userId,
        channelId: channel.id,
        severity: "info",
        title: `ATENDIMENTO #${ticketId} ABERTO`,
        description: `<@${userId}> abriu um atendimento em <#${channel.id}>.`,
        accentColor: "#28655b",
        fields: [
          { name: "Departamento", value: department ?? "nao informado" },
          { name: "Canal", value: `<#${channel.id}>` }
        ]
      },
      log
    );

    log.info("atendimento aberto", { guildId: guild.id, ticketId, userId, department });
    return { ok: true, ticket, channelId: channel.id };
  } catch (error) {
    // O plano manda NAO engolir: log detalhado aqui, e a mensagem ao usuario
    // apenas aponta a causa mais comum — nunca um falso sucesso.
    log.error("falha ao abrir atendimento", {
      guildId: guild.id,
      userId,
      error: String(error).slice(0, 500)
    });
    return { ok: false, error: "Nao consegui criar o canal. Confira minhas permissoes de gerenciar canais." };
  }
}

/** Assume o atendimento. Idempotente: assumir de novo nao troca o responsavel. */
export async function claimTicket(
  guild: Guild,
  ticketId: number,
  staffId: string,
  log: Logger
): Promise<{ ok: boolean; alreadyBy?: string }> {
  let alreadyBy: string | undefined;
  let claimed = false;

  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
    if (!row || row.status === "closed") return rows;
    if (row.claimedBy) {
      alreadyBy = row.claimedBy;
      return rows;
    }
    row.claimedBy = staffId;
    row.claimedAt = new Date().toISOString();
    row.status = "claimed";
    row.waitingOn = null;
    claimed = true;
    return rows;
  });

  if (alreadyBy) return { ok: false, alreadyBy };
  if (!claimed) return { ok: false };

  await auditAndLog(
    guild,
    {
      module: "tickets",
      category: "members",
      eventType: "ticket_claimed",
      actorId: staffId,
      severity: "info",
      title: `ATENDIMENTO #${ticketId} ASSUMIDO`,
      description: `<@${staffId}> assumiu o atendimento **#${ticketId}**.`,
      accentColor: "#3ecf8e",
      fields: [{ name: "Atendente", value: `<@${staffId}>` }],
      data: { ticketId },
    },
    log
  );

  log.info("atendimento assumido", { guildId: guild.id, ticketId, staffId });
  return { ok: true };
}

export async function setTicketWaiting(
  guild: Guild,
  ticketId: number,
  actorId: string,
  waitingOn: "user" | "staff" | null,
  log: Logger,
): Promise<boolean> {
  let changed = false;
  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
    if (!row || row.status === "closed" || row.waitingOn === waitingOn) return rows;
    row.waitingOn = waitingOn;
    changed = true;
    return rows;
  });
  if (!changed) return false;

  const labels = { user: "aguardando usuário", staff: "aguardando equipe", none: "em atendimento" };
  const label = waitingOn ?? "none";
  await auditAndLog(guild, {
    module: "tickets",
    category: "members",
    eventType: "ticket_waiting_changed",
    actorId,
    severity: "info",
    title: `ATENDIMENTO #${ticketId} · ${labels[label].toUpperCase()}`,
    description: `<@${actorId}> marcou o atendimento como ${labels[label]}.`,
    data: { ticketId, waitingOn },
  }, log);
  return true;
}

export async function addTicketMember(
  guild: Guild,
  ticketId: number,
  actorId: string,
  memberId: string,
  log: Logger,
): Promise<{ ok: boolean; detail: string }> {
  const ticket = await getTicket(guild.id, ticketId);
  if (!ticket || ticket.status === "closed") return { ok: false, detail: "Este atendimento está encerrado ou não existe." };
  if (memberId === ticket.openerId) return { ok: false, detail: "A pessoa solicitante já tem acesso ao ticket." };
  const [channel, member] = await Promise.all([
    guild.channels.fetch(ticket.channelId).catch(() => null),
    guild.members.fetch(memberId).catch(() => null),
  ]);
  if (!channel?.isTextBased() || !("permissionOverwrites" in channel) || !member) {
    return { ok: false, detail: "Não encontrei o canal ou a pessoa selecionada." };
  }
  try {
    await channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    }, { reason: `Adicionado ao atendimento #${ticketId} por ${actorId}` });
    await auditAndLog(guild, {
      module: "tickets", category: "members", eventType: "ticket_member_added",
      actorId, targetId: member.id, channelId: ticket.channelId, severity: "info",
      title: `MEMBRO ADICIONADO AO ATENDIMENTO #${ticketId}`,
      description: `<@${actorId}> adicionou <@${member.id}> ao atendimento.`,
      data: { ticketId },
    }, log);
    return { ok: true, detail: `<@${member.id}> agora tem acesso ao atendimento.` };
  } catch (error) {
    log.warn("falha ao adicionar membro ao ticket", { guildId: guild.id, ticketId, memberId, error: String(error).slice(0, 250) });
    return { ok: false, detail: "O Discord não permitiu adicionar essa pessoa ao canal." };
  }
}

export async function removeTicketMember(
  guild: Guild,
  ticketId: number,
  actorId: string,
  memberId: string,
  log: Logger,
): Promise<{ ok: boolean; detail: string }> {
  const ticket = await getTicket(guild.id, ticketId);
  if (!ticket || ticket.status === "closed") return { ok: false, detail: "Este atendimento está encerrado ou não existe." };
  if (memberId === ticket.openerId || memberId === guild.client.user?.id) {
    return { ok: false, detail: "Não é possível remover o solicitante ou o bot do atendimento." };
  }
  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel?.isTextBased() || !("permissionOverwrites" in channel)) {
    return { ok: false, detail: "O canal deste atendimento não está disponível." };
  }
  const overwrite = channel.permissionOverwrites.cache.get(memberId);
  if (!overwrite || !overwrite.allow.has(PermissionFlagsBits.ViewChannel)) {
    return { ok: false, detail: "Essa pessoa não foi adicionada individualmente a este atendimento." };
  }
  try {
    await channel.permissionOverwrites.delete(memberId, `Removido do atendimento #${ticketId} por ${actorId}`);
    await auditAndLog(guild, {
      module: "tickets", category: "members", eventType: "ticket_member_removed",
      actorId, targetId: memberId, channelId: ticket.channelId, severity: "info",
      title: `MEMBRO REMOVIDO DO ATENDIMENTO #${ticketId}`,
      description: `<@${actorId}> removeu <@${memberId}> do atendimento.`,
      data: { ticketId },
    }, log);
    return { ok: true, detail: `O acesso de <@${memberId}> foi removido.` };
  } catch (error) {
    log.warn("falha ao remover membro do ticket", { guildId: guild.id, ticketId, memberId, error: String(error).slice(0, 250) });
    return { ok: false, detail: "O Discord não permitiu remover essa pessoa do canal." };
  }
}

export async function recordInternalTicketNote(
  guild: Guild,
  ticketId: number,
  actorId: string,
  content: string,
  log: Logger,
): Promise<{ ok: boolean; error?: string }> {
  const ticket = await getTicket(guild.id, ticketId);
  if (!ticket || ticket.status === "closed") return { ok: false, error: "Este atendimento não está aberto." };
  const authorName = await displayName(guild, actorId);
  await mutate<TicketMessage>("ticket_messages", (rows) => {
    rows.push({ ticketId, authorId: actorId, authorName, content: content.slice(0, 2000), at: new Date().toISOString(), internal: true });
    return rows;
  });
  await auditAndLog(guild, {
    module: "tickets", category: "members", eventType: "ticket_internal_note",
    actorId, channelId: ticket.channelId, severity: "info",
    title: `NOTA INTERNA · ATENDIMENTO #${ticketId}`,
    description: `${authorName} registrou uma nota interna.`,
    data: { ticketId },
  }, log);
  return { ok: true };
}

/** Transfere o responsável para outro membro que tenha um cargo da equipe. */
export async function transferTicket(
  guild: Guild,
  ticketId: number,
  actorId: string,
  targetStaffId: string,
  log: Logger
): Promise<{ ok: boolean; error?: string }> {
  const ticket = await getTicket(guild.id, ticketId);
  if (!ticket || ticket.status === "closed") return { ok: false, error: "Atendimento inexistente ou encerrado." };
  if (ticket.claimedBy === targetStaffId) return { ok: false, error: "Este atendente já está responsável pelo atendimento." };
  const [ticketConfig, staffConfig, target, actor] = await Promise.all([
    moduleConfig(guild.id, "tickets"),
    moduleConfig(guild.id, "staff"),
    guild.members.fetch(targetStaffId).catch(() => null),
    guild.members.fetch(actorId).catch(() => null),
  ]);
  const staffRoles = resolveRoles(guild, [...list(ticketConfig, "staffRoleIds"), ...list(staffConfig, "staffRoleIds")]);
  if (!target) return { ok: false, error: "Não encontrei esse membro no servidor." };
  if (!actor || (!actor.permissions.has(PermissionFlagsBits.ManageGuild) && !actor.roles.cache.some((role) => staffRoles.some((staffRole) => staffRole.id === role.id)))) {
    return { ok: false, error: "Somente a equipe configurada pode transferir atendimentos." };
  }
  if (!staffRoles.length || !target.roles.cache.some((role) => staffRoles.some((staffRole) => staffRole.id === role.id))) {
    return { ok: false, error: "A pessoa escolhida não possui um cargo de atendimento configurado." };
  }
  const transferredAt = new Date().toISOString();
  let changed = false;
  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
    if (!row || row.status === "closed") return rows;
    row.claimedBy = targetStaffId;
    row.claimedAt = transferredAt;
    row.status = "claimed";
    changed = true;
    return rows;
  });
  if (!changed) return { ok: false, error: "O atendimento foi encerrado antes da transferência." };
  const actorName = await displayName(guild, actorId);
  await auditAndLog(guild, {
    module: "tickets", category: "members", eventType: "ticket_transferred", actorId,
    targetId: targetStaffId, channelId: ticket.channelId, severity: "info",
    title: `ATENDIMENTO #${ticketId} TRANSFERIDO`,
    description: `${actorName} transferiu o atendimento para <@${targetStaffId}>.`,
    fields: [{ name: "Novo responsável", value: `<@${targetStaffId}>` }],
    data: { ticketId },
  }, log);
  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (channel?.isTextBased() && "send" in channel) await channel.send({ content: `Atendimento transferido para <@${targetStaffId}>.`, allowedMentions: { users: [targetStaffId], parse: [] } }).catch(() => undefined);
  log.info("atendimento transferido", { guildId: guild.id, ticketId, actorId, targetStaffId });
  return { ok: true };
}

/**
 * Encerra: grava a transcricao, avisa quem abriu e remove o canal.
 *
 * A transcricao e gravada ANTES de apagar o canal — o bot antigo apagava depois
 * de mandar, entao qualquer falha de envio perdia o historico para sempre.
 *
 * `actorId` resolve para nome no transcript; `reason` entra no aviso ao autor
 * e no registro de auditoria ("encerrado por inatividade", por exemplo).
 */
export async function closeTicket(
  guild: Guild,
  ticketId: number,
  actorId: string,
  log: Logger,
  reason: string | null = null
): Promise<{ ok: boolean; transcriptChannelId?: string; transcriptUrl?: string }> {
  const ticket = await getTicket(guild.id, ticketId);
  if (!ticket) return { ok: false };
  if (ticket.status === "closed") return { ok: false };

  const config = await moduleConfig(guild.id, "tickets");
  const messages = (await read<TicketMessage>("ticket_messages")).filter((row) => row.ticketId === ticketId && !row.internal);

  // Quem encerra e o atendente quando existe — "encerrado por: bot" nao ajuda
  // ninguem a ler o historico. O actor real fica no registro de auditoria.
  const closerName =
    ticket.claimedBy && ticket.claimedBy !== actorId
      ? await displayName(guild, ticket.claimedBy)
      : await displayName(guild, actorId);

  const transcript = buildTranscript({
    ticket: {
      id: ticket.id,
      createdAt: ticket.createdAt,
      department: ticket.department,
      claimedBy: ticket.claimedBy ? await displayName(guild, ticket.claimedBy) : null,
      closedBy: closerName,
      closedAt: new Date().toISOString()
    },
    guildName: guild.name,
    messages
  });

  const plan = await guildPlan(guild.id);
  const canExportTranscript = Boolean(plan && planAllows(plan, "transcripts"));
  const transcriptChannel = canExportTranscript
    ? resolveChannel(guild, str(config, "transcriptChannelId"))
    : null;
  let transcriptChannelId: string | undefined;
  let transcriptUrl: string | undefined;

  if (canExportTranscript && num(config, "ticketMessageRetentionDays", 0) <= 0) {
    try {
      transcriptUrl = await generateTranscriptUrl(ticket.channelId);
      await mutate<Ticket>("tickets", (rows) => {
        const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
        if (row) row.transcriptUrl = transcriptUrl;
        return rows;
      });
      log.info("transcript externo gerado", { guildId: guild.id, ticketId, channelId: ticket.channelId });
    } catch (error) {
      log.warn("falha ao gerar transcript externo; usando exportacao local", {
        guildId: guild.id,
        ticketId,
        error: String(error).slice(0, 250)
      });
    }
  } else if (canExportTranscript && num(config, "ticketMessageRetentionDays", 0) > 0) {
    log.info("transcript externo ignorado para respeitar a retencao configurada", {
      guildId: guild.id,
      ticketId,
      retentionDays: num(config, "ticketMessageRetentionDays", 0)
    });
  }

  if (canExportTranscript && transcriptChannel?.isTextBased()) {
    try {
      const transcriptMessage = await transcriptChannel.send(transcriptUrl
        ? { content: `Transcrição do atendimento **#${ticketId}**: ${transcriptUrl}` }
        : {
            content: `Transcricao local do atendimento **#${ticketId}** (${messages.length} mensagem(ns))`,
            files: [{ attachment: Buffer.from(transcript, "utf8"), name: `atendimento-${ticketId}.txt` }]
          });
      transcriptChannelId = transcriptChannel.id;
      await mutate<Ticket>("tickets", (rows) => {
        const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
        if (row) {
          row.transcriptChannelId = transcriptChannel.id;
          row.transcriptMessageId = transcriptMessage.id;
        }
        return rows;
      });
    } catch (error) {
      log.warn("falha ao publicar transcript", { guildId: guild.id, ticketId, error: String(error).slice(0, 250) });
    }
  }

  const closedAt = new Date().toISOString();

  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
    if (row) {
      row.status = "closed";
      row.closedAt = closedAt;
      row.closedBy = actorId;
      row.closeReason = reason;
      if (ticket.firstResponseAt) row.firstResponseAt = ticket.firstResponseAt;
      row.lastActivityAt = ticket.lastActivityAt || closedAt;
    }
    return rows;
  });

  // Feedback na DM: so quando o modulo pede e o canal ainda existe.
  if (bool(config, "feedbackEnabled", true)) {
    try {
      const user = await guild.client.users.fetch(ticket.openerId);
      const rows: unknown[] = [
        {
          type: 1,
          components: [1, 2, 3, 4, 5].map((rating) => ({
            type: 2,
            style: rating >= 4 ? 3 : 2,
            label: String(rating),
            custom_id: id("ticket", "rate", ticketId, rating)
          }))
        }
      ];
      // Reabrir na DM: o canal do atendimento anterior sera apagado, entao a
      // reabertura cria um canal novo — o handler leva o historico antigo.
      if (bool(config, "reopenEnabled", true)) {
        rows.push({
          type: 1,
          components: [
            { type: 2, style: 2, label: "Reabrir atendimento", custom_id: id("ticket", "reopen", ticketId) }
          ]
        });
      }
      await user.send({
        content: [
          `Seu atendimento **#${ticketId}** em **${guild.name}** foi encerrado. Como foi o suporte?`,
          reason ? `Motivo: ${reason}` : ""
        ].filter(Boolean).join("\n"),
        components: rows
      } as never);
    } catch {
      // DM fechada: o feedback simplesmente nao acontece.
    }
  }

  await auditAndLog(
    guild,
    {
      module: "tickets",
      category: "members",
      eventType: "ticket_closed",
      actorId,
      channelId: ticket.channelId,
      severity: "info",
      title: `ATENDIMENTO #${ticketId} ENCERRADO`,
      description: `<@${actorId}> encerrou o atendimento de <@${ticket.openerId}>.`,
      accentColor: "#28655b",
      fields: [
        { name: "Mensagens", value: String(messages.length) },
        {
          name: "Transcricao",
          value: transcriptUrl ?? (transcriptChannelId ? `<#${transcriptChannelId}>` : "nao configurada")
        },
        { name: "Atendente", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "ninguem assumiu" },
        ...(reason ? [{ name: "Motivo", value: reason.slice(0, 1000) }] : [])
      ],
      data: { ticketId }
    },
    log
  );

  const channel = guild.channels.cache.get(ticket.channelId);
  if (channel && channel.isTextBased()) {
    await (channel as TextChannel).send({ content: "Encerrando em 5 segundos…" }).catch(() => undefined);
    setTimeout(() => void channel.delete("atendimento encerrado").catch(() => undefined), 5_000);
  }

  log.info("atendimento encerrado", {
    guildId: guild.id,
    ticketId,
    actorId,
    messages: messages.length,
    reason: reason ?? "sem motivo"
  });
  return { ok: true, transcriptChannelId, transcriptUrl };
}

/** Remove conteúdo de atendimentos encerrados conforme a retenção definida pelo servidor.
 * Metadados do ticket são mantidos para estatísticas; cópias de transcript conhecidas
 * também são apagadas do Discord antes de remover as mensagens persistidas.
 */
export async function pruneTicketContent(guild: Guild, log: Logger): Promise<number> {
  const config = await moduleConfig(guild.id, "tickets");
  const retentionDays = num(config, "ticketMessageRetentionDays", 0);
  if (retentionDays <= 0) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60_000;
  const eligible = (await read<Ticket>("tickets")).filter((ticket) => ticket.guildId === guild.id && ticket.status === "closed" && ticket.closedAt && Date.parse(ticket.closedAt) <= cutoff);
  if (!eligible.length) return 0;
  const ticketIds: number[] = [];
  for (const ticket of eligible) {
    if (ticket.transcriptChannelId && ticket.transcriptMessageId) {
      const channel = await guild.channels.fetch(ticket.transcriptChannelId).catch((error: { code?: number }) => {
        if (error?.code === 10003) return null; // Canal já foi removido no Discord.
        log.warn("retenção do ticket aguardando acesso ao canal de transcript", { guildId: guild.id, ticketId: ticket.id, error: String(error).slice(0, 250) });
        return undefined;
      });
      if (channel === undefined) continue;
      if (channel && channel.isTextBased() && "messages" in channel) {
        try {
          const message = await channel.messages.fetch(ticket.transcriptMessageId);
          await message.delete();
        } catch (error) {
          if ((error as { code?: number })?.code !== 10008) {
            log.warn("retenção do ticket aguardando exclusão do transcript", { guildId: guild.id, ticketId: ticket.id, error: String(error).slice(0, 250) });
            continue;
          }
        }
      } else if (channel) {
        log.warn("retenção do ticket aguardando um canal de texto para o transcript", { guildId: guild.id, ticketId: ticket.id });
        continue;
      }
    }
    ticketIds.push(ticket.id);
  }
  if (!ticketIds.length) return 0;
  const remove = new Set(ticketIds);
  await mutate<TicketMessage>("ticket_messages", (rows) => rows.filter((message) => !remove.has(message.ticketId)));
  await mutate<Ticket>("tickets", (rows) => rows.map((ticket) => remove.has(ticket.id) && ticket.guildId === guild.id
    ? { ...ticket, transcriptMessageId: null, transcriptChannelId: null }
    : ticket));
  log.info("conteúdo antigo de tickets removido", { guildId: guild.id, count: ticketIds.length, retentionDays });
  return ticketIds.length;
}

/** Nome de exibicao do transcript — texto, nao mencao. Nunca lanca. */
async function displayName(guild: Guild, userId: string): Promise<string> {
  try {
    const member = await guild.members.fetch(userId);
    return member.displayName || member.user.username;
  } catch {
    const user = await guild.client.users.fetch(userId).catch(() => null);
    return user?.username ?? userId;
  }
}

/** Registra a nota de satisfacao vinda da DM. */
export async function recordFeedback(
  guildId: string,
  ticketId: number,
  rating: number,
  log: Logger
): Promise<boolean> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return false;
  let found = false;

  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guildId && entry.id === ticketId);
    if (row?.status === "closed" && !row.feedback) {
      row.feedback = { rating, comment: null };
      row.feedbackAt = new Date().toISOString();
      row.feedbackStaffId = row.claimedBy;
      found = true;
    }
    return rows;
  });

  if (found) log.info("feedback registrado", { guildId, ticketId, rating });
  return found;
}

/**
 * SLA e fechamento automatico — um ciclo so, porque os dois leem os mesmos
 * tickets e um ticket fechado por inatividade sai da conta do SLA.
 *
 * O alerta NUNCA muda o ticket: antes ele fingia um claim para nao repetir
 * (mentia "assumido" no painel, roubava o ticket de quem fosse assumir e
 * escondia o estouro para sempre). A repeticao e evitada por registros em
 * `counters`, com reagendamento em `warning` e `breach`.
 */
export async function checkSla(guild: Guild, log: Logger): Promise<number> {
  const config = await moduleConfig(guild.id, "tickets");
  if (!isEnabled(config)) return 0;

  const slaMinutes = Math.trunc(num(config, "slaWarningMinutes", 0));

  const escalationRole = resolveRole(guild, str(config, "escalationRoleId"));
  const autoInactiveHours = Math.trunc(num(config, "autoCloseInactiveHours", 0));
  const autoMaxHours = Math.trunc(num(config, "closeAfterHours", 0));
  const now = Date.now();

  const rows = await read<Ticket>("tickets");
  const mine = rows.filter(
    (row) => row.guildId === guild.id && (row.status === "open" || row.status === "claimed")
  );
  if (!mine.length) return 0;

  const escPing = escalationRole ? `<@&${escalationRole.id}> ` : "";
  let notified = 0;

  for (const ticket of mine) {
    // Fechamento automatico: vencimento total primeiro, depois inatividade.
    const overdue = autoCloseCandidate(
      { ...ticket, lastActivityAt: ticket.lastActivityAt || ticket.createdAt },
      autoInactiveHours,
      autoMaxHours,
      now
    );

    if (overdue) {
      const hours = overdue === "expired"
        ? (now - Date.parse(ticket.createdAt)) / 3_600_000
        : (now - Date.parse(ticket.lastActivityAt || ticket.createdAt)) / 3_600_000;
      const reason =
        overdue === "expired"
          ? `Encerrado automaticamente: aberto ha ${Math.round(hours)}h, acima do limite de ${autoMaxHours}h.`
          : `Encerrado automaticamente: ${Math.round(hours)}h sem nenhuma mensagem.`;

      const result = await closeTicket(guild, ticket.id, guild.client.user!.id, log, reason);
      if (result.ok) {
        log.info("atendimento encerrado automaticamente", {
          guildId: guild.id,
          ticketId: ticket.id,
          cause: overdue,
          hours: Math.round(hours)
        });
      }
      continue;
    }

    const state = slaState(
      { ...ticket, lastActivityAt: ticket.lastActivityAt || ticket.createdAt },
      slaMinutes,
      now
    );
    if (state === "ok") continue;

    const mark = `sla:${guild.id}:${ticket.id}:${state}`;
    const fresh = await markOnce(mark, now);
    if (!fresh) continue;

    // Em `breach` o ping vai DENTRO do canal de atendimento: quem dorme no
    // ponto e o atendente, nao quem monitora o canal de logs.
    const notify = escalationRole ? guild.channels.cache.get(ticket.channelId) : null;

    if (notify && notify.isTextBased()) {
      await (notify as TextChannel)
        .send({
          content: `${escPing}${slaNotice(ticket, state, slaMinutes)}\nCanal: <#${ticket.channelId}>`
        })
        .catch(() => undefined);
    }

    await auditAndLog(
      guild,
      {
        module: "tickets",
        category: "members",
        eventType: state === "breach" ? "ticket_sla_breach" : "ticket_sla_warning",
        channelId: ticket.channelId,
        severity: state === "breach" ? "critical" : "warning",
        title: `SLA ${state === "breach" ? "ESTOURADO" : "EM ALERTA"} · #${ticket.id}`,
        description: slaNotice(ticket, state, slaMinutes),
        accentColor: state === "breach" ? "#e5484d" : "#f5a524",
        fields: [
          { name: "Canal", value: `<#${ticket.channelId}>` },
          { name: "Meta", value: `${slaMinutes} min` },
          ...(escalationRole ? [{ name: "Escalonado para", value: `<@&${escalationRole.id}>` }] : [])
        ]
      },
      log
    );

    notified += 1;
  }

  return notified;
}

/**
 * Marca "ja avisei" para um par ticket/estado, com TTL.
 *
 * Sem isto, um estado dispara a cada ciclo — e o que o codigo antigo evitava
 * MUDANDO o ticket (fingir claim). O alerta deve ser observacao, nunca efeito.
 */
async function markOnce(mark: string, now: number): Promise<boolean> {
  let fresh = true;

  await mutate<{ key: string; value: number }>("counters", (rows) => {
    const row = rows.find((entry) => entry.key === mark);
    if (row) {
      // Reavisa no maximo a cada 24h no mesmo nivel — atencao persistente sem
      // virar spam a cada 5 minutos.
      fresh = now - row.value >= 24 * 60 * 60_000;
      if (fresh) row.value = now;
      return rows;
    }
    rows.push({ key: mark, value: now });
    fresh = true;
    return rows;
  });

  return fresh;
}

/**
 * Muda a prioridade do atendimento.
 *
 * Validado contra os quatro niveis da dashboard, para um custom_id montado a
 * mao nao gravar valor que a interface nao reconheca. Deixa rastro no canal —
 * quem le o ticket precisa ver a mudanca, nao so o estado interno.
 */
export async function setTicketPriority(
  guild: Guild,
  ticketId: number,
  priority: string,
  actorId: string,
  log: Logger
): Promise<boolean> {
  const allowed = new Set(["low", "normal", "high", "urgent"]);
  // Set.has nao estreia o tipo: o cast e o que garante o nivel da dashboard.
  const wanted: TicketPriority = allowed.has(priority) ? (priority as TicketPriority) : "normal";

  let changed = false;

  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guild.id && entry.id === ticketId);
    if (row && row.status !== "closed" && row.priority !== wanted) {
      row.priority = wanted;
      changed = true;
    }
    return rows;
  });

  if (!changed) return false;

  const ticket = await getTicket(guild.id, ticketId);
  const channel = ticket ? guild.channels.cache.get(ticket.channelId) : null;
  if (channel && channel.isTextBased()) {
    await (channel as TextChannel)
      .send({ content: `Prioridade alterada para **${wanted}** por <@${actorId}>.` })
      .catch(() => undefined);
  }

  await auditAndLog(
    guild,
    {
      module: "tickets",
      category: "members",
      eventType: "ticket_priority_changed",
      actorId,
      channelId: ticket?.channelId,
      severity: "info",
      title: `PRIORIDADE · #${ticketId}`,
      description: `<@${actorId}> mudou a prioridade para **${wanted}**.`,
      accentColor: "#f5a524",
      fields: [{ name: "Nova prioridade", value: wanted }],
      data: { ticketId, priority: wanted }
    },
    log
  );

  log.info("prioridade alterada", { guildId: guild.id, ticketId, priority: wanted, actorId });
  return true;
}

/**
 * Reabre um atendimento encerrado: cria um canal novo com o transcript do
 * anterior anexado. O ticket antigo permanece encerrado — historico e metricas
 * ficam intactos; o reaberto e um ticket novo que aponta para o antigo.
 */
export async function reopenClosedTicket(
  guild: Guild,
  ticketId: number,
  actorId: string,
  log: Logger
): Promise<{ ok: true; channelId: string } | { ok: false; error: string }> {
  const config = await moduleConfig(guild.id, "tickets");
  if (!config || !isEnabled(config)) {
    return { ok: false, error: "O atendimento esta pausado neste servidor." };
  }

  const previous = await getTicket(guild.id, ticketId);
  if (!previous || previous.status !== "closed") {
    return { ok: false, error: "Este atendimento nao esta encerrado ou nao existe." };
  }

  // openTicket aplica TODAS as regras de sempre: limite por usuario,
  // namingPattern, categoria, permissoes, ping de staff e auditoria.
  const opened = await openTicket(guild, previous.openerId, previous.department, log);
  if (!opened.ok) return opened;

  await auditAndLog(
    guild,
    {
      module: "tickets",
      category: "members",
      eventType: "ticket_reopened",
      actorId,
      channelId: opened.channelId,
      severity: "info",
      title: `ATENDIMENTO #${opened.ticket.id} REABERTO`,
      description: `<@${actorId}> reabriu o atendimento **#${ticketId}** como **#${opened.ticket.id}**.`,
      accentColor: "#3ecf8e",
      fields: [
        { name: "Original", value: `#${ticketId}` },
        { name: "Novo canal", value: `<#${opened.channelId}>` }
      ],
      data: { ticketId: opened.ticket.id, reopenedFromTicketId: ticketId }
    },
    log
  );

  // Só planos com transcrição exportam o histórico anterior como anexo.
  const plan = await guildPlan(guild.id);
  const includeTranscript = Boolean(plan && planAllows(plan, "transcripts"));
  if (!includeTranscript) {
    log.info("reabertura sem exportar transcrição pelo plano", { guildId: guild.id, ticketId });
  }

  // O histórico é exportado como anexo apenas quando o plano inclui transcrições.
  const messages = (await read<TicketMessage>("ticket_messages")).filter((row) => row.ticketId === ticketId && !row.internal);
  const transcript = buildTranscript({
    ticket: {
      id: ticketId,
      createdAt: previous.createdAt,
      department: previous.department,
      claimedBy: previous.claimedBy,
      closedBy: previous.closedBy,
      closedAt: previous.closedAt
    },
    guildName: guild.name,
    messages
  });

  const channel = guild.channels.cache.get(opened.channelId);
  if (includeTranscript && channel && channel.isTextBased()) {
    await (channel as TextChannel).send(previous.transcriptUrl
      ? { content: `**Histórico do atendimento #${ticketId}:** ${previous.transcriptUrl}` }
      : {
          content: `**Reaberto do atendimento #${ticketId}** — historico em anexo.`,
          files: [{ attachment: Buffer.from(transcript, "utf8"), name: `atendimento-${ticketId}.txt` }]
        }).catch(() => undefined);
  }

  log.info("atendimento reaberto", { guildId: guild.id, from: ticketId, to: opened.ticket.id, actorId });
  return { ok: true, channelId: opened.channelId };
}

/** Painel publicavel do modulo de atendimento. */
export async function buildTicketPanel(guild: Guild) {
  const config = await moduleConfig(guild.id, "tickets");
  const departments = list(config, "departments");

  return buildPanelPayload({
    title: str(config, "panelTitle", "Central de atendimento"),
    description: [
      str(config, "panelDescription", "Abra um atendimento privado e fale com a equipe."),
      departments.length ? `\nDepartamentos: ${departments.join(" · ")}` : ""
    ].join(""),
    accentColor: str(config, "panelAccentColor", "#28655b"),
    buttons: defaultButtons("tickets", config ?? undefined)
  });
}
