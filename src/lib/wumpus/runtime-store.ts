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
import { enqueueOutbox, readRuntime, writeRuntime, type OutboxJob } from "./runtime.server";
import { requireGuildAccess } from "./session";
import { publishInputSchema } from "./runtime-validation";

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
    token: z.string().min(1).max(4096),
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
    token: z.string().min(1).max(4096),
    guildId: z.string().regex(/^\d{17,20}$/),
  }).strict().parse(input))
  .handler(async ({ data }): Promise<PublishStatus[]> => {
    await requireGuildAccess(data.token, data.guildId);
    const current = await readRuntime();

    return (current.outbox ?? [])
      .filter((job) => job.guildId === data.guildId)
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