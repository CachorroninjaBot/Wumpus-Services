/**
 * Sessao de servidor — onde a decisao de acesso realmente acontece.
 *
 * Antes disto, o painel montava tudo no cliente: o `userId`, o plano e a lista
 * de servidores vinham do localStorage, entao editar o campo `id` para o do
 * dono bastava para entrar na area restrita.
 *
 * Agora:
 *   1. `startSession` troca o `code` do Discord e ASSINA a identidade. O
 *      `userId` dentro do token veio do Discord — o navegador nao escolhe.
 *   2. `resolveAccess` verifica a assinatura e recalcula os direitos a CADA
 *      chamada: presenca do bot e assinatura ativa sao relidas do servidor.
 *
 * Isso importa porque plano vence e bot sai de servidor. Se o direito fosse
 * gravado no token, um plano cancelado continuaria valendo ate o token expirar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { exchangeDiscordCodeDirect } from "@/lib/discord/oauth";
import { loadBotGuildIds } from "./bot-guilds";
import { configuredLifetimeSubscriptions, resolveEntitlements, type Entitlements, type SubscriptionLite } from "./entitlements";
import { loadBilling } from "./shardpay.server";
import {
  closeDashboardSession,
  isDashboardAccountSuspended,
  recordDashboardActivity,
  recordDashboardLogin,
} from "./admin-store.server";
import { syncGuildEntitlements } from "./license-store.server";
import { consumeOAuthStateCookie, clearDashboardSessionCookie, getDashboardSessionCookie, markPrivateResponse, setDashboardSessionCookie } from "./session-cookie.server";
import { enforceRequestLimit } from "./request-limits.server";
import { loadManualSubscriptionRows, verifySignedSession } from "./session-access.server";
import {
  sessionSecret,
  signSession,
  verifySession,
  type SessionGuild,
  type SessionPayload,
} from "./session-token";

export type SessionUserView = {
  id: string;
  username: string;
  globalName: string;
  avatar: string | null;
  mfaEnabled: boolean;
};

export type AccessResult =
  | { ok: true; session: SessionUserView; guilds: SessionGuild[]; entitlements: Entitlements }
  | { ok: false; error: string };

function subscriptionRows(billing: Awaited<ReturnType<typeof loadBilling>>): SubscriptionLite[] {
  return [...billing.subscriptions.map((sub) => ({
    status: sub.status,
    planId: sub.planId,
    discordUsername: sub.discordUsername,
    discordUserId: sub.discordUserId,
  })), ...configuredLifetimeSubscriptions()];
}

/** Entra com o `code` do Discord e devolve um token assinado. */
export const startSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ code: z.string().min(1).max(2048), state: z.string().regex(/^[0-9a-f-]{36}$/i) }).strict().parse(input))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    enforceRequestLimit("discord-login", 10, 10 * 60_000);
    if (!consumeOAuthStateCookie(data.state)) return { ok: false, error: "A validação do login expirou. Volte ao início e tente novamente." };
    const secret = sessionSecret();
    if (!secret) return { ok: false, error: "A configuração segura de sessão está incompleta." };

    let exchanged: Awaited<ReturnType<typeof exchangeDiscordCodeDirect>>;
    try {
      exchanged = await exchangeDiscordCodeDirect(data.code);
    } catch (error) {
      console.error("Falha de rede durante autenticação Discord.", error);
      return { ok: false, error: "Não foi possível concluir o login com o Discord. Tente novamente." };
    }
    if (!exchanged.ok) return { ok: false, error: exchanged.error };
    if (await isDashboardAccountSuspended(exchanged.user.id)) {
      return { ok: false, error: "Esta conta está suspensa. Fale com o suporte da plataforma." };
    }

    const payload: SessionPayload = {
      sessionId: randomUUID(),
      userId: exchanged.user.id,
      username: exchanged.user.username,
      globalName: exchanged.user.globalName,
      avatar: exchanged.user.avatar ?? null,
      mfaEnabled: exchanged.user.mfaEnabled,
      guilds: exchanged.guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconUrl ?? null,
        owner: guild.owner,
      })),
    };

    const token = await signSession(payload, secret);
    try {
      await recordDashboardLogin({ id: payload.userId, username: payload.username }, payload.sessionId, payload.guilds);
    } catch (error) {
      console.error("Não foi possível registrar a sessão autenticada.", error);
      return { ok: false, error: error instanceof Error && error.message.includes("suspensa")
        ? error.message
        : "Não foi possível registrar a sessão com segurança. Tente novamente." };
    }
    setDashboardSessionCookie(token);
    return { ok: true };
  });

/**
 * Resolve o que esta pessoa pode ver AGORA.
 *
 * Nao confia em nada que o cliente mandou alem do token assinado. Sem token
 * valido devolve erro — nunca um acesso "vazio mas liberado".
 */
export const resolveAccess = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ token: z.string().max(64).optional() }).strict().parse(input),
  )
  .handler(async (): Promise<AccessResult> => {
    enforceRequestLimit("resolve-access", 60, 60_000);
    markPrivateResponse();
    const secret = sessionSecret();
    if (!secret) return { ok: false, error: "Segredo de sessão ausente no servidor." };

    let payload: SessionPayload;
    try {
      payload = await verifySignedSession("");
    } catch (error) {
      if (error instanceof Error && /sessão inválida|encerrada ou revogada/i.test(error.message)) {
        clearDashboardSessionCookie();
      }
      return { ok: false, error: error instanceof Error ? error.message : "Sessão inválida ou expirada. Entre de novo." };
    }

    // Relido do servidor a cada chamada: bot que saiu e assinatura que venceu
    // deixam de valer sem depender de nada guardado no navegador.
    const [botGuildIds, billing, manualSubscriptions] = await Promise.all([
      loadBotGuildIds(),
      loadBilling(),
      loadManualSubscriptionRows(),
    ]);

    const subscriptions = [...subscriptionRows(billing), ...manualSubscriptions];

    const entitlements = resolveEntitlements({
      discordUserId: payload.userId,
      discordUsername: payload.username,
      // Ser dono vem do Discord, dentro do token assinado.
      ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
      manageableGuildIds: payload.guilds.map((guild) => guild.id),
      botGuildIds,
      subscriptions,
    });

    // Se a ShardPay respondeu, publica a decisão atual para o processo do bot.
    // Em indisponibilidade temporária, preserva a última licença conhecida.
    if (billing.ok || entitlements.isOwner || manualSubscriptions.some((sub) => sub.discordUserId === payload.userId) || configuredLifetimeSubscriptions().some((sub) => sub.discordUserId === payload.userId)) {
      await syncGuildEntitlements({
        accountId: payload.userId,
        discordUsername: payload.username,
        planId: entitlements.plan,
        botGuildIds,
        ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
        allowedGuildIds: entitlements.guildIds,
      });
    }

    return {
      ok: true,
      session: {
        id: payload.userId,
        username: payload.username,
        globalName: payload.globalName,
        avatar: payload.avatar,
        mfaEnabled: payload.mfaEnabled,
      },
      guilds: payload.guilds,
      entitlements,
    };
  });

export const heartbeatDashboardSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async () => {
    try {
      const payload = await verifySignedSession("");
      await recordDashboardActivity(payload.sessionId);
      return { ok: true as const };
    } catch (error) {
      if (error instanceof Error && /sessão inválida|encerrada ou revogada/i.test(error.message)) {
        clearDashboardSessionCookie();
        return { ok: false as const, reason: "expired" as const };
      }
      throw error;
    }
  });

export const logoutDashboardSession = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async () => {
    const raw = getDashboardSessionCookie();
    const secret = sessionSecret();
    if (raw && secret) {
      const payload = await verifySession(raw, secret);
      if (payload) await closeDashboardSession(payload.sessionId);
    }
    clearDashboardSessionCookie();
    return { ok: true as const };
  });
