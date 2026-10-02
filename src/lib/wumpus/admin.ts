import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminSession } from "./session";
import { loadBilling } from "./shardpay";
import { loadBotGuildIds } from "./bot-guilds";
import { readRuntime, enqueueOutbox } from "./runtime.server";
import { listDashboardMembers } from "./admin-store.server";
import { readBotHealth } from "./health.server";

const tokenSchema = z.object({ token: z.string().min(1).max(4096) }).strict();
const resyncSchema = z.object({
  token: z.string().min(1).max(4096),
  guildId: z.string().regex(/^\d{17,20}$/),
}).strict();

export const getAdminOverview = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdminSession(data.token);
    const [members, billing, botGuildIds, runtime, health] = await Promise.all([
      listDashboardMembers(),
      loadBilling(),
      loadBotGuildIds(),
      readRuntime(),
      readBotHealth(),
    ]);

    const guilds = botGuildIds.map((id) => {
      const config = runtime.guilds[id];
      return {
        id,
        name: config?.name ?? id,
        hasTicketsPanel: Boolean(config?.tickets?.panelChannelId),
        hasFormsPanel: Boolean(config?.forms?.panelChannelId),
      };
    });

    return {
      ok: true as const,
      members,
      subscriptions: billing.subscriptions.map((subscription) => ({
        id: subscription.id,
        username: subscription.discordUsername ?? "Conta sem nome Discord",
        productName: subscription.productName,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        nextBillingDate: subscription.nextBillingDate,
        priceCents: subscription.priceCents,
      })),
      billingAvailable: billing.ok,
      billingError: billing.ok ? null : billing.error ?? "ShardPay indisponível.",
      guilds,
      health: health && health.status === "online" && Date.now() - health.at <= 90_000
        ? { status: "online" as const, guildCount: health.guildCount, lastSeenAt: health.at, pingMs: health.pingMs }
        : { status: "offline" as const, guildCount: health?.guildCount ?? 0, lastSeenAt: health?.at ?? null, pingMs: health?.pingMs ?? null },
    };
  });

export const forceGuildResync = createServerFn({ method: "POST" })
  .validator((input: unknown) => resyncSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdminSession(data.token);
    const [botGuildIds, runtime] = await Promise.all([loadBotGuildIds(), readRuntime()]);
    if (!botGuildIds.includes(data.guildId)) {
      throw new Error("O Wumpus não está instalado neste servidor.");
    }

    const config = runtime.guilds[data.guildId];
    if (!config) throw new Error("Ainda não há configuração publicada para este servidor.");
    const jobs = [
      { target: "tickets", channelRef: String(config.tickets?.panelChannelId ?? "") },
      { target: "forms", channelRef: String(config.forms?.panelChannelId ?? "") },
    ].filter((job) => job.channelRef.trim().length > 0);

    if (!jobs.length) throw new Error("Este servidor não tem painéis configurados para republicar.");
    const queued: string[] = [];
    for (const job of jobs) {
      const row = {
        id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        guildId: data.guildId,
        kind: "panel" as const,
        target: job.target,
        channelRef: job.channelRef,
        createdAt: Date.now(),
        status: "queued" as const,
      };
      await enqueueOutbox(row);
      queued.push(row.id);
    }
    return { ok: true as const, queued };
  });
