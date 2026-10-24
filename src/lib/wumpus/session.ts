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
import { inspectBotHealth } from "./health.server";
import { isPlatformOwner } from "./owner";
import { loadBilling } from "./shardpay.server";
import {
  closeDashboardSession,
  isDashboardAccountSuspended,
  recordDashboardActivity,
  recordDashboardLogin,
} from "./admin-store.server";
import { syncGuildEntitlements } from "./license-store.server";
import { readGuildLicenses } from "./license-store.server";
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

export type OwnerGuildDiagnostics = {
  checkedAt: number;
  healthPath: string;
  manageableGuildCount: number;
  healthState: "available" | "missing" | "invalid" | "unreadable";
  healthPathSource: "configured" | "default";
  healthStatus: "online" | "offline" | null;
  healthAgeSeconds: number | null;
  healthGuildCount: number;
  matchingGuildCount: number;
  errorCode?: string;
  issue: "none" | "discord-guilds" | "health-file" | "health-invalid" | "health-unreadable" | "health-stale" | "bot-offline" | "bot-no-guilds" | "guild-mismatch";
  recommendation: string;
};

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
    const [botGuildIds, billing, manualSubscriptions, licenseFile] = await Promise.all([
      loadBotGuildIds(),
      loadBilling(),
      loadManualSubscriptionRows(),
      readGuildLicenses(),
    ]);

    const subscriptions = [...subscriptionRows(billing), ...manualSubscriptions];

    const entitlements = resolveEntitlements({
      discordUserId: payload.userId,
      discordUsername: payload.username,
      // Ser dono vem do Discord, dentro do token assinado.
      ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
      manageableGuildIds: payload.guilds.map((guild) => guild.id),
      botGuildIds,
      guildAccountIds: Object.fromEntries(
        Object.entries(licenseFile.byGuild).map(([guildId, license]) => [guildId, license.accountId]),
      ),
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

export const getOwnerGuildDiagnostics = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async (): Promise<OwnerGuildDiagnostics> => {
    enforceRequestLimit("owner-guild-diagnostics", 20, 60_000);
    const session = await verifySignedSession("");
    if (!isPlatformOwner(session.userId)) {
      throw new Error("Diagnóstico disponível apenas para o dono da plataforma.");
    }

    const checkedAt = Date.now();
    const health = await inspectBotHealth();
    const healthAgeSeconds = health.record ? Math.max(0, Math.floor((checkedAt - health.record.at) / 1000)) : null;
    const manageableGuildCount = session.guilds.length;
    const botGuildIds = new Set(health.record?.guildIds ?? []);
    const matchingGuildCount = session.guilds.filter((guild) => botGuildIds.has(guild.id)).length;

    let issue: OwnerGuildDiagnostics["issue"] = "none";
    let recommendation = "A conexão do bot está saudável. Se a lista continuar vazia, atualize a página e verifique os logs do painel.";
    if (health.state === "missing") {
      issue = "health-file";
      recommendation = "O painel não encontrou o arquivo de saúde. Verifique se bot e painel compartilham o volume e se WUMPUS_HEALTH_PATH aponta para o mesmo arquivo nos dois serviços.";
    } else if (health.state === "invalid") {
      issue = "health-invalid";
      recommendation = "O arquivo de saúde existe, mas está inválido. Reinicie o bot para ele gerar um novo heartbeat.";
    } else if (health.state === "unreadable") {
      issue = "health-unreadable";
      recommendation = "O painel não consegue ler o arquivo de saúde. Confira o caminho e as permissões de leitura do serviço.";
    } else if (healthAgeSeconds !== null && healthAgeSeconds > 90) {
      issue = "health-stale";
      recommendation = "O heartbeat está antigo. Verifique se o bot continua ligado e se consegue gravar no volume compartilhado.";
    } else if (health.record?.status !== "online") {
      issue = "bot-offline";
      recommendation = "O último heartbeat informa que o bot está offline. Reinicie o processo do bot e confira os logs dele.";
    } else if (health.record.guildIds.length === 0) {
      issue = "bot-no-guilds";
      recommendation = "O bot reportou zero servidores. Confira a conexão do bot com o Discord e reinicie-o.";
    } else if (manageableGuildCount === 0) {
      issue = "discord-guilds";
      recommendation = "A sessão não tem servidores administráveis registrados. Use “Atualizar conexão com o Discord” para autorizar novamente com a conta correta.";
    } else if (matchingGuildCount === 0) {
      issue = "guild-mismatch";
      recommendation = "O bot está ativo, mas não aparece em nenhum servidor administrável por esta conta. Confirme se esta é a conta Discord correta e se o bot foi adicionado a um dos seus servidores.";
    }

    const diagnostics: OwnerGuildDiagnostics = {
      checkedAt,
      healthPath: process.env.WUMPUS_HEALTH_PATH?.trim() || "data/wumpus-health.json (padrão relativo a process.cwd())",
      manageableGuildCount,
      healthState: health.state,
      healthPathSource: health.pathSource,
      healthStatus: health.record?.status ?? null,
      healthAgeSeconds,
      healthGuildCount: health.record?.guildIds.length ?? 0,
      matchingGuildCount,
      ...(health.errorCode ? { errorCode: health.errorCode } : {}),
      issue,
      recommendation,
    };
    console.info("[owner-guild-diagnostics]", JSON.stringify({
      checkedAt: diagnostics.checkedAt,
      manageableGuildCount: diagnostics.manageableGuildCount,
      healthState: diagnostics.healthState,
      healthPathSource: diagnostics.healthPathSource,
      healthStatus: diagnostics.healthStatus,
      healthAgeSeconds: diagnostics.healthAgeSeconds,
      healthGuildCount: diagnostics.healthGuildCount,
      matchingGuildCount: diagnostics.matchingGuildCount,
      errorCode: diagnostics.errorCode,
      issue: diagnostics.issue,
      recommendation: diagnostics.recommendation,
    }));
    return diagnostics;
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
