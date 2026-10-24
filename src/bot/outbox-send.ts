/**
 * Envio da fila de saida para o Discord.
 *
 * Separado de `outbox.ts` de proposito: aqui mora o `discord.js`, que os testes
 * nao conseguem carregar. A decisao (o que esta pendente, o que fazer com o
 * resultado) e pura e vive no outro arquivo.
 */
import { readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Guild, GuildMember } from "discord.js";
import { pendingJobs, pruneOutbox, settleActionJob, settleJob } from "./outbox.ts";
import { buildPanelPayload } from "./panels.ts";
import { buildFormPanel, reviewForm } from "./forms.ts";
import {
  buildTicketPanel,
  claimTicket,
  closeTicket,
  recordInternalTicketNote,
  sendTicketReply,
  setTicketPriority,
  setTicketWaiting,
  transferTicket,
} from "./tickets.ts";
import { asSendable, resolveChannel } from "./resolve.ts";
import type { Logger } from "./logger.ts";
import {
  readBotCollection,
  updateBotCollection,
  type BotStaffRosterSnapshot,
  type OutboxJob,
  type RuntimeFile,
} from "../lib/wumpus/runtime.server.ts";
import { setupVerification, restoreVerification, setLockdown } from "./security.ts";
import { id } from "./ids.ts";
import { guildPlan } from "./config.ts";
import {
  createHumanSupportThread,
  failSupportChat,
  postSupportRating,
  sendSupportChatMessage,
  setSupportMessageDelivery,
} from "./human-support.ts";

function runtimePath(): string {
  return process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");
}

let runtimeCache: { signature: string; snapshot: RuntimeFile } | null = null;
let runtimeReadPending: Promise<RuntimeFile> | null = null;

/** Le o runtime do disco. O bot nao compartilha memoria com o painel. */
export async function readRuntimeFile(): Promise<RuntimeFile> {
  if (runtimeReadPending) return runtimeReadPending;

  const path = runtimePath();
  try {
    const details = await stat(path, { bigint: true });
    const signature = `${details.dev}:${details.ino}:${details.size}:${details.mtimeNs}`;
    if (runtimeCache?.signature === signature) return runtimeCache.snapshot;
    const pending = (async () => {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as Partial<RuntimeFile>;
      const snapshot = {
        updatedAt: Number(parsed?.updatedAt) || 0,
        guilds: parsed?.guilds && typeof parsed.guilds === "object" ? parsed.guilds : {},
        articles: parsed?.articles && typeof parsed.articles === "object" ? parsed.articles : {},
        outbox: Array.isArray(parsed?.outbox) ? parsed.outbox : [],
      };
      const finalStat = await stat(path, { bigint: true });
      runtimeCache = {
        signature: `${finalStat.dev}:${finalStat.ino}:${finalStat.size}:${finalStat.mtimeNs}`,
        snapshot,
      };
      return snapshot;
    })();
    runtimeReadPending = pending;
    try {
      return await pending;
    } finally {
      if (runtimeReadPending === pending) runtimeReadPending = null;
    }
  } catch {
    return { updatedAt: 0, guilds: {}, articles: {}, outbox: [] };
  }
}

async function writeRuntimeFile(next: RuntimeFile): Promise<void> {
  const path = runtimePath();
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2));
  await rename(tmp, path);
  runtimeCache = null;
}

/**
 * Publica um painel no canal configurado.
 *
 * A config vem do runtime (o painel gravou la), nao de uma copia em memoria:
 * assim o bot publica exatamente o que o usuario acabou de salvar na tela.
 */
async function publishPanel(
  guild: Guild,
  job: OutboxJob,
  log: Logger,
): Promise<{ ok: true; channelId: string; messageId: string } | { ok: false; error: string }> {
  if (job.target === "security-verification") {
    if (!job.verificationRoleId)
      return { ok: false, error: "Selecione o cargo que será concedido após a verificação." };
    const setup = await setupVerification(guild, job.channelRef, job.verificationRoleId, log);
    if (!setup.ok) return { ok: false, error: setup.detail };
    const channel = asSendable(resolveChannel(guild, job.channelRef));
    if (!channel) {
      await restoreVerification(guild);
      return { ok: false, error: "Canal de verificação indisponível para publicar." };
    }
    try {
      const panel = buildPanelPayload({
        title: "Verificação de membro",
        description: "Clique no botão para receber acesso ao servidor.",
        buttons: [{ label: "Estou pronto", customId: id("security", "verify"), style: 3 }],
      });
      const message = await channel.send({
        flags: panel.flags,
        components: panel.components,
      } as never);
      return { ok: true, channelId: message.channelId, messageId: message.id };
    } catch (error) {
      await restoreVerification(guild);
      return {
        ok: false,
        error: `Falha ao publicar painel; permissões anteriores restauradas: ${String(error).slice(0, 180)}`,
      };
    }
  }
  const runtime = await readRuntimeFile();
  const config = runtime.guilds[guild.id]?.[job.target as keyof (typeof runtime.guilds)[string]] as
    Record<string, unknown> | undefined;

  const channel = resolveChannel(guild, job.channelRef);
  if (!channel) {
    return {
      ok: false,
      error: `Canal "${job.channelRef}" não encontrado em ${guild.name}. Confira o nome no painel.`,
    };
  }

  const target = asSendable(channel);
  if (!target) {
    return { ok: false, error: `"${job.channelRef}" não aceita mensagem (é categoria ou voz?).` };
  }

  const panel =
    job.target === "tickets"
      ? await buildTicketPanel(guild)
      : job.target === "forms"
        ? await buildFormPanel(guild)
        : buildPanelPayload({
            title: String(config?.panelTitle ?? "Wumpus"),
            description: String(config?.panelDescription ?? ""),
            accentColor: String(config?.panelAccentColor ?? "#28655b"),
          });

  try {
    const message = await target.send({
      flags: panel.flags,
      components: panel.components,
    } as never);
    return { ok: true, channelId: message.channelId, messageId: message.id };
  } catch (error) {
    const detail = String(error);
    if (/50013|missing permissions|missing access/i.test(detail)) {
      const required =
        job.target === "tickets"
          ? "Dê ao bot Ver canais e Enviar mensagens no canal do painel. Para abrir tickets, ele também precisa de Gerenciar canais."
          : "Dê ao bot Ver canais e Enviar mensagens no canal do formulário.";
      return {
        ok: false,
        error: `O bot não tem permissão para publicar em #${job.channelRef}. ${required}`,
      };
    }
    return {
      ok: false,
      error: `Discord recusou a publicação: ${detail.slice(0, 200)}. Confira se o canal existe e aceite mensagens.`,
    };
  }
}

async function refreshStaffRoster(
  guild: Guild,
  runtime: RuntimeFile,
  log: Logger,
): Promise<{ ok: boolean; detail: string }> {
  const configuredRoleRefs = Array.isArray(runtime.guilds[guild.id]?.staff?.staffRoleIds)
    ? [
        ...new Set(
          (runtime.guilds[guild.id]?.staff?.staffRoleIds as unknown[]).filter(
            (roleId): roleId is string => typeof roleId === "string" && roleId.length > 0,
          ),
        ),
      ]
    : [];
  const roleIds = new Set(
    configuredRoleRefs.flatMap((reference) => {
      const role = guild.roles.cache.find(
        (candidate) => candidate.id === reference || candidate.name === reference,
      );
      return role ? [role.id] : [];
    }),
  );

  try {
    const guildMembers = configuredRoleRefs.length ? await guild.members.fetch() : new Map();
    const members = [...guildMembers.values()]
      .filter((member) => [...roleIds].some((roleId) => member.roles.cache.has(roleId)))
      .map((member) => ({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName || member.user.username,
        roleIds: [...member.roles.cache.keys()].filter((roleId) => roleIds.has(roleId)),
      }));
    const snapshot: BotStaffRosterSnapshot = {
      guildId: guild.id,
      updatedAt: Date.now(),
      configuredRoleRefs,
      members,
    };
    await updateBotCollection<BotStaffRosterSnapshot>("staff-rosters", (rows) => [
      ...rows.filter((row) => row.guildId !== guild.id),
      snapshot,
    ]);
    log.info("lista de equipe atualizada", {
      guildId: guild.id,
      roleCount: roleIds.size,
      memberCount: members.length,
    });
    return { ok: true, detail: `${members.length} membro(s) da equipe sincronizados.` };
  } catch (error) {
    log.warn("falha ao atualizar lista de membros da equipe", {
      guildId: guild.id,
      error: String(error).slice(0, 250),
    });
    return {
      ok: false,
      detail:
        "O bot não conseguiu buscar os membros. Confira o Server Members Intent e tente novamente.",
    };
  }
}

export async function syncStaffRosterMember(
  member: Pick<GuildMember, "guild" | "id" | "user" | "displayName" | "roles">,
  changes: { removed?: boolean; changedRoleIds?: string[]; profileChanged?: boolean } = {},
): Promise<void> {
  const runtime = await readRuntimeFile();
  const configuredRoleRefs = Array.isArray(runtime.guilds[member.guild.id]?.staff?.staffRoleIds)
    ? [
        ...new Set(
          (runtime.guilds[member.guild.id]?.staff?.staffRoleIds as unknown[]).filter(
            (roleId): roleId is string => typeof roleId === "string" && roleId.length > 0,
          ),
        ),
      ]
    : [];
  if (!configuredRoleRefs.length) return;

  const roleIds = new Set(
    configuredRoleRefs.flatMap((reference) => {
      const role = member.guild.roles.cache.find(
        (candidate) => candidate.id === reference || candidate.name === reference,
      );
      return role ? [role.id] : [];
    }),
  );
  if (
    !changes.removed &&
    changes.changedRoleIds?.length &&
    !changes.profileChanged &&
    !changes.changedRoleIds.some((roleId) => roleIds.has(roleId))
  ) {
    return;
  }

  const roster = (await readBotCollection<BotStaffRosterSnapshot>("staff-rosters")).find(
    (row) => row.guildId === member.guild.id,
  );
  if (
    !roster ||
    roster.configuredRoleRefs.slice().sort().join(",") !==
      configuredRoleRefs.slice().sort().join(",")
  ) {
    return;
  }
  const current = roster.members.find((item) => item.id === member.id);
  const staffRoleIds = [...member.roles.cache.keys()].filter((roleId) => roleIds.has(roleId));
  const isStaff = !changes.removed && staffRoleIds.length > 0;
  if (!current && !isStaff) return;
  if (
    current &&
    isStaff &&
    current.username === member.user.username &&
    current.displayName === (member.displayName || member.user.username) &&
    current.roleIds.slice().sort().join(",") === staffRoleIds.slice().sort().join(",")
  ) {
    return;
  }

  await updateBotCollection<BotStaffRosterSnapshot>("staff-rosters", (rows) => {
    const snapshot = rows.find((row) => row.guildId === member.guild.id);
    if (
      !snapshot ||
      snapshot.configuredRoleRefs.slice().sort().join(",") !==
        configuredRoleRefs.slice().sort().join(",")
    ) {
      return rows;
    }
    const nextMember = isStaff
      ? {
          id: member.id,
          username: member.user.username,
          displayName: member.displayName || member.user.username,
          roleIds: staffRoleIds,
        }
      : null;
    if (
      current &&
      nextMember &&
      current.username === nextMember.username &&
      current.displayName === nextMember.displayName &&
      current.roleIds.slice().sort().join(",") === nextMember.roleIds.slice().sort().join(",")
    ) {
      return rows;
    }

    snapshot.members = snapshot.members.filter((item) => item.id !== member.id);
    if (nextMember) snapshot.members.push(nextMember);
    snapshot.updatedAt = Date.now();
    return rows;
  });
}

/**
 * Processa a fila de um servidor.
 *
 * Devolve quantos pedidos tratou. Cada resultado e gravado de volta no arquivo,
 * para o painel poder mostrar "publicado em #canal" ou o erro — em vez do
 * "publicado" falso que existia antes.
 */
export async function processOutbox(guild: Guild, log: Logger): Promise<number> {
  const runtime = await readRuntimeFile();
  const pending = pendingJobs(runtime.outbox, guild.id);
  if (!pending.length) return 0;

  if (!(await guildPlan(guild.id))) {
    const outbox = (runtime.outbox ?? []).map((job) =>
      job.guildId === guild.id && job.status === "queued"
        ? {
            ...job,
            status: "failed" as const,
            detail: "Este servidor não tem uma licença ativa no plano atual.",
            at: Date.now(),
          }
        : job,
    );
    for (const job of pending) {
      if (job.kind === "support_handoff") await failSupportChat(job.id);
      if (job.kind === "support_message" && job.supportChatId && job.supportMessageId) {
        await setSupportMessageDelivery(job.supportChatId, job.supportMessageId, "failed");
      }
    }
    const latestRuntime = await readRuntimeFile();
    const latestJobs = latestRuntime.outbox ?? [];
    const latestJobIds = new Set(latestJobs.map((job) => job.id));
    const mergedOutbox = [
      ...latestJobs.map((job) => outbox.find((processed) => processed.id === job.id) ?? job),
      ...outbox.filter((job) => !latestJobIds.has(job.id)),
    ];
    await writeRuntimeFile({
      ...latestRuntime,
      outbox: pruneOutbox(mergedOutbox),
      updatedAt: Date.now(),
    });
    return pending.length;
  }

  let outbox = runtime.outbox ?? [];

  for (const job of pending) {
    const startedAt = Date.now();
    try {
      if (job.kind === "ticket_action") {
        const result = await processTicketAction(guild, job, log);
        outbox = settleActionJob(outbox, job.id, result);
        continue;
      }
      if (job.kind === "form_action") {
        const result = await processFormAction(guild, job, log);
        outbox = settleActionJob(outbox, job.id, result);
        continue;
      }
      if (job.kind === "support_handoff") {
        const result = await createHumanSupportThread(guild, job, log);
        if (!result.ok) await failSupportChat(job.id);
        outbox = settleActionJob(outbox, job.id, result);
        continue;
      }
      if (job.kind === "support_message") {
        const result =
          job.supportChatId && job.supportMessageId && job.content
            ? await sendSupportChatMessage(
                guild,
                job.supportChatId,
                job.supportMessageId,
                job.content,
              )
            : { ok: false, detail: "Mensagem de atendimento incompleta." };
        if (!result.ok && job.supportChatId && job.supportMessageId) {
          await setSupportMessageDelivery(job.supportChatId, job.supportMessageId, "failed");
        }
        outbox = settleActionJob(outbox, job.id, result);
        continue;
      }
      if (job.kind === "support_rating") {
        const result =
          job.supportChatId && job.rating
            ? await postSupportRating(guild, job.supportChatId, job.rating)
            : { ok: false, detail: "Avaliação de atendimento incompleta." };
        outbox = settleActionJob(outbox, job.id, result);
        continue;
      }
      if (job.kind === "staff_roster") {
        const result = await refreshStaffRoster(guild, runtime, log);
        outbox = settleActionJob(outbox, job.id, result);
        continue;
      }
      const result = await publishPanel(guild, job, log);
      outbox = settleJob(outbox, job.id, result);

      if (result.ok) {
        log.info("painel publicado", {
          guildId: guild.id,
          target: job.target,
          channelId: result.channelId,
          channelRef: job.channelRef,
          queueWaitMs: Math.max(0, startedAt - job.createdAt),
          executionMs: Date.now() - startedAt,
        });
      } else {
        log.warn("falha ao publicar painel", {
          guildId: guild.id,
          target: job.target,
          error: result.error,
          queueWaitMs: Math.max(0, startedAt - job.createdAt),
          executionMs: Date.now() - startedAt,
        });
      }
    } finally {
      if (job.kind !== "panel") {
        log.info("ação da fila processada", {
          guildId: guild.id,
          target: job.target,
          action: job.action ?? "none",
          queueWaitMs: Math.max(0, startedAt - job.createdAt),
          executionMs: Date.now() - startedAt,
          status: outbox.find((entry) => entry.id === job.id)?.status ?? "queued",
        });
      }
    }
  }

  await writeRuntimeFile({ ...runtime, outbox: pruneOutbox(outbox), updatedAt: Date.now() });
  return pending.length;
}

async function processFormAction(
  guild: Guild,
  job: OutboxJob,
  log: Logger,
): Promise<{ ok: boolean; detail: string }> {
  if (
    !job.formId ||
    !job.actorId ||
    (job.action !== "approve_form" && job.action !== "reject_form")
  ) {
    return { ok: false, detail: "Pedido de revisão incompleto." };
  }
  const decision = job.action === "approve_form" ? "approved" : "rejected";
  const result = await reviewForm(
    guild,
    job.formId,
    job.actorId,
    decision,
    job.reason ?? null,
    log,
  );
  return {
    ok: result.ok,
    detail: result.ok
      ? `Formulário #${job.formId} ${decision === "approved" ? "aprovado" : "recusado"}.`
      : (result.error ?? "Não foi possível revisar o formulário."),
  };
}

async function processTicketAction(
  guild: Guild,
  job: OutboxJob,
  log: Logger,
): Promise<{ ok: boolean; detail: string }> {
  if (job.action === "security_restore") return restoreVerification(guild);
  if (job.action === "security_lockdown_on" || job.action === "security_lockdown_off")
    return {
      ok: true,
      detail: `Lockdown aplicado em ${await setLockdown(guild, job.action === "security_lockdown_on", log)} canais.`,
    };
  if (
    job.action !== "claim" &&
    job.action !== "reply" &&
    job.action !== "note" &&
    job.action !== "close" &&
    job.action !== "priority" &&
    job.action !== "transfer" &&
    job.action !== "escalate" &&
    job.action !== "waiting_user" &&
    job.action !== "waiting_staff" &&
    job.action !== "resume"
  ) {
    return { ok: false, detail: "Ação de atendimento inválida." };
  }
  if (!job.ticketId || !job.actorId)
    return { ok: false, detail: "Pedido de atendimento incompleto." };
  if (job.action === "claim") {
    const result = await claimTicket(guild, job.ticketId, job.actorId, log);
    if (result.ok || result.alreadyBy === job.actorId)
      return { ok: true, detail: "Atendimento assumido." };
    return {
      ok: false,
      detail: result.alreadyBy
        ? "Este atendimento já foi assumido por outro atendente."
        : "Atendimento não encontrado ou encerrado.",
    };
  }
  if (job.action === "reply") {
    if (!job.content) return { ok: false, detail: "Resposta vazia." };
    const result = await sendTicketReply(guild, job.ticketId, job.actorId, job.content, log);
    return {
      ok: result.ok,
      detail: result.ok
        ? "Resposta enviada ao Discord."
        : (result.error ?? "Não foi possível responder."),
    };
  }
  if (job.action === "note") {
    if (!job.content) return { ok: false, detail: "A nota interna não pode ficar vazia." };
    const result = await recordInternalTicketNote(guild, job.ticketId, job.actorId, job.content, log);
    return { ok: result.ok, detail: result.ok ? "Nota interna registrada." : result.error ?? "Não foi possível salvar a nota." };
  }
  if (job.action === "waiting_user" || job.action === "waiting_staff" || job.action === "resume") {
    const waitingOn = job.action === "waiting_user" ? "user" : job.action === "waiting_staff" ? "staff" : null;
    const result = await setTicketWaiting(guild, job.ticketId, job.actorId, waitingOn, log);
    return { ok: result, detail: result ? "Estado do atendimento atualizado. O SLA continua contando." : "O estado já estava selecionado ou o ticket foi encerrado." };
  }
  if (job.action === "priority") {
    if (!job.priority) return { ok: false, detail: "Prioridade inválida." };
    const result = await setTicketPriority(guild, job.ticketId, job.priority, job.actorId, log);
    return {
      ok: result,
      detail: result
        ? "Prioridade atualizada."
        : "Ticket encerrado, inexistente ou já está nessa prioridade.",
    };
  }
  if (job.action === "transfer") {
    if (!job.targetStaffId)
      return { ok: false, detail: "Escolha um atendente para receber o ticket." };
    const result = await transferTicket(guild, job.ticketId, job.actorId, job.targetStaffId, log);
    return {
      ok: result.ok,
      detail: result.ok
        ? "Atendimento transferido."
        : (result.error ?? "Não foi possível transferir o atendimento."),
    };
  }
  if (job.action === "escalate") {
    const result = await setTicketPriority(guild, job.ticketId, "urgent", job.actorId, log);
    return {
      ok: result,
      detail: result
        ? "Atendimento escalado para urgente."
        : "Atendimento inexistente, encerrado ou já está urgente.",
    };
  }
  const result = await closeTicket(guild, job.ticketId, job.actorId, log, job.reason ?? null);
  return {
    ok: result.ok,
    detail: result.ok ? "Atendimento encerrado." : "Atendimento inexistente ou já encerrado.",
  };
}
