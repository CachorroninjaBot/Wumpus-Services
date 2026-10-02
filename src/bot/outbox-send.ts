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
import { pendingJobs, pruneOutbox, settleJob } from "./outbox.ts";
import { buildPanelPayload } from "./panels.ts";
import { buildFormPanel } from "./forms.ts";
import { buildTicketPanel } from "./tickets.ts";
import { asSendable, resolveChannel } from "./resolve.ts";
import type { Logger } from "./logger.ts";
import type { OutboxJob, RuntimeFile } from "../lib/wumpus/runtime.server.ts";

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
            accentColor: String(config?.panelAccentColor ?? "#7c5cff")
          });

  try {
    const message = await target.send({ flags: panel.flags, components: panel.components } as never);
    return { ok: true, channelId: message.channelId, messageId: message.id };
  } catch (error) {
    return { ok: false, error: `Discord recusou: ${String(error).slice(0, 200)}` };
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

  let outbox = runtime.outbox ?? [];

  for (const job of pending) {
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
