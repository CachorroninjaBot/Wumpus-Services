import { createServerFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdminSession } from "./session-access.server";
import { loadBilling } from "./shardpay.server";
import { loadBotGuildIds } from "./bot-guilds";
import { readRuntime, enqueueOutbox } from "./runtime.server";
import {
  getDashboardAdminState,
  addDashboardUserWithGrant,
  grantDashboardAccess,
  manageDashboardUser,
  revokeDashboardGrant,
  recordDashboardAdminEvent,
} from "./admin-store.server";
import { readBotHealth } from "./health.server";
import { SESSION_TOKEN_MAX_LENGTH, sessionSecret } from "./session-token";
import { enforceRequestLimit } from "./request-limits.server";
import type { PlanId } from "./catalog";

const tokenSchema = z.object({ token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH) }).strict();
const resyncSchema = z.object({
  token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
  guildId: z.string().regex(/^\d{17,20}$/),
}).strict();
const userActionSchema = z.object({
  token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
  userId: z.string().regex(/^\d{17,20}$/),
  action: z.enum(["suspend", "restore", "revoke-sessions", "save-notes", "remove"]),
  reason: z.string().trim().max(300).optional(),
  notes: z.string().max(2000).optional(),
}).strict();
const grantSchema = z.object({
  token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
  userId: z.string().regex(/^\d{17,20}$/),
  username: z.string().trim().min(1).max(100),
  planId: z.enum(["essencial", "pro", "escala", "vitalicio"]),
  durationDays: z.number().int().min(1).max(3650).nullable(),
  reason: z.string().trim().min(3).max(500),
}).strict().superRefine((value, context) => {
  if ((value.planId === "vitalicio") !== (value.durationDays === null)) {
    context.addIssue({ code: "custom", message: "O plano Vitalício não expira; os demais planos exigem duração." });
  }
});
const revokeGrantSchema = z.object({
  token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
  grantId: z.string().uuid(),
}).strict();

function privateResponse(): void {
  setResponseHeaders(new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie" }));
}

export const getAdminOverview = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    enforceRequestLimit("admin-overview", 60, 60_000);
    const actor = await requireAdminSession(data.token);
    privateResponse();
    const [admin, billing, botGuildIds, runtime, health] = await Promise.all([
      getDashboardAdminState(),
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
      adminId: actor.userId,
      members: admin.members,
      sessions: admin.sessions,
      events: admin.events,
      subscriptions: [
        ...billing.subscriptions.map((subscription) => ({
          id: subscription.id,
          username: subscription.discordUsername ?? "Conta sem nome Discord",
          discordUserId: subscription.discordUserId,
          productName: subscription.productName,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          nextBillingDate: subscription.nextBillingDate,
          startedAt: subscription.startedAt ?? null,
          periodEndsAt: subscription.periodEndsAt ?? null,
          canceledAt: subscription.canceledAt ?? null,
          priceCents: subscription.priceCents,
          manual: false,
          reason: null,
          planId: subscription.planId,
        })),
        ...admin.grants.map((grant) => ({
          id: grant.id,
          username: grant.username,
          discordUserId: grant.userId,
          productName: `Concessão manual · ${grant.planId}`,
          status: grant.revokedAt ? "revoked" : grant.expiresAt !== null && grant.expiresAt <= Date.now() ? "expired" : "active",
          billingCycle: grant.expiresAt === null
            ? "sem expiração"
            : `${Math.ceil(Math.max(0, grant.expiresAt - grant.createdAt) / 86_400_000)} dias concedidos`,
          nextBillingDate: "",
          startedAt: new Date(grant.createdAt).toISOString(),
          periodEndsAt: grant.expiresAt === null ? null : new Date(grant.expiresAt).toISOString(),
          canceledAt: grant.revokedAt ? new Date(grant.revokedAt).toISOString() : null,
          priceCents: 0,
          manual: true,
          reason: grant.reason,
          planId: grant.planId as PlanId,
        })),
      ],
      billingAvailable: billing.ok,
      billingError: billing.ok ? null : billing.error ?? "ShardPay indisponível.",
      billingStoreUrl: billing.storeUrl,
      guilds,
      health: health && health.status === "online" && Date.now() - health.at <= 90_000
        ? { status: "online" as const, guildCount: health.guildCount, lastSeenAt: health.at, pingMs: health.pingMs }
        : { status: "offline" as const, guildCount: health?.guildCount ?? 0, lastSeenAt: health?.at ?? null, pingMs: health?.pingMs ?? null },
      security: {
        sessionSecretConfigured: Boolean(sessionSecret()),
        shardPayKeyConfigured: Boolean(process.env.SHARDPAY_API_KEY?.trim()),
        discordClientSecretConfigured: Boolean(process.env.DISCORD_CLIENT_SECRET?.trim()),
        ownerIdConfigured: Boolean(process.env.WUMPUS_OWNER_ID?.trim()),
      },
    };
  });

export const grantAdminAccess = createServerFn({ method: "POST" })
  .validator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data }) => {
    enforceRequestLimit("admin-grant-access", 20, 60_000);
    const actor = await requireAdminSession(data.token);
    const grant = await grantDashboardAccess({
      actorId: actor.userId,
      userId: data.userId,
      username: data.username,
      planId: data.planId,
      durationDays: data.durationDays,
      reason: data.reason,
    });
    privateResponse();
    return { ok: true as const, expiresAt: grant.expiresAt };
  });

export const addAdminUser = createServerFn({ method: "POST" })
  .validator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data }) => {
    enforceRequestLimit("admin-add-user", 20, 60_000);
    const actor = await requireAdminSession(data.token);
    const grant = await addDashboardUserWithGrant({
      actorId: actor.userId,
      userId: data.userId,
      username: data.username,
      planId: data.planId,
      durationDays: data.durationDays,
      reason: data.reason,
    });
    privateResponse();
    return { ok: true as const, expiresAt: grant.expiresAt };
  });

export const revokeAdminGrant = createServerFn({ method: "POST" })
  .validator((input: unknown) => revokeGrantSchema.parse(input))
  .handler(async ({ data }) => {
    enforceRequestLimit("admin-revoke-grant", 30, 60_000);
    const actor = await requireAdminSession(data.token);
    await revokeDashboardGrant({ actorId: actor.userId, grantId: data.grantId });
    privateResponse();
    return { ok: true as const };
  });

export const manageAdminUser = createServerFn({ method: "POST" })
  .validator((input: unknown) => userActionSchema.parse(input))
  .handler(async ({ data }) => {
    enforceRequestLimit("admin-user-manage", 30, 60_000);
    const actor = await requireAdminSession(data.token);
    await manageDashboardUser({
      actorId: actor.userId,
      userId: data.userId,
      action: data.action,
      ...(data.reason !== undefined ? { reason: data.reason } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    });
    privateResponse();
    return { ok: true as const };
  });

export const forceGuildResync = createServerFn({ method: "POST" })
  .validator((input: unknown) => resyncSchema.parse(input))
  .handler(async ({ data }) => {
    enforceRequestLimit("admin-guild-resync", 20, 60_000);
    const actor = await requireAdminSession(data.token);
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
    await recordDashboardAdminEvent({
      actorId: actor.userId,
      action: "guild-resync",
      targetId: data.guildId,
      summary: `${queued.length} painel(is) enviados para republicação.`,
    });
    privateResponse();
    return { ok: true as const, queued };
  });
