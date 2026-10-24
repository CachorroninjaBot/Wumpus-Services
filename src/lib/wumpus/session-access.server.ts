import { dashboardSessionIsUsable, getDashboardSessionGuilds, listDashboardGrants, recordDashboardActivity } from "./admin-store.server";
import { loadBotGuildIds } from "./bot-guilds";
import { planAllows, type PlanFeature } from "./engine";
import { configuredLifetimeSubscriptions, resolveEntitlements, type Entitlements, type SubscriptionLite } from "./entitlements";
import { isPlatformOwner } from "./owner";
import { enforceRequestLimit } from "./request-limits.server";
import { loadBilling } from "./shardpay.server";
import { readGuildLicenses } from "./license-store.server";
import { getDashboardSessionCookie, markPrivateResponse } from "./session-cookie.server";
import { sessionSecret, verifySession, type SessionPayload } from "./session-token";

let guildAccessCache: { userId: string; guildIds: Set<string>; entitlements: Entitlements; expiresAt: number } | null = null;

/** Lê identidade apenas do cookie assinado e confere a sessão revogável no servidor. */
export async function verifySignedSession(_legacyToken: string): Promise<SessionPayload> {
  const secret = sessionSecret();
  if (!secret) throw new Error("A configuração segura de sessão está incompleta.");
  markPrivateResponse();
  const payload = await verifySession(getDashboardSessionCookie() ?? "", secret);
  if (!payload || !(await dashboardSessionIsUsable(payload.sessionId, payload.userId))) {
    throw new Error("Sessão inválida, encerrada ou revogada. Entre novamente.");
  }
  await recordDashboardActivity(payload.sessionId);
  const guilds = await getDashboardSessionGuilds(payload.sessionId, payload.userId);
  return guilds?.length ? { ...payload, guilds } : payload;
}

export async function requireAdminSession(token: string): Promise<SessionPayload> {
  const payload = await verifySignedSession(token);
  if (!isPlatformOwner(payload.userId)) throw new Error("Acesso restrito ao dono da plataforma.");
  if (!payload.mfaEnabled) {
    throw new Error("Ative a autenticação de dois fatores na conta Discord autorizada e entre novamente.");
  }
  return payload;
}

function subscriptionsFor(billing: Awaited<ReturnType<typeof loadBilling>>): SubscriptionLite[] {
  return [...billing.subscriptions.map((subscription) => ({
    status: subscription.status,
    planId: subscription.planId,
    discordUsername: subscription.discordUsername,
    discordUserId: subscription.discordUserId,
  })), ...configuredLifetimeSubscriptions()];
}

export async function loadManualSubscriptionRows(): Promise<SubscriptionLite[]> {
  const now = Date.now();
  return (await listDashboardGrants())
    .filter((grant) => !grant.revokedAt && (grant.expiresAt === null || grant.expiresAt > now))
    .map((grant) => ({
      status: "active",
      planId: grant.planId,
      discordUsername: grant.username,
      discordUserId: grant.userId,
      expiresAt: grant.expiresAt,
    }));
}

export async function requireGuildAccess(token: string, guildId: string): Promise<SessionPayload & { entitlements: Entitlements }> {
  const payload = await verifySignedSession(token);
  enforceRequestLimit("guild-api", 300, 60_000, payload.userId);
  const canManageGuild = payload.guilds.some((guild) => guild.id === guildId && guild.owner);
  const platformOwnerCanManageGuild = isPlatformOwner(payload.userId) && payload.guilds.some((guild) => guild.id === guildId);
  if (!canManageGuild && !platformOwnerCanManageGuild) throw new Error("Você não administra este servidor no Discord.");

  if (!guildAccessCache || guildAccessCache.userId !== payload.userId || guildAccessCache.expiresAt < Date.now()) {
    const [botGuildIds, billing, manualSubscriptions, licenseFile] = await Promise.all([
      loadBotGuildIds(),
      loadBilling(),
      loadManualSubscriptionRows(),
      readGuildLicenses(),
    ]);
    const entitlements = resolveEntitlements({
      discordUserId: payload.userId,
      discordUsername: payload.username,
      ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
      manageableGuildIds: payload.guilds.map((guild) => guild.id),
      botGuildIds,
      guildAccountIds: Object.fromEntries(
        Object.entries(licenseFile.byGuild)
          .filter(([, license]) => license.status === "active")
          .map(([guildId, license]) => [guildId, license.accountId]),
      ),
      subscriptions: [...subscriptionsFor(billing), ...manualSubscriptions],
    });
    guildAccessCache = { userId: payload.userId, guildIds: new Set(entitlements.guildIds), entitlements, expiresAt: Date.now() + 30_000 };
  }

  if (!guildAccessCache.guildIds.has(guildId) && !isPlatformOwner(payload.userId)) {
    throw new Error("Este servidor não está incluído na sua assinatura ou o Wumpus não está instalado.");
  }
  if (!guildAccessCache.guildIds.has(guildId)) throw new Error("O Wumpus não está instalado neste servidor.");
  return { ...payload, entitlements: guildAccessCache.entitlements };
}

/** Valida também as funcionalidades do plano em chamadas diretas à API. */
export async function requireGuildFeature(token: string, guildId: string, feature: PlanFeature): Promise<SessionPayload> {
  const session = await requireGuildAccess(token, guildId);
  const plan = session.entitlements.plan;
  if (!plan || !planAllows(plan, feature)) {
    const names: Record<PlanFeature, string> = {
      forms: "formulários",
      ai: "recursos de IA",
      multiDepartment: "múltiplos departamentos",
      antiNuke: "anti-nuke",
      transcripts: "transcrições",
      ocr: "OCR",
      webhooks: "webhooks",
    };
    throw new Error(`Seu plano não inclui ${names[feature]}. Faça upgrade para continuar.`);
  }
  return session;
}
