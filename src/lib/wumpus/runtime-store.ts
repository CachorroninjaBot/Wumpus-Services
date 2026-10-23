/**
 * Ponte painel -> bot.
 *
 * O bot roda em outro processo e le `data/wumpus-runtime.json`. Estas server
 * functions sao o unico caminho pelo qual o painel escreve esse arquivo.
 *
 * Estavam definidas e sem nenhum chamador: o painel salvava so no localStorage
 * e o bot nunca via configuracao alguma. Era isso que tornava todo campo da
 * dashboard decorativo.
 *
 * O acesso a disco vive em `runtime.server.ts` (server-only); aqui ficam apenas
 * os wrappers chamaveis pelo cliente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enqueueOutbox, readBotCollection, readRuntime, writeRuntime, type BotTicketMessage, type BotTicketRecord, type OutboxJob } from "./runtime.server";
import { requireGuildAccess } from "./session";
import { publishInputSchema } from "./runtime-validation";
import { SESSION_TOKEN_MAX_LENGTH } from "./session-token";

export type { RuntimeFile, RuntimeGuild, RuntimeArticle, OutboxJob } from "./runtime.server";

/** Payload de config de um servidor: `{ modulo: { ...campos, enabled } }`. */
export type PublishInput = {
  token: string;
  guildId: string;
  name?: string;
  modules: Record<string, Record<string, unknown>>;
  /** Base de conhecimento daquele servidor. */
  articles?: Array<{ id: string; title: string; body: string; tags: string[]; approved: boolean }>;
};

export const publishGuildRuntime = createServerFn({ method: "POST" })
  .validator((input: unknown) => publishInputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const current = await readRuntime();

    current.guilds[data.guildId] = {
      ...current.guilds[data.guildId],
      ...data.modules,
      ...(data.name ? { name: data.name } : {})
    };

    // Os artigos viajam junto: sem eles o modulo de conhecimento nao teria o
    // que buscar, e cairia no mesmo defeito de leitor sem escritor.
    if (data.articles) {
      current.articles = { ...current.articles, [data.guildId]: data.articles };
    }

    current.updatedAt = Date.now();

    await writeRuntime(current);
    return { ok: true as const, updatedAt: current.updatedAt };
  });

/**
 * Leitura do runtime pelo painel: NAO existe de proposito.
 *
 * Duas razoes concretas, ambas descobertas tentando:
 *   - uma funcao comum nao pode importar `*.server.*` — o import-protection do
 *     TanStack barra no bundle do cliente (so `createServerFn` atravessa);
 *   - `Record<string, unknown>` nao passa no validador de serializacao dele.
 *
 * E nao faz falta: quem le o runtime e o bot, direto do disco. Se um dia o
 * painel precisar, o caminho e declarar um tipo serializavel de verdade.
 */

/**
 * Pede ao bot que publique um painel num canal de verdade.
 *
 * Isto substitui o `publishPanel` antigo, que so escrevia um registro no estado
 * local da dashboard: a tela dizia "publicado" e nada chegava ao Discord.
 *
 * Aqui o pedido vai para o arquivo que o bot le. Quem publica de fato e o bot,
 * porque e ele que tem conexao com o gateway — o painel roda em outro processo.
 */
export const requestPanelPublish = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    target: z.enum(["tickets", "forms"]),
    channelRef: z.string().trim().min(1).max(100),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const job: OutboxJob = {
      id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      guildId: data.guildId,
      kind: "panel",
      target: data.target,
      channelRef: data.channelRef,
      createdAt: Date.now(),
      status: "queued"
    };

    await enqueueOutbox(job);
    return { ok: true as const, jobId: job.id };
  });

/**
 * Status das publicacoes recentes de um servidor.
 *
 * Existe para o painel parar de mentir: antes ele mostrava "publicado" no
 * instante do clique, sem nada ter chegado ao Discord. Aqui o usuario ve o que
 * o BOT fez de fato — incluindo o motivo da falha, quando falha.
 *
 * Devolve apenas campos serializaveis: o validador do TanStack recusa
 * `Record<string, unknown>` cru.
 */
export type PublishStatus = {
  id: string;
  target: string;
  channelRef: string;
  status: "queued" | "done" | "failed";
  detail?: string;
  channelId?: string;
  messageId?: string;
  createdAt: number;
  at?: number;
};

export const getPublishStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
  }).strict().parse(input))
  .handler(async ({ data }): Promise<PublishStatus[]> => {
    await requireGuildAccess(data.token, data.guildId);
    const current = await readRuntime();

    return (current.outbox ?? [])
      .filter((job) => job.guildId === data.guildId && job.kind === "panel")
      .slice(-20)
      .map((job) => ({
        id: job.id,
        target: job.target,
        channelRef: job.channelRef,
        status: job.status,
        ...(job.detail ? { detail: job.detail } : {}),
        ...(job.channelId ? { channelId: job.channelId } : {}),
        ...(job.messageId ? { messageId: job.messageId } : {}),
        createdAt: job.createdAt,
        ...(job.at ? { at: job.at } : {})
      }));
  });

/** Real tickets are read from the bot's persisted collections, never localStorage. */
export const getGuildTickets = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const [tickets, messages] = await Promise.all([
      readBotCollection<BotTicketRecord>("tickets"),
      readBotCollection<BotTicketMessage>("ticket_messages"),
    ]);
    return tickets
      .filter((ticket) => ticket.guildId === data.guildId)
      .sort((a, b) => b.id - a.id)
      .slice(0, 500)
      .map((ticket) => ({
        id: String(ticket.id),
        guildId: ticket.guildId,
        number: ticket.id,
        openerId: ticket.openerId,
        claimedBy: ticket.claimedBy,
        department: ticket.department ?? "Geral",
        subject: messages.find((message) => message.ticketId === ticket.id && message.authorId === ticket.openerId)?.content.slice(0, 80) || `Atendimento #${ticket.id}`,
        status: ticket.status,
        priority: ticket.priority,
        tags: [] as string[],
        channelName: ticket.channelId,
        createdAt: Date.parse(ticket.createdAt) || 0,
        firstResponseAt: ticket.firstResponseAt ? Date.parse(ticket.firstResponseAt) || null : null,
        closedAt: ticket.closedAt ? Date.parse(ticket.closedAt) || null : null,
        feedback: ticket.feedback,
        transcript: null as string | null,
        messages: messages
          .filter((message) => message.ticketId === ticket.id)
          .slice(-500)
          .map((message, index) => ({
            id: `${ticket.id}-${index}`,
            authorId: message.authorId,
            authorName: message.authorName,
            content: message.content,
            at: Date.parse(message.at) || 0,
            kind: message.authorId === ticket.openerId ? "user" as const : "staff" as const,
          })),
      }));
  });

export const requestTicketAction = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    ticketId: z.number().int().positive(),
    actorId: z.string().regex(/^\d{17,20}$/),
    action: z.enum(["claim", "reply", "close", "priority"]),
    content: z.string().trim().min(1).max(2000).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  }).strict().superRefine((input, ctx) => {
    if (input.action === "reply" && !input.content) ctx.addIssue({ code: "custom", message: "A resposta não pode ficar vazia." });
    if (input.action === "priority" && !input.priority) ctx.addIssue({ code: "custom", message: "Escolha uma prioridade válida." });
  }).parse(input))
  .handler(async ({ data }) => {
    const session = await requireGuildAccess(data.token, data.guildId);
    if (session.userId !== data.actorId) throw new Error("O atendente informado não corresponde à sessão.");
    const job: OutboxJob = {
      id: `ticket_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      guildId: data.guildId,
      kind: "ticket_action",
      target: "tickets",
      channelRef: "",
      action: data.action,
      ticketId: data.ticketId,
      actorId: data.actorId,
      ...(data.content ? { content: data.content } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      createdAt: Date.now(),
      status: "queued",
    };
    await enqueueOutbox(job);
    return { jobId: job.id };
  });

export const getTicketActionStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    jobId: z.string().min(1).max(100),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const job = (await readRuntime()).outbox?.find((entry) =>
      entry.id === data.jobId && entry.guildId === data.guildId && entry.kind === "ticket_action");
    return job ? { status: job.status, detail: job.detail ?? null } : { status: "missing" as const, detail: null };
  });

/** Actual bot activity for the overview chart, aggregated before crossing the server boundary. */
export const getGuildActivity = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    type DailyStat = { guildId: string; day: string; messages: number; joins: number; leaves: number; tickets: number };
    type TicketRecord = { guildId: string; createdAt: string };
    type ModerationRecord = { guildId: string; createdAt: string };
    type AuditRecord = { id: number; guildId: string; module: string; eventType: string; actorId?: string; severity: string; at: string };
    type FormRecord = { guildId: string; status: string };
    const [ticketRows, dailyRows, moderationRows, auditRows, formRows] = await Promise.all([
      readBotCollection<TicketRecord>("tickets"),
      readBotCollection<DailyStat>("statistics"),
      readBotCollection<ModerationRecord>("moderation"),
      readBotCollection<AuditRecord>("audit"),
      readBotCollection<FormRecord>("forms"),
    ]);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const day = date.toISOString().slice(0, 10);
      const existing = dailyRows.find((row) => row.guildId === data.guildId && row.day === day);
      const tickets = ticketRows.filter((row) => row.guildId === data.guildId && row.createdAt.slice(0, 10) === day).length;
      const automod = auditRows.filter((row) => row.guildId === data.guildId && row.module === "automod" && row.at.slice(0, 10) === day).length;
      const moderation = moderationRows.filter((row) => row.guildId === data.guildId && row.createdAt.slice(0, 10) === day).length;
      return {
        day,
        label: index === 6 ? "hoje" : new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", ""),
        messages: existing?.messages ?? 0,
        joins: existing?.joins ?? 0,
        tickets,
        automod,
        moderation,
      };
    });
    return {
      days,
      pendingForms: formRows.filter((row) => row.guildId === data.guildId && row.status === "pending").length,
      recentEvents: auditRows
        .filter((row) => row.guildId === data.guildId)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, 6)
        .map((row) => ({ id: row.id, module: row.module, eventType: row.eventType, actorId: row.actorId ?? null, severity: row.severity, at: Date.parse(row.at) || 0 })),
      totals: days.reduce((total, row) => ({
        messages: total.messages + row.messages,
        joins: total.joins + row.joins,
        tickets: total.tickets + row.tickets,
        automod: total.automod + row.automod,
        moderation: total.moderation + row.moderation,
      }), { messages: 0, joins: 0, tickets: 0, automod: 0, moderation: 0 }),
    };
  });
