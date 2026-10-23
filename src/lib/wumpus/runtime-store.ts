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
import { enqueueOutbox, readBotCollection, readRuntime, writeRuntime, type BotFormRecord, type BotTicketMessage, type BotTicketRecord, type OutboxJob } from "./runtime.server";
import { requireGuildAccess } from "./session-access.server";
import { publishInputSchema } from "./runtime-validation";
import { SESSION_TOKEN_MAX_LENGTH } from "./session-token";
import { readBotHealth } from "./health.server";
import { markSecurityEventReviewed, readReviewedSecurityEvents } from "./security-reviews.server";
import { monthlyOcrLimit, planAllows } from "./engine";

export const getDiscordGuildResources = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH), guildId: z.string().regex(/^\d{17,20}$/) }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const health = await readBotHealth();
    if (!health || health.status !== "online" || Date.now() - health.at > 90_000) return { channels: [], roles: [] };
    return health.guildResources?.[data.guildId] ?? { channels: [], roles: [] };
  });

export const getGuildProtectionReadiness = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH), guildId: z.string().regex(/^\d{17,20}$/) }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    type LockdownEvent = { id: number; guildId: string; eventType: string; at: string };
    const [health, audit] = await Promise.all([readBotHealth().catch(() => null), readBotCollection<LockdownEvent>("audit")]);
    const lastLockdownEvent = audit
      .filter((row) => row.guildId === data.guildId && (row.eventType === "security_lockdown_on" || row.eventType === "security_lockdown_off"))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    const lockdown = lastLockdownEvent ? lastLockdownEvent.eventType === "security_lockdown_on" : null;
    if (!health) return { status: "unknown" as const, lastSeenAt: null, pingMs: null, permissions: null, lockdown };
    const fresh = health.status === "online" && Date.now() - health.at <= 90_000;
    const installed = health.guildIds.includes(data.guildId);
    const status = !fresh ? "offline" as const : installed ? "online" as const : "not_installed" as const;
    return {
      status,
      lastSeenAt: health.at,
      pingMs: health.pingMs,
      permissions: installed ? health.guildResources?.[data.guildId]?.permissions ?? null : null,
      lockdown,
    };
  });

/** Uso mensal do plano, calculado no servidor e agregado pela assinatura. */
export const getGuildPlanUsage = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    const session = await requireGuildAccess(data.token, data.guildId);
    const plan = session.entitlements.plan;
    if (!plan) throw new Error("Não há plano ativo para esta conta.");
    const accountId = session.userId;
    const month = new Date().toISOString().slice(0, 7);
    const rows = await readBotCollection<{ accountId: string; month: string; count: number }>("ocr-usage");
    const ocrUsed = rows.find((row) => row.accountId === accountId && row.month === month)?.count ?? 0;
    return {
      planId: plan,
      serversUsed: session.entitlements.guildIds.length,
      serverLimit: session.entitlements.limit,
      serversOverLimit: session.guilds
        .filter((guild) => guild.owner && session.entitlements.overLimitGuildIds.includes(guild.id))
        .map((guild) => guild.name),
      ocrUsed,
      ocrLimit: monthlyOcrLimit(plan),
      month,
    };
  });

const SECURITY_INCIDENT_TITLES: Record<string, string> = {
  security_raid_suspected: "Possível raid detectada",
  security_young_account: "Conta nova entrou no servidor",
  security_quarantine_failed: "Não foi possível isolar uma conta nova",
  security_mass_ban: "Banimentos em sequência",
  security_mass_channel_delete: "Canais apagados em sequência",
  security_mass_role_delete: "Cargos apagados em sequência",
  security_mass_webhook_create: "Webhooks criados em sequência",
  security_mass_invite_create: "Convites criados em sequência",
  security_mass_everyone_mentions: "Menções @everyone em sequência",
  security_auto_timeout_failed: "Timeout automático falhou",
  security_auto_timeout: "Timeout automático aplicado",
  security_repeat_offender_auto_ban_failed: "Banimento automático falhou",
  security_repeat_offender_auto_ban: "Autor de ações destrutivas banido",
  security_auto_response_unconfirmed: "Resposta automática aguarda confirmação",
  security_lockdown_on: "Lockdown ativado",
  security_lockdown_off: "Lockdown encerrado",
};

export const getGuildSecurityIncidents = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    limit: z.number().int().min(1).max(200).default(100),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    type AuditRecord = { id: number; guildId: string; module: string; eventType: string; actorId?: string; targetId?: string; channelId?: string; severity: string; at: string; data?: Record<string, unknown> };
    const [records, reviewedIds] = await Promise.all([readBotCollection<AuditRecord>("audit"), readReviewedSecurityEvents(data.guildId)]);
    const acknowledged = new Set(reviewedIds);
    return records
      .filter((row) => row.guildId === data.guildId && (row.module === "automod" || (row.eventType.startsWith("security_") && row.severity !== "info")))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, data.limit)
      .map((row) => ({
        id: row.id,
        module: row.module,
        eventType: row.eventType,
        severity: row.severity,
        title: SECURITY_INCIDENT_TITLES[row.eventType] ?? (row.module === "automod" ? "AutoMod removeu uma mensagem" : row.eventType.replace(/^security_/, "").replaceAll("_", " ")),
        detail: row.module === "automod"
          ? `Regra ${String(row.data?.rule ?? row.eventType.replace(/^automod_/, "").replaceAll("_", " "))} · ação ${String(row.data?.action ?? "registrada")}`
          : row.eventType === "security_raid_suspected" && typeof row.data?.count === "number"
            ? `${row.data.count} entradas em ${typeof row.data.windowMs === "number" ? Math.round(row.data.windowMs / 1000) : "—"}s. Revise quem entrou recentemente e confirme se o lockdown é necessário.`
            : row.eventType === "security_young_account" && typeof row.data?.accountAgeHours === "number"
              ? `Conta com ${row.data.accountAgeHours}h; mínimo configurado: ${String(row.data.minAccountAgeHours ?? "—")}h.`
              : typeof row.data?.count === "number" && typeof row.data.threshold === "number"
                ? `${row.data.count} ações detectadas; o alerta começa em ${row.data.threshold}. Revise o autor e o registro de auditoria.`
            : row.eventType.replace(/^security_/, "").replaceAll("_", " "),
        actorId: row.actorId ?? null,
        targetId: row.targetId ?? null,
        channelId: row.channelId ?? null,
        at: Date.parse(row.at) || 0,
        acknowledged: acknowledged.has(row.id),
      }));
  });

export const acknowledgeGuildSecurityIncident = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    eventId: z.number().int().positive(),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const exists = (await readBotCollection<{ id: number; guildId: string }>("audit"))
      .some((event) => event.guildId === data.guildId && event.id === data.eventId);
    if (!exists) throw new Error("O alerta não existe mais no histórico deste servidor.");
    await markSecurityEventReviewed(data.guildId, data.eventId);
    return { ok: true as const };
  });

const groupSchema = z.array(z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  guildIds: z.array(z.string().regex(/^\d{17,20}$/)).min(1).max(50),
  resourceMappings: z.record(z.string().regex(/^\d{17,20}$/), z.record(z.string().min(1).max(160), z.string().regex(/^\d{17,20}$/))).optional(),
}).strict()).max(50);

export const getServerGroups = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH), guildId: z.string().regex(/^\d{17,20}$/) }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const runtime = await readRuntime();
    return (runtime.serverGroups ?? []).filter((group) => group.guildIds.includes(data.guildId));
  });

export const saveServerGroups = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH), guildId: z.string().regex(/^\d{17,20}$/), groups: groupSchema }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    for (const group of data.groups) {
      if (!group.guildIds.includes(data.guildId)) throw new Error("Cada grupo precisa incluir o servidor atual.");
      for (const guildId of group.guildIds) await requireGuildAccess(data.token, guildId);
    }
    const runtime = await readRuntime();
    runtime.serverGroups = [
      ...(runtime.serverGroups ?? []).filter((group) => !group.guildIds.includes(data.guildId)),
      ...data.groups.map((group) => ({ ...group, guildIds: [...new Set(group.guildIds)] })),
    ];
    runtime.updatedAt = Date.now();
    await writeRuntime(runtime);
    return { ok: true as const };
  });

export type { RuntimeFile, RuntimeGuild, RuntimeArticle, OutboxJob } from "./runtime.server";

/** Payload de config de um servidor: `{ modulo: { ...campos, enabled } }`. */
export type PublishInput = {
  token: string;
  guildId: string;
  name?: string;
  modules: Record<string, Record<string, unknown>>;
  /** Base de conhecimento daquele servidor. */
  articles?: Array<{ id: string; title: string; body: string; tags: string[]; category?: string; exampleQuestions?: string[]; approved: boolean }>;
};

export const publishGuildRuntime = createServerFn({ method: "POST" })
  .validator((input: unknown) => publishInputSchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireGuildAccess(data.token, data.guildId);
    const current = await readRuntime();
    const plan = session.entitlements.plan;
    const modules = structuredClone(data.modules);

    // A UI desabilitada nao e controle de acesso: recursos premium sao
    // removidos tambem no servidor antes da configuracao chegar ao bot.
    if (!planAllows(plan ?? "essencial", "ai")) {
      if (modules.tickets) modules.tickets.aiSupportEnabled = false;
      if (modules.forms) modules.forms.useAiPreReview = false;
      if (modules.knowledge) modules.knowledge.useAi = false;
    }
    if (!planAllows(plan ?? "essencial", "ocr")) {
      if (modules.automod) modules.automod.scanImages = false;
      if (modules.ocr) modules.ocr.enabled = false;
    }
    if (!planAllows(plan ?? "essencial", "webhooks") && modules.integrations) {
      modules.integrations.allowIncoming = false;
    }

    current.guilds[data.guildId] = {
      ...current.guilds[data.guildId],
      ...modules,
      ...(data.name ? { name: data.name } : {}),
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
    target: z.enum(["tickets", "forms", "security-verification"]),
    channelRef: z.string().trim().min(1).max(100),
    verificationRoleId: z.string().trim().min(1).max(100).optional(),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const job: OutboxJob = {
      id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      guildId: data.guildId,
      kind: "panel",
      target: data.target,
      channelRef: data.channelRef,
      ...(data.verificationRoleId ? { verificationRoleId: data.verificationRoleId } : {}),
      createdAt: Date.now(),
      status: "queued"
    };

    await enqueueOutbox(job);
    return { ok: true as const, jobId: job.id };
  });

export const requestSecurityRestore = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH), guildId: z.string().regex(/^\d{17,20}$/) }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const job: OutboxJob = { id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, guildId: data.guildId, kind: "ticket_action", target: "security-verification", channelRef: "", action: "security_restore", createdAt: Date.now(), status: "queued" };
    await enqueueOutbox(job);
    return { ok: true as const, jobId: job.id };
  });

export const requestSecurityLockdown = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH), guildId: z.string().regex(/^\d{17,20}$/), enabled: z.boolean() }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const job: OutboxJob = { id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, guildId: data.guildId, kind: "ticket_action", target: "security", channelRef: "", action: data.enabled ? "security_lockdown_on" : "security_lockdown_off", createdAt: Date.now(), status: "queued" };
    await enqueueOutbox(job);
    return { ok: true as const, jobId: job.id };
  });

export const getGuildSecurityActionStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    jobId: z.string().min(1).max(100),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const job = (await readRuntime()).outbox?.find((entry) => entry.id === data.jobId && entry.guildId === data.guildId && (entry.target === "security" || entry.target === "security-verification"));
    return job ? { status: job.status, detail: job.detail ?? null, at: job.at ?? null } : { status: "missing" as const, detail: null, at: null };
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

/** Formulários recebidos de verdade pelo bot, convertidos para o modelo da caixa. */
export const getGuildFormSubmissions = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const forms = await readBotCollection<BotFormRecord>("forms");
    return forms
      .filter((form) => form.guildId === data.guildId)
      .sort((a, b) => b.id - a.id)
      .slice(0, 500)
      .map((form) => ({
        id: String(form.id),
        guildId: form.guildId,
        userId: form.userId,
        answers: Object.fromEntries(form.questions.map((question, index) => [question, form.answers[index] ?? ""])),
        status: form.status,
        createdAt: Date.parse(form.createdAt) || 0,
        reviewedAt: form.reviewedAt ? Date.parse(form.reviewedAt) || null : null,
        reviewerId: form.reviewedBy,
        reason: form.reviewReason ?? "",
        aiNote: null,
      }));
  });

/** Envia uma decisão de revisão ao processo do bot pelo runtime compartilhado. */
export const requestFormReview = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    formId: z.number().int().positive(),
    actorId: z.string().regex(/^\d{17,20}$/),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().max(500).optional(),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    const session = await requireGuildAccess(data.token, data.guildId);
    if (session.userId !== data.actorId) throw new Error("O revisor informado não corresponde à sessão.");
    const job: OutboxJob = {
      id: `form_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      guildId: data.guildId,
      kind: "form_action",
      target: "forms",
      channelRef: "",
      action: data.decision === "approved" ? "approve_form" : "reject_form",
      formId: data.formId,
      actorId: data.actorId,
      ...(data.reason?.trim() ? { reason: data.reason.trim() } : {}),
      createdAt: Date.now(),
      status: "queued",
    };
    await enqueueOutbox(job);
    return { jobId: job.id };
  });

export const getFormReviewStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    jobId: z.string().min(1).max(100),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    const job = (await readRuntime()).outbox?.find((entry) =>
      entry.id === data.jobId && entry.guildId === data.guildId && entry.kind === "form_action");
    return job ? { status: job.status, detail: job.detail ?? null } : { status: "missing" as const, detail: null };
  });

export const requestTicketAction = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    ticketId: z.number().int().positive(),
    actorId: z.string().regex(/^\d{17,20}$/),
    action: z.enum(["claim", "reply", "close", "priority", "transfer", "escalate"]),
    content: z.string().trim().min(1).max(2000).optional(),
    reason: z.string().trim().max(500).optional(),
    targetStaffId: z.string().regex(/^\d{17,20}$/).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  }).strict().superRefine((input, ctx) => {
    if (input.action === "reply" && !input.content) ctx.addIssue({ code: "custom", message: "A resposta não pode ficar vazia." });
    if (input.action === "priority" && !input.priority) ctx.addIssue({ code: "custom", message: "Escolha uma prioridade válida." });
    if (input.action === "transfer" && !input.targetStaffId) ctx.addIssue({ code: "custom", message: "Escolha um atendente para transferir o ticket." });
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
      ...(data.reason ? { reason: data.reason } : {}),
      ...(data.targetStaffId ? { targetStaffId: data.targetStaffId } : {}),
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
    periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
    slaGoalMinutes: z.number().int().min(0).max(10080).optional(),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    type DailyStat = { guildId: string; day: string; messages: number; joins: number; leaves: number; tickets: number };
    type TicketRecord = { id?: number; guildId: string; createdAt: string; closedAt?: string | null; firstResponseAt?: string | null; feedback?: { rating: number } | null; department?: string | null; status?: string };
    type ModerationRecord = { guildId: string; createdAt: string };
    type AuditRecord = { id: number; guildId: string; module: string; eventType: string; actorId?: string; severity: string; at: string };
    type FormRecord = { guildId: string; status: string };
    const periodDays = data.periodDays ?? 7;
    const slaGoalMinutes = data.slaGoalMinutes ?? 60;
    const [ticketRows, dailyRows, moderationRows, auditRows, formRows, health] = await Promise.all([
      readBotCollection<TicketRecord>("tickets"),
      readBotCollection<DailyStat>("statistics"),
      readBotCollection<ModerationRecord>("moderation"),
      readBotCollection<AuditRecord>("audit"),
      readBotCollection<FormRecord>("forms"),
      readBotHealth().catch(() => null),
    ]);
    const guildTickets = ticketRows.filter((row) => row.guildId === data.guildId);
    const guildDailyRows = dailyRows.filter((row) => row.guildId === data.guildId);
    const guildModerationRows = moderationRows.filter((row) => row.guildId === data.guildId);
    const guildAuditRows = auditRows.filter((row) => row.guildId === data.guildId);
    const guildForms = formRows.filter((row) => row.guildId === data.guildId);
    const byDate = <T,>(rows: T[], dateOf: (row: T) => string | null | undefined) => {
      const result = new Map<string, T[]>();
      for (const row of rows) {
        const date = dateOf(row)?.slice(0, 10);
        if (!date) continue;
        const bucket = result.get(date);
        if (bucket) bucket.push(row);
        else result.set(date, [row]);
      }
      return result;
    };
    const ticketsByCreatedDay = byDate(guildTickets, (row) => row.createdAt);
    const ticketsByClosedDay = byDate(guildTickets, (row) => row.closedAt);
    const activityByDay = byDate(guildDailyRows, (row) => row.day);
    const moderationByDay = byDate(guildModerationRows, (row) => row.createdAt);
    const automodByDay = byDate(guildAuditRows.filter((row) => row.module === "automod"), (row) => row.at);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - (periodDays - 1));
    const start = startDate.toISOString().slice(0, 10);
    const previousEndDate = new Date(startDate);
    previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
    const previousEnd = previousEndDate.toISOString().slice(0, 10);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setUTCDate(previousStartDate.getUTCDate() - (periodDays - 1));
    const previousStart = previousStartDate.toISOString().slice(0, 10);
    const within = (value: string | null | undefined, from: string, to: string) => Boolean(value && value.slice(0, 10) >= from && value.slice(0, 10) <= to);
    const summarize = (from: string, to: string) => {
      const rangeTickets = guildTickets.filter((row) => within(row.createdAt, from, to));
      const resolved = guildTickets.filter((row) => within(row.closedAt, from, to));
      const responded = rangeTickets.flatMap((row) => {
        const created = Date.parse(row.createdAt);
        const response = row.firstResponseAt ? Date.parse(row.firstResponseAt) : Number.NaN;
        return Number.isFinite(created) && Number.isFinite(response) && response >= created ? [{ minutes: (response - created) / 60_000, row }] : [];
      });
      const responseTimes = responded.map((row) => row.minutes).sort((a, b) => a - b);
      const medianResponseMinutes = responseTimes.length ? (responseTimes.length % 2 ? responseTimes[(responseTimes.length - 1) / 2]! : (responseTimes[responseTimes.length / 2 - 1]! + responseTimes[responseTimes.length / 2]!) / 2) : null;
      const rated = resolved.flatMap((row) => row.feedback && row.feedback.rating >= 1 && row.feedback.rating <= 5 ? [row.feedback.rating] : []);
      const metSla = responded.filter((row) => row.minutes <= slaGoalMinutes).length;
      const overdueWithoutResponse = slaGoalMinutes > 0 ? rangeTickets.filter((row) => {
        const created = Date.parse(row.createdAt);
        return !row.firstResponseAt && Number.isFinite(created) && Date.now() - created > slaGoalMinutes * 60_000;
      }).length : 0;
      const slaDenominator = responded.length + overdueWithoutResponse;
      const byDepartment = new Map<string, { opened: number; closed: number }>();
      for (const row of rangeTickets) {
        const key = row.department?.trim() || "Geral";
        byDepartment.set(key, { opened: (byDepartment.get(key)?.opened ?? 0) + 1, closed: byDepartment.get(key)?.closed ?? 0 });
      }
      for (const row of resolved) {
        const key = row.department?.trim() || "Geral";
        byDepartment.set(key, { opened: byDepartment.get(key)?.opened ?? 0, closed: (byDepartment.get(key)?.closed ?? 0) + 1 });
      }
      return {
        opened: rangeTickets.length,
        closed: resolved.length,
        medianResponseMinutes,
        responseCount: responded.length,
        slaMet: slaGoalMinutes > 0 && slaDenominator ? Math.round((metSla / slaDenominator) * 100) : null,
        slaCount: slaGoalMinutes > 0 ? slaDenominator : 0,
        csat: rated.length ? rated.reduce((sum, score) => sum + score, 0) / rated.length : null,
        csatCount: rated.length,
        departments: [...byDepartment.entries()].map(([department, counts]) => ({ department, ...counts })).sort((a, b) => b.opened - a.opened).slice(0, 8),
        automod: guildAuditRows.filter((row) => row.module === "automod" && within(row.at, from, to)).length,
        moderation: guildModerationRows.filter((row) => within(row.createdAt, from, to)).length,
      };
    };
    const days = Array.from({ length: periodDays }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const existing = activityByDay.get(day)?.[0];
      const tickets = ticketsByCreatedDay.get(day)?.length ?? 0;
      const closed = ticketsByClosedDay.get(day)?.length ?? 0;
      const automod = automodByDay.get(day)?.length ?? 0;
      const moderation = moderationByDay.get(day)?.length ?? 0;
      return {
        day,
        label: day === end ? "hoje" : new Intl.DateTimeFormat("pt-BR", periodDays > 7 ? { day: "2-digit", month: "short", timeZone: "UTC" } : { weekday: "short", timeZone: "UTC" }).format(date).replace(".", ""),
        messages: existing?.messages ?? 0,
        joins: existing?.joins ?? 0,
        tickets,
        closed,
        automod,
        moderation,
      };
    });
    const currentSummary = summarize(start, end);
    const previousSummary = summarize(previousStart, previousEnd);
    const unanswered = guildTickets.filter((row) => (row.status === "open" || row.status === "claimed") && !row.firstResponseAt).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
    const healthForGuild = health?.guildIds.includes(data.guildId) ? health : null;
    const botStatus = !healthForGuild ? "unavailable" as const : healthForGuild.status === "online" && Date.now() - healthForGuild.at <= 90_000 ? "online" as const : "offline" as const;
    return {
      days,
      range: { start, end, ...currentSummary },
      previousRange: { start: previousStart, end: previousEnd, ...previousSummary },
      currentOpen: guildTickets.filter((row) => row.status === "open" || row.status === "claimed").length,
      oldestUnanswered: unanswered ? { id: unanswered.id, department: unanswered.department ?? "Geral", createdAt: Date.parse(unanswered.createdAt) || 0 } : null,
      refreshedAt: Date.now(),
      bot: { status: botStatus, lastSeenAt: healthForGuild?.at ?? null, pingMs: healthForGuild?.pingMs ?? null },
      pendingForms: guildForms.filter((row) => row.status === "pending").length,
      recentEvents: guildAuditRows
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

export const getGuildAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
    guildId: z.string().regex(/^\d{17,20}$/),
    limit: z.number().int().min(1).max(500).default(200),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireGuildAccess(data.token, data.guildId);
    type AuditRecord = { id: number; guildId: string; module: string; eventType: string; actorId?: string; targetId?: string; channelId?: string; severity: string; at: string; data?: Record<string, unknown> };
    const records = await readBotCollection<AuditRecord>("audit");
    return records
      .filter((row) => row.guildId === data.guildId)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, data.limit)
      .map((row) => ({
        id: row.id,
        category: row.module,
        eventType: row.eventType,
        actorId: row.actorId ?? null,
        targetId: row.targetId ?? null,
        channelId: row.channelId ?? null,
        severity: row.severity,
        summary: typeof row.data?.summary === "string" ? row.data.summary : row.eventType.replaceAll("_", " "),
        at: Date.parse(row.at) || 0,
      }));
  });
