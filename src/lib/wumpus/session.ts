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
import { jwtVerify, SignJWT } from "jose";
import { discordClientId, exchangeDiscordCodeDirect } from "@/lib/discord/oauth";
import { loadBotGuildIds } from "./bot-guilds";
import { planById, serverLimit } from "./catalog";
import { configuredLifetimeSubscriptions, planForUser, resolveEntitlements, type Entitlements, type SubscriptionLite } from "./entitlements";
import { inspectBotHealth } from "./health.server";
import { isPlatformOwner } from "./owner";
import { loadBilling } from "./shardpay.server";
import {
  closeDashboardSession,
  getDashboardGuildSelection,
  isDashboardAccountSuspended,
  recordDashboardActivity,
  recordDashboardLogin,
  saveDashboardGuildSelection,
} from "./admin-store.server";
import { readGuildLicenses, syncGuildEntitlements } from "./license-store.server";
import { consumeOAuthStateCookie, clearDashboardSessionCookie, getDashboardSessionCredential, markPrivateResponse, setDashboardSessionCookie } from "./session-cookie.server";
import { enforceRequestLimit } from "./request-limits.server";
import { invalidateGuildAccessCache, loadManualSubscriptionRows, verifySignedSession } from "./session-access.server";
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

export type GuildAccessDiagnostics = {
  checkedAt: number;
  ownedGuildCount: number;
  botGuildCount: number;
  matchingGuildCount: number;
  linkedToAnotherAccountCount: number;
  eligibleGuildCount: number;
  planName: string | null;
  planLimit: number | null;
  selectedGuildIds: string[];
  botAvailable: boolean;
  ownedGuilds: Array<{ id: string; name: string; botPresent: boolean }>;
  availableGuilds: Array<{ id: string; name: string; selected: boolean; linkedElsewhere: boolean }>;
  billingAvailable: boolean;
  issue: "none" | "bot-unavailable" | "no-owned-guilds" | "no-bot-match" | "linked-elsewhere" | "billing-unavailable" | "no-plan" | "select-guilds" | "refresh-session";
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
    if (!exchanged.ok) return exchanged;
    const created = await createDashboardSession(exchanged);
    if (!created.ok) return created;
    setDashboardSessionCookie(created.sessionToken);
    return { ok: true };
  });

function activityClientId(): string {
  const clientId = discordClientId().trim();
  if (!/^\d{17,20}$/.test(clientId)) throw new Error("Configure DISCORD_CLIENT_ID com o ID da aplicação Discord.");
  return clientId;
}

export const getActivityAuthorizationState = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async (): Promise<{ state: string; clientId: string }> => {
    enforceRequestLimit("discord-activity-state", 30, 10 * 60_000);
    markPrivateResponse();
    const secret = sessionSecret();
    if (!secret) throw new Error("A configuração segura de sessão está incompleta.");
    const state = await new SignJWT({ purpose: "discord-activity-oauth" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("wumpus")
      .setAudience("discord-activity")
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(secret);
    return { state, clientId: activityClientId() };
  });

export const startActivitySession = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    code: z.string().min(1).max(2048),
    state: z.string().min(1).max(4096),
    codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  }).strict().parse(input))
  .handler(async ({ data }): Promise<
    | { ok: true; sessionToken: string; discordAccessToken: string }
    | { ok: false; error: string }
  > => {
    enforceRequestLimit("discord-activity-login", 10, 10 * 60_000);
    markPrivateResponse();
    const secret = sessionSecret();
    if (!secret) return { ok: false, error: "A configuração segura de sessão está incompleta." };
    try {
      const { payload } = await jwtVerify(data.state, secret, {
        algorithms: ["HS256"],
        issuer: "wumpus",
        audience: "discord-activity",
      });
      if (payload.purpose !== "discord-activity-oauth") {
        return { ok: false, error: "A autorização da Activity é inválida. Feche e abra a Activity novamente." };
      }
    } catch {
      return { ok: false, error: "A autorização da Activity expirou. Feche e abra a Activity novamente." };
    }

    let exchanged: Awaited<ReturnType<typeof exchangeDiscordCodeDirect>>;
    try {
      exchanged = await exchangeDiscordCodeDirect(data.code, {
        includeAccessToken: true,
        codeVerifier: data.codeVerifier,
      });
    } catch (error) {
      console.error("Falha de rede durante autenticação Discord da Activity.", error);
      return { ok: false, error: "Não foi possível autenticar no Discord. Tente novamente." };
    }
    if (!exchanged.ok) return exchanged;
    if (!exchanged.accessToken) return { ok: false, error: "O Discord não retornou o token necessário para abrir a Activity." };

    const created = await createDashboardSession(exchanged);
    if (!created.ok) return created;
    return {
      ok: true,
      sessionToken: created.sessionToken,
      discordAccessToken: exchanged.accessToken,
    };
  });

async function createDashboardSession(
  exchanged: Extract<Awaited<ReturnType<typeof exchangeDiscordCodeDirect>>, { ok: true }>,
): Promise<{ ok: true; sessionToken: string } | { ok: false; error: string }> {
  if (await isDashboardAccountSuspended(exchanged.user.id)) {
    return { ok: false, error: "Esta conta está suspensa. Fale com o suporte da plataforma." };
  }
  const secret = sessionSecret();
  if (!secret) return { ok: false, error: "A configuração segura de sessão está incompleta." };
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
  const sessionToken = await signSession(payload, secret);
  try {
    await recordDashboardLogin({ id: payload.userId, username: payload.username }, payload.sessionId, payload.guilds);
  } catch (error) {
    console.error("Não foi possível registrar a sessão autenticada.", error);
    return {
      ok: false,
      error: error instanceof Error && error.message.includes("suspensa")
        ? error.message
        : "Não foi possível registrar a sessão com segurança. Tente novamente.",
    };
  }
  return { ok: true, sessionToken };
}

/**
 * Resolve o que esta pessoa pode ver AGORA.
 *
 * Nao confia em nada que o cliente mandou alem do token assinado. Sem token
 * valido devolve erro — nunca um acesso "vazio mas liberado".
 */
export const resolveAccess = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ token: z.string().max(16_384).optional() }).strict().parse(input),
  )
  .handler(async ({ data }): Promise<AccessResult> => {
    enforceRequestLimit("resolve-access", 60, 60_000);
    markPrivateResponse();
    const secret = sessionSecret();
    if (!secret) return { ok: false, error: "Segredo de sessão ausente no servidor." };

    let payload: SessionPayload;
    try {
      payload = await verifySignedSession(data.token ?? "");
    } catch (error) {
      if (error instanceof Error && /sessão inválida|encerrada ou revogada/i.test(error.message)) {
        clearDashboardSessionCookie();
      }
      return { ok: false, error: error instanceof Error ? error.message : "Sessão inválida ou expirada. Entre de novo." };
    }

    // Relido do servidor a cada chamada: bot que saiu e assinatura que venceu
    // deixam de valer sem depender de nada guardado no navegador.
    const [botGuildIds, billing, manualSubscriptions, licenseFile, selectedGuildIds] = await Promise.all([
      loadBotGuildIds(),
      loadBilling(),
      loadManualSubscriptionRows(),
      readGuildLicenses(),
      getDashboardGuildSelection(payload.userId),
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
        Object.entries(licenseFile.byGuild)
          .filter(([, license]) => license.status === "active")
          .map(([guildId, license]) => [guildId, license.accountId]),
      ),
      selectedGuildIds,
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

export const getMyGuildAccessDiagnostics = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async (): Promise<GuildAccessDiagnostics> => {
    enforceRequestLimit("guild-access-diagnostics", 20, 60_000);
    const session = await verifySignedSession("");
    const [health, billing, manualSubscriptions, licenses, selectedGuildIds] = await Promise.all([
      inspectBotHealth(),
      loadBilling(),
      loadManualSubscriptionRows(),
      readGuildLicenses(),
      getDashboardGuildSelection(session.userId),
    ]);
    const botRecord = health.state === "available" ? health.record : null;
    const healthAgeMs = botRecord ? Date.now() - botRecord.at : Number.POSITIVE_INFINITY;
    const botAvailable = botRecord !== null && botRecord.status === "online" &&
      healthAgeMs <= 90_000 && botRecord.guildIds.length > 0;
    const botGuildIds = new Set(botAvailable && botRecord ? botRecord.guildIds : []);
    const ownedGuilds = session.guilds.filter((guild) => guild.owner);
    const matchingGuilds = ownedGuilds.filter((guild) => botGuildIds.has(guild.id));
    const linkedToAnotherAccountCount = matchingGuilds.filter((guild) => {
      const license = licenses.byGuild[guild.id];
      return license?.status === "active" && license.accountId !== session.userId;
    }).length;
    const eligibleGuildCount = matchingGuilds.length - linkedToAnotherAccountCount;
    const eligibleGuildIds = new Set(matchingGuilds
      .filter((guild) => licenses.byGuild[guild.id]?.status !== "active" ||
        licenses.byGuild[guild.id]?.accountId === session.userId)
      .map((guild) => guild.id));
    const validSelectedGuildIds = selectedGuildIds.filter((id) => eligibleGuildIds.has(id));
    const selectedEligibleCount = validSelectedGuildIds.length;
    const plan = planForUser(
      [...subscriptionRows(billing), ...manualSubscriptions],
      session.userId,
      session.username,
    );

    let issue: GuildAccessDiagnostics["issue"] = "none";
    let recommendation = "A conta tem servidores elegíveis. Atualize a conexão com o Discord para recarregar a lista.";
    if (!botAvailable) {
      issue = "bot-unavailable";
      recommendation = "O painel não recebeu uma lista recente de servidores do bot. Verifique o volume compartilhado e WUMPUS_HEALTH_PATH entre o bot e o painel.";
    } else if (!ownedGuilds.length) {
      issue = "no-owned-guilds";
      recommendation = "O Discord não marcou nenhum servidor desta conta como propriedade dela. Confirme a conta conectada e atualize a conexão com o Discord.";
    } else if (!matchingGuilds.length) {
      issue = "no-bot-match";
      recommendation = "O bot não está em nenhum servidor que o Discord identifica como seu. Confira o servidor e a conta conectada.";
    } else if (!eligibleGuildCount) {
      issue = "linked-elsewhere";
      recommendation = "Os servidores em comum estão vinculados na dashboard a outra conta. Peça ao titular desse vínculo para liberar o servidor antes de usar esta conta.";
    } else if (!billing.ok && !manualSubscriptions.some((sub) => sub.discordUserId === session.userId) &&
      !configuredLifetimeSubscriptions().some((sub) => sub.discordUserId === session.userId)) {
      issue = "billing-unavailable";
      recommendation = "Não foi possível consultar a ShardPay agora. Aguarde a restauração do serviço e verifique novamente antes de concluir que esta conta não tem plano.";
    } else if (!plan) {
      issue = "no-plan";
      recommendation = "O bot e a propriedade dos servidores foram confirmados, mas esta conta não tem um plano ativo. Assine um plano ou solicite uma concessão manual ao administrador.";
    } else if (!selectedEligibleCount) {
      issue = "select-guilds";
      recommendation = "Escolha abaixo quais servidores você quer gerenciar. A quantidade máxima segue o seu plano.";
    }

    return {
      checkedAt: Date.now(),
      ownedGuildCount: ownedGuilds.length,
      botGuildCount: botAvailable && botRecord ? botRecord.guildIds.length : 0,
      matchingGuildCount: matchingGuilds.length,
      linkedToAnotherAccountCount,
      eligibleGuildCount,
      planName: plan ? planById(plan.plan).name : null,
      planLimit: plan ? serverLimit(plan.plan) : null,
      selectedGuildIds: validSelectedGuildIds,
      botAvailable,
      ownedGuilds: ownedGuilds.map((guild) => ({ id: guild.id, name: guild.name, botPresent: botGuildIds.has(guild.id) })),
      availableGuilds: matchingGuilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        selected: validSelectedGuildIds.includes(guild.id),
        linkedElsewhere: licenses.byGuild[guild.id]?.status === "active" &&
          licenses.byGuild[guild.id]?.accountId !== session.userId,
      })),
      billingAvailable: billing.ok,
      issue,
      recommendation,
    };
  });

export const saveMyGuildSelection = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    guildIds: z.array(z.string().regex(/^\d{17,20}$/)).max(200),
  }).strict().parse(input))
  .handler(async ({ data }): Promise<{ ok: true; selectedCount: number }> => {
    enforceRequestLimit("save-guild-selection", 20, 60_000);
    markPrivateResponse();
    const session = await verifySignedSession("");
    if (isPlatformOwner(session.userId)) {
      throw new Error("O dono da plataforma não precisa selecionar servidores para acessar a dashboard.");
    }

    const [health, billing, manualSubscriptions, licenses] = await Promise.all([
      inspectBotHealth(),
      loadBilling(),
      loadManualSubscriptionRows(),
      readGuildLicenses(),
    ]);
    const botRecord = health.state === "available" ? health.record : null;
    if (!botRecord || botRecord.status !== "online" || Date.now() - botRecord.at > 90_000) {
      throw new Error("A lista atual do bot está indisponível. Tente novamente quando o bot estiver online.");
    }
    const ownedIds = new Set(session.guilds.filter((guild) => guild.owner).map((guild) => guild.id));
    const botIds = new Set(botRecord.guildIds);
    const eligibleIds = new Set([...ownedIds].filter((id) => {
      if (!botIds.has(id)) return false;
      const license = licenses.byGuild[id];
      return license?.status !== "active" || license.accountId === session.userId;
    }));
    const uniqueGuildIds = [...new Set(data.guildIds)];
    if (uniqueGuildIds.some((id) => !eligibleIds.has(id))) {
      throw new Error("Um ou mais servidores não pertencem a esta conta, não estão no bot ou estão vinculados a outra conta.");
    }

    const plan = planForUser(
      [...subscriptionRows(billing), ...manualSubscriptions],
      session.userId,
      session.username,
    );
    if (!plan) throw new Error("É necessário ter um plano ativo para selecionar servidores.");
    const limit = serverLimit(plan.plan);
    if (limit !== null && uniqueGuildIds.length > limit) {
      throw new Error(`Seu plano permite selecionar até ${limit} servidor(es).`);
    }

    await saveDashboardGuildSelection({ actorId: session.userId, guildIds: uniqueGuildIds });
    invalidateGuildAccessCache(session.userId);
    return { ok: true, selectedCount: uniqueGuildIds.length };
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
    const raw = getDashboardSessionCredential();
    const secret = sessionSecret();
    if (raw && secret) {
      const payload = await verifySession(raw, secret);
      if (payload) await closeDashboardSession(payload.sessionId);
    }
    clearDashboardSessionCookie();
    return { ok: true as const };
  });
