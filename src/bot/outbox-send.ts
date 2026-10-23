/**
 * Envio da fila de saida para o Discord.
 *
 * Separado de `outbox.ts` de proposito: aqui mora o `discord.js`, que os testes
 * nao conseguem carregar. A decisao (o que esta pendente, o que fazer com o
 * resultado) e pura e vive no outro arquivo.
 */
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Guild } from "discord.js";
import { pendingJobs, pruneOutbox, settleActionJob, settleJob } from "./outbox.ts";
import { buildPanelPayload } from "./panels.ts";
import { buildFormPanel, reviewForm } from "./forms.ts";
import { buildTicketPanel, claimTicket, closeTicket, sendTicketReply, setTicketPriority, transferTicket } from "./tickets.ts";
import { asSendable, resolveChannel } from "./resolve.ts";
import type { Logger } from "./logger.ts";
import type { OutboxJob, RuntimeFile } from "../lib/wumpus/runtime.server.ts";
import { setupVerification, restoreVerification, setLockdown } from "./security.ts";
import { id } from "./ids.ts";
import { guildPlan } from "./config.ts";

function runtimePath(): string {
  return process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");
}

/** Le o runtime do disco. O bot nao compartilha memoria com o painel. */
export async function readRuntimeFile(): Promise<RuntimeFile> {
  try {
    const raw = await readFile(runtimePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeFile>;
    return {
      updatedAt: Number(parsed?.updatedAt) || 0,
      guilds: parsed?.guilds && typeof parsed.guilds === "object" ? parsed.guilds : {},
      articles: parsed?.articles && typeof parsed.articles === "object" ? parsed.articles : {},
      outbox: Array.isArray(parsed?.outbox) ? parsed.outbox : []
    };
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
}

/**
 * Publica um painel no canal configurado.
 *
 * A config vem do runtime (o painel gravou la), nao de uma copia em memoria:
 * assim o bot publica exatamente o que o usuario acabou de salvar na tela.
 */
async function publishPanel(guild: Guild, job: OutboxJob): Promise<
  { ok: true; channelId: string; messageId: string } | { ok: false; error: string }
> {
  if (job.target === "security-verification") {
    if (!job.verificationRoleId) return { ok: false, error: "Selecione o cargo que será concedido após a verificação." };
    const setup = await setupVerification(guild, job.channelRef, job.verificationRoleId);
    if (!setup.ok) return { ok: false, error: setup.detail };
    const channel = asSendable(resolveChannel(guild, job.channelRef));
    if (!channel) { await restoreVerification(guild); return { ok: false, error: "Canal de verificação indisponível para publicar." }; }
    try {
      const panel = buildPanelPayload({ title: "Verificação de membro", description: "Clique no botão para receber acesso ao servidor.", buttons: [{ label: "Estou pronto", customId: id("security", "verify"), style: 3 }] });
      const message = await channel.send({ flags: panel.flags, components: panel.components } as never);
      return { ok: true, channelId: message.channelId, messageId: message.id };
    } catch (error) { await restoreVerification(guild); return { ok: false, error: `Falha ao publicar painel; permissões anteriores restauradas: ${String(error).slice(0, 180)}` }; }
  }
  const runtime = await readRuntimeFile();
  const config = runtime.guilds[guild.id]?.[job.target as keyof typeof runtime.guilds[string]] as
    | Record<string, unknown>
    | undefined;

  const channel = resolveChannel(guild, job.channelRef);
  if (!channel) {
    return {
      ok: false,
      error: `Canal "${job.channelRef}" não encontrado em ${guild.name}. Confira o nome no painel.`
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
            accentColor: String(config?.panelAccentColor ?? "#28655b")
          });

  try {
    const message = await target.send({ flags: panel.flags, components: panel.components } as never);
    return { ok: true, channelId: message.channelId, messageId: message.id };
  } catch (error) {
    const detail = String(error);
    if (/50013|missing permissions|missing access/i.test(detail)) {
      const required = job.target === "tickets"
        ? "Dê ao bot Ver canais e Enviar mensagens no canal do painel. Para abrir tickets, ele também precisa de Gerenciar canais."
        : "Dê ao bot Ver canais e Enviar mensagens no canal do formulário.";
      return { ok: false, error: `O bot não tem permissão para publicar em #${job.channelRef}. ${required}` };
    }
    return { ok: false, error: `Discord recusou a publicação: ${detail.slice(0, 200)}. Confira se o canal existe e aceite mensagens.` };
  }
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
        ? { ...job, status: "failed" as const, detail: "Este servidor não tem uma licença ativa no plano atual." , at: Date.now() }
        : job,
    );
    await writeRuntimeFile({ ...runtime, outbox: pruneOutbox(outbox), updatedAt: Date.now() });
    return pending.length;
  }

  let outbox = runtime.outbox ?? [];

  for (const job of pending) {
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
    const result = await publishPanel(guild, job);
    outbox = settleJob(outbox, job.id, result);

    if (result.ok) {
      log.info("painel publicado", {
        guildId: guild.id,
        target: job.target,
        channelId: result.channelId,
        channelRef: job.channelRef
      });
    } else {
      log.warn("falha ao publicar painel", { guildId: guild.id, target: job.target, error: result.error });
    }
  }

  await writeRuntimeFile({ ...runtime, outbox: pruneOutbox(outbox), updatedAt: Date.now() });
  return pending.length;
}

async function processFormAction(guild: Guild, job: OutboxJob, log: Logger): Promise<{ ok: boolean; detail: string }> {
  if (!job.formId || !job.actorId || (job.action !== "approve_form" && job.action !== "reject_form")) {
    return { ok: false, detail: "Pedido de revisão incompleto." };
  }
  const decision = job.action === "approve_form" ? "approved" : "rejected";
  const result = await reviewForm(guild, job.formId, job.actorId, decision, job.reason ?? null, log);
  return {
    ok: result.ok,
    detail: result.ok ? `Formulário #${job.formId} ${decision === "approved" ? "aprovado" : "recusado"}.` : result.error ?? "Não foi possível revisar o formulário.",
  };
}

async function processTicketAction(guild: Guild, job: OutboxJob, log: Logger): Promise<{ ok: boolean; detail: string }> {
  if (job.action === "security_restore") return restoreVerification(guild);
  if (job.action === "security_lockdown_on" || job.action === "security_lockdown_off") return { ok: true, detail: `Lockdown aplicado em ${await setLockdown(guild, job.action === "security_lockdown_on", log)} canais.` };
  if (job.action !== "claim" && job.action !== "reply" && job.action !== "close" && job.action !== "priority" && job.action !== "transfer" && job.action !== "escalate") {
    return { ok: false, detail: "Ação de atendimento inválida." };
  }
  if (!job.ticketId || !job.actorId) return { ok: false, detail: "Pedido de atendimento incompleto." };
  if (job.action === "claim") {
    const result = await claimTicket(guild, job.ticketId, job.actorId, log);
    if (result.ok || result.alreadyBy === job.actorId) return { ok: true, detail: "Atendimento assumido." };
    return { ok: false, detail: result.alreadyBy ? "Este atendimento já foi assumido por outro atendente." : "Atendimento não encontrado ou encerrado." };
  }
  if (job.action === "reply") {
    if (!job.content) return { ok: false, detail: "Resposta vazia." };
    const result = await sendTicketReply(guild, job.ticketId, job.actorId, job.content, log);
    return { ok: result.ok, detail: result.ok ? "Resposta enviada ao Discord." : result.error ?? "Não foi possível responder." };
  }
  if (job.action === "priority") {
    if (!job.priority) return { ok: false, detail: "Prioridade inválida." };
    const result = await setTicketPriority(guild, job.ticketId, job.priority, job.actorId, log);
    return { ok: result, detail: result ? "Prioridade atualizada." : "Ticket encerrado, inexistente ou já está nessa prioridade." };
  }
  if (job.action === "transfer") {
    if (!job.targetStaffId) return { ok: false, detail: "Escolha um atendente para receber o ticket." };
    const result = await transferTicket(guild, job.ticketId, job.actorId, job.targetStaffId, log);
    return { ok: result.ok, detail: result.ok ? "Atendimento transferido." : result.error ?? "Não foi possível transferir o atendimento." };
  }
  if (job.action === "escalate") {
    const result = await setTicketPriority(guild, job.ticketId, "urgent", job.actorId, log);
    return { ok: result, detail: result ? "Atendimento escalado para urgente." : "Atendimento inexistente, encerrado ou já está urgente." };
  }
  const result = await closeTicket(guild, job.ticketId, job.actorId, log, job.reason ?? null);
  return { ok: result.ok, detail: result.ok ? "Atendimento encerrado." : "Atendimento inexistente ou já encerrado." };
}
