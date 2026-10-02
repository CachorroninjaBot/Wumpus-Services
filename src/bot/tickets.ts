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
import { bool, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { id } from "./ids.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { buildPanelPayload } from "./panels.ts";
import { resolveChannel, resolveRole, resolveRoles } from "./resolve.ts";
import { mutate, nextId, read } from "./store.ts";
import { autoCloseCandidate, buildTranscript, slaState, slaNotice } from "./tickets-sla.ts";

export type TicketStatus = "open" | "claimed" | "closed";

/** Mesmos niveis da dashboard (`lib/wumpus/types.ts`). */
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type Ticket = {
  id: number;
  guildId: string;
  channelId: string;
  openerId: string;
  department: string | null;
  status: TicketStatus;
  claimedBy: string | null;
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  /** Nivel de urgencia — mesmo vocabulario da dashboard. */
  priority: TicketPriority;
  /** Primeira resposta da equipe — base do SLA e das metricas por atendente. */
  firstResponseAt: string | null;
  /** Ultima mensagem de qualquer um — base do fechamento por inatividade. */
  lastActivityAt: string;
  closeReason: string | null;
  feedback: { rating: number; comment: string | null } | null;
};

export type TicketMessage = {
  ticketId: number;
  authorId: string;
  authorName: string;
  content: string;
  at: string;
};

/** Atendimento aberto ou assumido de um usuario — usado para barrar o segundo. */
export async function openTicketFor(guildId: string, openerId: string): Promise<Ticket | null> {
  const rows = await read<Ticket>("tickets");
  return (
    rows.find(
      (row) => row.guildId === guildId && row.openerId === openerId && row.status !== "closed"
    ) ?? null
  );
}

export async function getTicket(guildId: string, ticketId: number): Promise<Ticket | null> {
  const rows = await read<Ticket>("tickets");
  return rows.find((row) => row.guildId === guildId && row.id === ticketId) ?? null;
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
  const firstResponse = isStaff && !ticket.firstResponseAt ? at : null;

  await mutate<Ticket>("tickets", (all) => {
    const row = all.find((entry) => entry.id === ticket.id && entry.guildId === ticket.guildId);
    if (!row) return all;
    row.lastActivityAt = at;
    if (firstResponse) row.firstResponseAt = firstResponse;
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

/**
 * Abre um atendimento: cria o canal privado, persiste o ticket e publica o
 * cabecalho com os botoes. O canal so nasce depois da checagem de limite, para
 * nao deixar canal orfao quando o usuario ja tem um aberto.
 */
export async function openTicket(
  guild: Guild,
  userId: string,
  department: string | null,
  log: Logger
): Promise<{ ok: true; ticket: Ticket; channelId: string } | { ok: false; error: string }> {
  const config = await moduleConfig(guild.id, "tickets");
  if (!config) return { ok: false, error: "O atendimento ainda nao foi configurado neste servidor." };
  if (!isEnabled(config)) return { ok: false, error: "O atendimento esta pausado neste servidor." };

  const existing = await openTicketFor(guild.id, userId);
  if (existing) {
    return { ok: false, error: `Voce ja tem um atendimento aberto: <#${existing.channelId}>` };
  }

  const maxOpen = Math.max(1, Math.trunc(num(config, "maxOpenPerUser", 1)));
  const mine = (await read<Ticket>("tickets")).filter(
    (row) => row.guildId === guild.id && row.openerId === userId && row.status !== "closed"
  );
  if (mine.length >= maxOpen) {
    return { ok: false, error: `Voce ja atingiu o limite de ${maxOpen} atendimento(s) aberto(s).` };
  }

  const staffRoles = resolveRoles(guild, list(config, "staffRoleIds"));
  const category = resolveChannel(guild, str(config, "categoryId"));

  const pattern = str(config, "namingPattern", "atendimento-{user}");
  const username = (await guild.client.users.fetch(userId).catch(() => null))?.username ?? "membro";
  const name = pattern
    .replace(/\{user\}/g, username)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90) || `atendimento-${username}`;

  try {
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

    const ticketId = await nextId("tickets");
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: ticketId,
      guildId: guild.id,
      channelId: channel.id,
      openerId: userId,
      department,
      status: "open",
      claimedBy: null,
      createdAt: now,
      claimedAt: null,
      closedAt: null,
      closedBy: null,
      priority: "normal",
      firstResponseAt: null,
      lastActivityAt: now,
      closeReason: null,
      feedback: null
    };

    await mutate<Ticket>("tickets", (rows) => {
      rows.push(ticket);
      return rows;
    });

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
            { type: 2, style: 4, label: "Encerrar", custom_id: id("ticket", "close", ticketId) },
            ...(
              bool(config, "priorityEnabled", true)
                ? [
                    { type: 2, style: 2, label: "Prioridade", custom_id: id("ticket", "prio", ticketId, "high") },
                    { type: 2, style: 2, label: "Urgente", custom_id: id("ticket", "prio", ticketId, "urgent") }
                  ]
                : []
            )
          ]
        }
      ]
    });

    const welcome = str(config, "welcomeMessage");
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
        accentColor: "#7c5cff",
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
      fields: [{ name: "Atendente", value: `<@${staffId}>` }]
    },
    log
  );

  log.info("atendimento assumido", { guildId: guild.id, ticketId, staffId });
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
): Promise<{ ok: boolean; transcriptChannelId?: string }> {
  const ticket = await getTicket(guild.id, ticketId);
  if (!ticket) return { ok: false };
  if (ticket.status === "closed") return { ok: false };

  const config = await moduleConfig(guild.id, "tickets");
  const messages = (await read<TicketMessage>("ticket_messages")).filter((row) => row.ticketId === ticketId);

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

  const transcriptChannel = resolveChannel(guild, str(config, "transcriptChannelId"));
  let transcriptChannelId: string | undefined;

  if (transcriptChannel && transcriptChannel.isTextBased()) {
    try {
      await transcriptChannel.send({
        content: `Transcricao do atendimento **#${ticketId}** (${messages.length} mensagem(ns))`,
        files: [
          {
            attachment: Buffer.from(transcript, "utf8"),
            name: `atendimento-${ticketId}.txt`
          }
        ]
      });
      transcriptChannelId = transcriptChannel.id;
    } catch (error) {
      log.warn("falha ao publicar transcricao", { guildId: guild.id, ticketId, error: String(error) });
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
      accentColor: "#7c5cff",
      fields: [
        { name: "Mensagens", value: String(messages.length) },
        { name: "Transcricao", value: transcriptChannelId ? `<#${transcriptChannelId}>` : "nao configurada" },
        { name: "Atendente", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "ninguem assumiu" },
        ...(reason ? [{ name: "Motivo", value: reason.slice(0, 1000) }] : [])
      ]
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
  return { ok: true, transcriptChannelId };
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
  let found = false;

  await mutate<Ticket>("tickets", (rows) => {
    const row = rows.find((entry) => entry.guildId === guildId && entry.id === ticketId);
    if (row) {
      row.feedback = { rating, comment: null };
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
  if (slaMinutes <= 0) return 0;

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
      fields: [{ name: "Nova prioridade", value: wanted }]
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
      ]
    },
    log
  );

  // O historico anterior viaja como anexo — texto puro, nao depende do canal
  // antigo (ja apagado) nem do teto de caracteres de mensagem.
  const messages = (await read<TicketMessage>("ticket_messages")).filter((row) => row.ticketId === ticketId);
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
  if (channel && channel.isTextBased()) {
    await (channel as TextChannel)
      .send({
        content: `**Reaberto do atendimento #${ticketId}** — historico em anexo.`,
        files: [{ attachment: Buffer.from(transcript, "utf8"), name: `atendimento-${ticketId}.txt` }]
      })
      .catch(() => undefined);
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
    accentColor: str(config, "panelAccentColor", "#7c5cff"),
    buttons: [{ label: "Abrir atendimento", customId: id("ticket", "open"), style: 1, emoji: "🎫" }]
  });
}
