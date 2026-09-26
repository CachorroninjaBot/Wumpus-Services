import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { modules as allModules, type ModuleId } from "../core/brand.js";
import { defaultsFor } from "../core/module-defaults.js";
import {
  verifyWebhookSecret,
  isShardPayEvent,
  getPlanLimitsFromProductId,
  type ShardPayEvent,
  type InvoiceData,
  type SubscriptionCreatedData
} from "./shardpay.js";
import {
  authorizeUrl,
  avatarUrl,
  canManage,
  exchangeCode,
  fetchCurrentUser,
  fetchUserGuilds,
  guildIconUrl,
  issueSessionCookie,
  newState,
  readSessionCookie
} from "./auth.js";
import {
  assignGuildToGroup,
  createGroup,
  getPool,
  listAuditEvents,
  listGroups,
  listInstalledGuilds,
  listServerExceptions,
  recordAuditEvent,
  removeGuildFromGroup,
  saveModuleConfig,
  setServerException
} from "./db/index.js";
import { getGuildOverview, getGroupForGuild } from "./db/overview.js";
import { listGuildAssets, listRecentPublications, queuePublication } from "./db/publishing.js";
import { resyncAutomod } from "../bot/index.js";
import { createSession, deleteSession, getSession, upsertUser, type SessionRecord } from "./db/sessions.js";
import {
  addMember,
  ensureOwnerSeeded,
  isAdmin,
  isAllowed,
  listMembers,
  ownerIdFromEnv,
  removeMember,
  touchMember,
  type DashboardRole
} from "./db/members.js";
import { snapshotMetrics, flushMetrics } from "./metrics.js";

const SESSION_COOKIE = "wumpus_session";
const STATE_COOKIE = "wumpus_oauth_state";

const moduleIds = new Set<string>(allModules.map((entry) => entry.id));
const exceptionModes = new Set(["inherit", "disabled", "override"]);

const secureCookies = process.env.NODE_ENV !== "development";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies,
    path: "/",
    maxAge
  };
}

/** Le a sessao da requisicao ou responde 401. */
async function currentSession(request: FastifyRequest, reply: FastifyReply): Promise<SessionRecord | null> {
  const sessionId = readSessionCookie(request.cookies[SESSION_COOKIE]);
  if (!sessionId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  const session = await getSession(sessionId);
  if (!session) {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    reply.code(401).send({ error: "session_expired" });
    return null;
  }

  // Trava 2 (a de cada requisicao): quem foi removido da lista perde o acesso
  // na hora, mesmo com a sessao ainda valida. Sem isto, alguem removido
  // continuaria navegando por ate 14 dias.
  if (!(await isAllowed(session.userId))) {
    await deleteSession(sessionId).catch(() => undefined);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    reply.code(403).send({ error: "not_authorized" });
    return null;
  }

  void touchMember(session.userId);
  return session;
}

/** Confirma que o cliente realmente gerencia este servidor. */
function hasGuildAccess(session: SessionRecord, guildId: string): boolean {
  return session.guilds.some((guild) => guild.id === guildId);
}

async function ownsGroup(groupId: number, userId: string): Promise<boolean> {
  const result = await getPool().query(`select 1 from groups where id = $1 and owner_id = $2`, [groupId, userId]);
  return result.rowCount === 1;
}

function parseModule(value: string): ModuleId | null {
  return moduleIds.has(value) ? (value as ModuleId) : null;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await ensureOwnerSeeded().catch(() => undefined);

  /* -------------------- ShardPay Webhook ---------------------------- */

  app.post("/api/webhooks/shardpay", async (request, reply) => {
    // 1. Verificar segredo
    const secret = request.headers["x-shard-webhook-secret"] as string | undefined;
    if (!verifyWebhookSecret(secret)) {
      app.log.warn("shardpay webhook: segredo inválido");
      return reply.code(401).send({ error: "invalid_secret" });
    }

    const eventType = request.headers["x-shard-event"] as string | undefined;
    const deliveryId = request.headers["x-shard-delivery"] as string | undefined;
    const body = request.body;

    if (!isShardPayEvent(body)) {
      return reply.code(400).send({ error: "invalid_payload" });
    }

    app.log.info({ event: body.type, deliveryId }, `shardpay webhook: ${body.type}`);

    try {
      switch (body.type) {
        case "invoice.created": {
          // Log only
          const data = body.data as InvoiceData;
          app.log.info({ invoiceId: data.invoice_id, product: data.product_name, amount: data.amount_cents }, "shardpay: fatura criada");
          break;
        }

        case "invoice.paid": {
          const data = body.data as InvoiceData;
          const discordUserId = data.discord_user_id;
          const productId = data.product_id;
          const planLimits = getPlanLimitsFromProductId(productId);

          if (discordUserId) {
            // Atualiza ou cria licença
            await getPool().query(
              `insert into licenses (discord_user_id, plan, status, max_servers, notes, created_at, updated_at)
               values ($1, $2, 'active', $3, $4, now(), now())
               on conflict (discord_user_id) do update
                 set plan = excluded.plan,
                     status = 'active',
                     max_servers = excluded.max_servers,
                     notes = excluded.notes,
                     updated_at = now()`,
              [discordUserId, planLimits.plan, planLimits.maxServers, `ShardPay: ${data.product_name} · fatura ${data.invoice_id}`]
            );

            app.log.info({ discordUserId, plan: planLimits.plan, maxServers: planLimits.maxServers }, "shardpay: licença ativada/atualizada");
          }
          break;
        }

        case "invoice.refunded": {
          const data = body.data as InvoiceData;
          const discordUserId = data.discord_user_id;
          if (discordUserId) {
            await getPool().query(
              `update licenses set status = 'expired', updated_at = now() where discord_user_id = $1`,
              [discordUserId]
            );
            app.log.info({ discordUserId }, "shardpay: licença expirada (reembolso)");
          }
          break;
        }

        case "subscription.pending": {
          // Log: checkout iniciado, mas pagamento ainda não confirmado
          const data = body.data as { cart_id?: string; gateway_subscription_id?: string; discord_user_id?: string; product_id?: string };
          app.log.info({
            cartId: data.cart_id,
            gatewaySubId: data.gateway_subscription_id,
            discordUserId: data.discord_user_id,
            productId: data.product_id
          }, "shardpay: assinatura pendente (checkout em andamento)");
          break;
        }

        case "subscription.created": {
          const data = body.data as SubscriptionCreatedData;
          const discordUserId = data.discord_user_id;
          const productId = data.product_id;
          const planLimits = getPlanLimitsFromProductId(productId);

          if (discordUserId) {
            await getPool().query(
              `insert into licenses (discord_user_id, plan, status, max_servers, notes, created_at, updated_at)
               values ($1, $2, 'active', $3, $4, now(), now())
               on conflict (discord_user_id) do update
                 set plan = excluded.plan,
                     status = 'active',
                     max_servers = excluded.max_servers,
                     notes = excluded.notes,
                     updated_at = now()`,
              [discordUserId, planLimits.plan, planLimits.maxServers, `ShardPay subscription: ${data.subscription_id}`]
            );

            app.log.info({ discordUserId, plan: planLimits.plan, subscriptionId: data.subscription_id }, "shardpay: assinatura criada");
          }
          break;
        }

        case "subscription.cancelled": {
          const data = body.data as SubscriptionCreatedData;
          const discordUserId = data.discord_user_id;
          if (discordUserId) {
            await getPool().query(
              `update licenses set status = 'expired', updated_at = now() where discord_user_id = $1`,
              [discordUserId]
            );
            app.log.info({ discordUserId, subscriptionId: data.subscription_id }, "shardpay: assinatura cancelada");
          }
          break;
        }

        default:
          app.log.info({ type: body.type }, "shardpay: evento não tratado");
      }
    } catch (error) {
      app.log.error({ err: error, event: body.type }, "shardpay: erro ao processar webhook");
      // Ainda retorna 200 para não causar retry
    }

    return reply.code(200).send({ ok: true, event: body.type, deliveryId });
  });

  /* ------------------------------ OAuth ------------------------------ */

  app.get("/auth/discord", async (_request, reply) => {
    const state = newState();
    reply.setCookie(STATE_COOKIE, state, cookieOptions(600));
    return reply.redirect(authorizeUrl(state));
  });

  app.get("/auth/discord/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const expectedState = request.cookies[STATE_COOKIE];

    if (query.error || !query.code) {
      return reply.redirect("/wumpus?error=access_denied");
    }
    if (!query.state || !expectedState || query.state !== expectedState) {
      return reply.redirect("/wumpus?error=invalid_state");
    }
    reply.clearCookie(STATE_COOKIE, { path: "/" });

    try {
      const accessToken = await exchangeCode(query.code);
      const [user, guilds] = await Promise.all([fetchCurrentUser(accessToken), fetchUserGuilds(accessToken)]);

      // O access token morre aqui: nada dele e persistido.
      const managed = guilds.filter(canManage);

      // Trava 1 (a do login): sem estar na lista, nem sessao e criada.
      // O Discord disse QUEM e a pessoa; nao disse que ela pode entrar.
      if (!(await isAllowed(user.id))) {
        app.log.info({ userId: user.id }, "login recusado: usuario fora da lista de acesso");
        return reply.redirect("/wumpus?error=not_authorized");
      }

      await upsertUser({
        id: user.id,
        username: user.username,
        globalName: user.global_name,
        avatar: user.avatar,
        avatarUrl: avatarUrl(user),
        locale: user.locale
      });

      const { sessionId, expiresAt } = await createSession({
        userId: user.id,
        userAgent: request.headers["user-agent"] ?? null,
        guilds: managed.map((guild) => ({
          id: guild.id,
          name: guild.name,
          iconUrl: guildIconUrl(guild),
          owner: guild.owner
        }))
      });

      reply.setCookie(
        SESSION_COOKIE,
        issueSessionCookie(sessionId),
        cookieOptions(Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      );
      return reply.redirect("/wumpus");
    } catch (error) {
      app.log.error({ err: error }, "falha no callback do OAuth");
      return reply.redirect("/wumpus?error=oauth_failed");
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = readSessionCookie(request.cookies[SESSION_COOKIE]);
    if (sessionId) await deleteSession(sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  /* -------------------- Limites do plano --------------------------- */

  app.get("/api/limits", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;

    const result = await getPool().query(
      `select plan, max_servers as "maxServers", status from licenses where discord_user_id = $1`,
      [session.userId]
    );
    const license = result.rows[0];

    if (!license || license.status !== "active") {
      const { getPlanLimits } = await import("./shardpay.js");
      return { plan: "starter", license: null, limits: getPlanLimits("starter") };
    }

    const { getPlanLimits } = await import("./shardpay.js");
    return { plan: license.plan, license, limits: getPlanLimits(license.plan) };
  });

  /* -------------------- Login por senha (admin) ---------------------- */

  app.post("/auth/admin", async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { username?: string; password?: string };
      const envUser = process.env.DASHBOARD_USERNAME?.trim();
      const envPass = process.env.DASHBOARD_PASSWORD?.trim();

      if (!envUser || !envPass) {
        return reply.code(503).send({ error: "admin_login_not_configured" });
      }

      if ((body.username ?? "").trim() !== envUser || (body.password ?? "") !== envPass) {
        app.log.info("login por senha recusado: credenciais invalidas");
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      const ownerId = ownerIdFromEnv();
      if (!ownerId) {
        return reply.code(503).send({ error: "owner_not_configured" });
      }

      await ensureOwnerSeeded().catch(() => undefined);

      // A tabela sessions exige que o user_id exista em users (foreign key).
      // No fluxo OAuth isso acontece no upsertUser; aqui precisamos garantir.
      await upsertUser({
        id: ownerId,
        username: envUser,
        globalName: envUser,
        avatar: null,
        avatarUrl: null
      });

      const { sessionId, expiresAt } = await createSession({
        userId: ownerId,
        userAgent: request.headers["user-agent"] ?? null,
        guilds: []
      });

      reply.setCookie(
        SESSION_COOKIE,
        issueSessionCookie(sessionId),
        cookieOptions(Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      );
      return { ok: true, method: "password" };
    } catch (error) {
      app.log.error({ err: error }, "falha no login por senha");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /* ------------------------------ Sessao ----------------------------- */

  app.get("/api/me", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const installed = await listInstalledGuilds();
    const installedIds = new Set(installed.map((guild) => guild.guildId));

    // Mapa servidor -> grupo, para a sidebar rotular sem uma segunda chamada.
    const membership = await getPool().query<{
      guildId: string;
      groupId: number;
      name: string;
      color: string;
    }>(
      `select gs.guild_id as "guildId", g.id as "groupId", g.name, g.color
       from group_servers gs
       join groups g on g.id = gs.group_id
       where g.owner_id = $1`,
      [session.userId]
    );

    return {
      user: session.user,
      guilds: session.guilds.map((guild) => ({
        ...guild,
        wumpusInstalled: installedIds.has(guild.id)
      })),
      groups: await listGroups(session.userId),
      guildGroups: membership.rows
    };
  });

  /* ------------------------------ Grupos ----------------------------- */

  app.get("/api/groups", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    return { groups: await listGroups(session.userId) };
  });

  app.post("/api/groups", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;

    const body = request.body as { name?: string; description?: string; color?: string };
    const name = (body.name ?? "").trim();
    if (name.length < 2 || name.length > 60) {
      return reply.code(400).send({ error: "invalid_name" });
    }
    const color = /^#[0-9a-fA-F]{6}$/.test(body.color ?? "") ? (body.color as string) : "#7c5cff";

    try {
      const group = await createGroup({
        ownerId: session.userId,
        name,
        description: (body.description ?? "").slice(0, 280),
        color
      });
      return reply.code(201).send({ group });
    } catch (error) {
      if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "group_name_unavailable" });
      }
      throw error;
    }
  });

  app.get("/api/groups/:groupId", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const groupId = Number((request.params as { groupId: string }).groupId);
    if (!Number.isSafeInteger(groupId) || !(await ownsGroup(groupId, session.userId))) {
      return reply.code(404).send({ error: "group_not_found" });
    }

    const db = getPool();
    const [group, servers, configs] = await Promise.all([
      db.query(
        `select id, name, description, color from groups where id = $1`,
        [groupId]
      ),
      db.query<{ guildId: string; name: string; iconUrl: string | null; exceptions: number }>(
        `select g.guild_id as "guildId", g.name, g.icon_url as "iconUrl",
                (select count(*)::integer from server_module_exceptions e where e.guild_id = g.guild_id) as exceptions
         from group_servers gs join guilds g on g.guild_id = gs.guild_id
         where gs.group_id = $1 order by g.name`,
        [groupId]
      ),
      db.query<{ module: ModuleId; enabled: boolean; config: Record<string, unknown> }>(
        `select module, enabled, config from module_configs where scope = 'group' and scope_id = $1`,
        [String(groupId)]
      )
    ]);

    return {
      group: group.rows[0],
      servers: servers.rows,
      configs: configs.rows
    };
  });

  app.post("/api/groups/:groupId/servers", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const groupId = Number((request.params as { groupId: string }).groupId);
    const body = request.body as { guildId?: string };

    if (!Number.isSafeInteger(groupId) || !(await ownsGroup(groupId, session.userId))) {
      return reply.code(404).send({ error: "group_not_found" });
    }
    if (!body.guildId || !hasGuildAccess(session, body.guildId)) {
      return reply.code(403).send({ error: "access_denied" });
    }

    await assignGuildToGroup(groupId, body.guildId);
    await recordAuditEvent({
      guildId: body.guildId,
      module: "servers",
      eventType: "group_assigned",
      actorId: session.userId,
      data: { groupId }
    });
    return reply.code(204).send();
  });

  app.delete("/api/groups/:groupId/servers/:guildId", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { groupId: rawGroupId, guildId } = request.params as { groupId: string; guildId: string };
    const groupId = Number(rawGroupId);

    if (!Number.isSafeInteger(groupId) || !(await ownsGroup(groupId, session.userId))) {
      return reply.code(404).send({ error: "group_not_found" });
    }
    if (!hasGuildAccess(session, guildId)) {
      return reply.code(403).send({ error: "access_denied" });
    }

    await removeGuildFromGroup(guildId);
    await recordAuditEvent({
      guildId,
      module: "servers",
      eventType: "group_removed",
      actorId: session.userId,
      data: { groupId }
    });
    return reply.code(204).send();
  });

  /* --------------------------- Configuracao -------------------------- */

  app.get("/api/guilds/:guildId/overview", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const overview = await getGuildOverview(guildId);
    if (!overview) return reply.code(404).send({ error: "guild_not_found" });
    return overview;
  });

  /** Config efetiva de um modulo, ja com heranca resolvida. */
  app.get("/api/guilds/:guildId/modules/:module", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId, module: rawModule } = request.params as { guildId: string; module: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const module = parseModule(rawModule);
    if (!module) return reply.code(404).send({ error: "unknown_module" });

    const overview = await getGuildOverview(guildId);
    if (!overview) return reply.code(404).send({ error: "guild_not_found" });

    const resolved = overview.modules.find((entry) => entry.module === module);
    return {
      module,
      group: overview.group,
      resolved,
      defaults: defaultsFor(module),
      exceptions: await listServerExceptions(guildId)
    };
  });

  /**
   * Grava a configuracao de um modulo.
   * Com grupo: grava excecao do servidor (inherit/disabled/override).
   * Sem grupo: grava a configuracao individual do servidor.
   */
  app.put("/api/guilds/:guildId/modules/:module", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId, module: rawModule } = request.params as { guildId: string; module: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const module = parseModule(rawModule);
    if (!module) return reply.code(404).send({ error: "unknown_module" });

    const body = request.body as { mode?: string; enabled?: boolean; config?: Record<string, unknown> };
    const group = await getGroupForGuild(guildId);

    if (group) {
      const mode = exceptionModes.has(body.mode ?? "") ? (body.mode as "inherit" | "disabled" | "override") : "inherit";
      await setServerException({
        guildId,
        module,
        mode,
        enabled: body.enabled ?? true,
        config: mode === "override" ? body.config ?? {} : {},
        updatedBy: session.userId
      });
      await recordAuditEvent({
        guildId,
        module,
        eventType: "server_exception_updated",
        actorId: session.userId,
        data: { mode, groupId: group.id }
      });
      return { ok: true, scope: "server-exception", mode };
    }

    await saveModuleConfig({
      scope: "server",
      scopeId: guildId,
      module,
      enabled: body.enabled ?? true,
      config: body.config ?? {},
      updatedBy: session.userId
    });
    await recordAuditEvent({
      guildId,
      module,
      eventType: "module_config_updated",
      actorId: session.userId,
      data: { enabled: body.enabled ?? true }
    });

    // A regra nativa do Discord precisa acompanhar: sem isto, um termo novo
    // so valeria no proximo reinicio do bot.
    if (module === "automod") {
      await resyncAutomod().catch(() => undefined);
    }

    return { ok: true, scope: "server" };
  });

  app.put("/api/groups/:groupId/modules/:module", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { groupId: rawGroupId, module: rawModule } = request.params as { groupId: string; module: string };
    const groupId = Number(rawGroupId);

    if (!Number.isSafeInteger(groupId) || !(await ownsGroup(groupId, session.userId))) {
      return reply.code(404).send({ error: "group_not_found" });
    }
    const module = parseModule(rawModule);
    if (!module) return reply.code(404).send({ error: "unknown_module" });

    const body = request.body as { enabled?: boolean; config?: Record<string, unknown> };
    await saveModuleConfig({
      scope: "group",
      scopeId: String(groupId),
      module,
      enabled: body.enabled ?? true,
      config: body.config ?? {},
      updatedBy: session.userId
    });

    // Registra o evento em cada servidor do grupo: eles acabaram de mudar.
    const servers = await getPool().query<{ guildId: string }>(
      `select guild_id as "guildId" from group_servers where group_id = $1`,
      [groupId]
    );

    // Cada servidor resolve a propria configuracao (grupo + excecao), entao
    // este resync nunca sobrescreve a excecao de um servidor.
    if (module === "automod") {
      await resyncAutomod().catch(() => undefined);
    }

    await Promise.all(
      servers.rows.map((server) =>
        recordAuditEvent({
          guildId: server.guildId,
          module,
          eventType: "group_config_updated",
          actorId: session.userId,
          data: { groupId, enabled: body.enabled ?? true }
        })
      )
    );

    return { ok: true, scope: "group", affectedServers: servers.rowCount };
  });

  /* --------------------------- Publicacoes --------------------------- */

  /** Canais e cargos que o bot sincronizou — alimentam os seletores da dashboard. */
  app.get("/api/guilds/:guildId/assets", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });
    return listGuildAssets(guildId);
  });

  app.get("/api/guilds/:guildId/publications", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });
    return { publications: await listRecentPublications(guildId) };
  });

  /** Enfileira um painel. Quem envia ao Discord e o bot, nunca a dashboard. */
  app.post("/api/guilds/:guildId/publications", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const body = request.body as {
      module?: string;
      channelId?: string;
      format?: string;
      title?: string;
      description?: string;
      accentColor?: string;
    };

    if (!body.channelId) return reply.code(400).send({ error: "channel_required" });

    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    if (title.length < 3 || title.length > 100) return reply.code(400).send({ error: "invalid_title" });
    if (description.length < 10 || description.length > 800) {
      return reply.code(400).send({ error: "invalid_description" });
    }

    // So publica em canal que o bot realmente enxerga.
    const assets = await listGuildAssets(guildId);
    if (!assets.channels.some((channel) => channel.id === body.channelId)) {
      return reply.code(400).send({ error: "unknown_channel" });
    }

    const format = body.format === "embed" ? "embed" : "components_v2";
    const accentColor = /^#[0-9a-fA-F]{6}$/.test(body.accentColor ?? "") ? (body.accentColor as string) : "#7c5cff";
    const module = ["tickets", "forms", "reports"].includes(body.module ?? "") ? (body.module as string) : "tickets";

    const publication = await queuePublication({
      guildId,
      channelId: body.channelId,
      module,
      format,
      payload: { title, description, accentColor },
      createdBy: session.userId
    });

    await recordAuditEvent({
      guildId,
      module,
      eventType: "panel_queued",
      actorId: session.userId,
      channelId: body.channelId,
      data: { publicationId: publication.id, format }
    });

    return reply.code(202).send({ publication });
  });

  /* ----------------------- Departamentos de atendimento -------------- */

  app.get("/api/guilds/:guildId/departments", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const result = await getPool().query(
      `select id, name, description, emoji, category_id as "categoryId",
              staff_role_ids as "staffRoleIds", position, is_active as "isActive"
       from ticket_departments where guild_id = $1 order by position`,
      [guildId]
    );
    return { departments: result.rows };
  });

  app.post("/api/guilds/:guildId/departments", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const body = request.body as { name?: string; description?: string; emoji?: string; categoryId?: string; staffRoleIds?: string[] };
    const name = (body.name ?? "").trim();
    if (name.length < 2 || name.length > 60) return reply.code(400).send({ error: "invalid_name" });

    const result = await getPool().query<{ id: number }>(
      `insert into ticket_departments (guild_id, name, description, emoji, category_id, staff_role_ids)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [guildId, name, (body.description ?? "").slice(0, 280), (body.emoji ?? "").slice(0, 10), body.categoryId ?? null, body.staffRoleIds ?? []]
    );

    await recordAuditEvent({ guildId, module: "tickets", eventType: "department_created", actorId: session.userId, data: { departmentId: result.rows[0].id, name } });
    return reply.code(201).send({ id: result.rows[0].id });
  });

  app.delete("/api/guilds/:guildId/departments/:departmentId", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId, departmentId } = request.params as { guildId: string; departmentId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const id = Number(departmentId);
    if (!Number.isSafeInteger(id)) return reply.code(400).send({ error: "invalid_id" });

    await getPool().query(`delete from ticket_departments where id = $1 and guild_id = $2`, [id, guildId]);
    return { ok: true };
  });

  /* ----------------------- Base de conhecimento ---------------------- */

  /** Artigos que alimentam as respostas assistidas. */
  app.get("/api/guilds/:guildId/knowledge", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const result = await getPool().query(
      `select id, title, body, tags, status, created_by as "createdBy",
              created_at as "createdAt", updated_at as "updatedAt"
       from knowledge_articles where guild_id = $1
       order by status = 'approved' desc, updated_at desc limit 100`,
      [guildId]
    );
    return { articles: result.rows };
  });

  app.post("/api/guilds/:guildId/knowledge", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const body = request.body as { title?: string; body?: string; tags?: unknown; status?: string };
    const title = (body.title ?? "").trim();
    const content = (body.body ?? "").trim();

    if (title.length < 3 || title.length > 120) return reply.code(400).send({ error: "invalid_title" });
    if (content.length < 10 || content.length > 8000) return reply.code(400).send({ error: "invalid_body" });

    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean).slice(0, 10)
      : [];
    const status = ["draft", "approved", "archived"].includes(body.status ?? "") ? body.status! : "draft";

    const result = await getPool().query<{ id: number }>(
      `insert into knowledge_articles (guild_id, title, body, tags, status, created_by)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [guildId, title, content, tags, status, session.userId]
    );

    await recordAuditEvent({
      guildId,
      module: "knowledge",
      eventType: "knowledge_article_created",
      actorId: session.userId,
      data: { articleId: result.rows[0].id, status }
    });

    return reply.code(201).send({ id: result.rows[0].id, status });
  });

  app.patch("/api/guilds/:guildId/knowledge/:articleId", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId, articleId } = request.params as { guildId: string; articleId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const id = Number(articleId);
    if (!Number.isSafeInteger(id)) return reply.code(400).send({ error: "invalid_article" });

    const body = request.body as { title?: string; body?: string; tags?: unknown; status?: string };
    const status = ["draft", "approved", "archived"].includes(body.status ?? "") ? body.status! : null;

    // Aprovacao e o gesto que torna o artigo publicavel: merece registro proprio.
    const result = await getPool().query(
      `update knowledge_articles set
         title = coalesce($3, title),
         body = coalesce($4, body),
         tags = coalesce($5, tags),
         status = coalesce($6, status),
         updated_at = now()
       where id = $1 and guild_id = $2
       returning id, status`,
      [
        id,
        guildId,
        typeof body.title === "string" && body.title.trim().length >= 3 ? body.title.trim().slice(0, 120) : null,
        typeof body.body === "string" && body.body.trim().length >= 10 ? body.body.trim().slice(0, 8000) : null,
        Array.isArray(body.tags)
          ? body.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean).slice(0, 10)
          : null,
        status
      ]
    );

    if (result.rowCount === 0) return reply.code(404).send({ error: "article_not_found" });

    await recordAuditEvent({
      guildId,
      module: "knowledge",
      eventType: status === "approved" ? "knowledge_article_approved" : "knowledge_article_updated",
      actorId: session.userId,
      data: { articleId: id, status: result.rows[0].status }
    });

    return { ok: true, status: result.rows[0].status };
  });

  app.delete("/api/guilds/:guildId/knowledge/:articleId", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId, articleId } = request.params as { guildId: string; articleId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const id = Number(articleId);
    if (!Number.isSafeInteger(id)) return reply.code(400).send({ error: "invalid_article" });

    const result = await getPool().query(
      `delete from knowledge_articles where id = $1 and guild_id = $2 returning id`,
      [id, guildId]
    );
    if (result.rowCount === 0) return reply.code(404).send({ error: "article_not_found" });

    await recordAuditEvent({
      guildId,
      module: "knowledge",
      eventType: "knowledge_article_deleted",
      actorId: session.userId,
      data: { articleId: id }
    });

    return { ok: true };
  });

  /* ----------------------- Administracao de acesso -------------------- */

  /** Helper: exige que a sessao seja do dono ou de um admin. */
  async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<SessionRecord | null> {
    const session = await currentSession(request, reply);
    if (!session) return null;
    if (!(await isAdmin(session.userId))) {
      reply.code(403).send({ error: "admin_only" });
      return null;
    }
    return session;
  }

  /**
   * O que a propria dashboard precisa saber sobre quem entrou: se e admin e
   * qual o id do dono. Sem isto a interface nao sabe se mostra o painel.
   */
  app.get("/api/access", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    return {
      userId: session.userId,
      isAdmin: await isAdmin(session.userId),
      ownerId: ownerIdFromEnv()
    };
  });

  app.get("/api/admin/members", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { members: await listMembers(), ownerId: ownerIdFromEnv() };
  });

  app.post("/api/admin/members", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const body = request.body as { userId?: string; role?: string; note?: string };
    // O ID precisa ser um snowflake do Discord: um valor malformado nunca
    // bateria na verificacao do login, entao aceitar seria criar uma entrada
    // que nao funciona e confunde quem adicionou.
    const userId = (body.userId ?? "").trim();
    if (!/^\d{17,20}$/.test(userId)) return reply.code(400).send({ error: "invalid_user_id" });

    const role: DashboardRole = body.role === "admin" ? "admin" : body.role === "owner" ? "owner" : "member";
    // Promover a dono e uma decisao que so o dono pode tomar.
    if (role === "owner" && session.userId !== ownerIdFromEnv()) {
      return reply.code(403).send({ error: "owner_only" });
    }

    await addMember({ userId, role, note: body.note ?? null, addedBy: session.userId });
    await recordAuditEvent({
      guildId: "global",
      module: "servers",
      eventType: "access_granted",
      actorId: session.userId,
      data: { userId, role }
    }).catch(() => undefined);

    return reply.code(201).send({ ok: true, userId, role });
  });

  app.delete("/api/admin/members/:userId", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { userId } = request.params as { userId: string };
    if (userId === ownerIdFromEnv()) {
      return reply.code(400).send({ error: "cannot_remove_owner" });
    }

    const removed = await removeMember(userId);
    if (!removed) return reply.code(404).send({ error: "member_not_found" });

    await recordAuditEvent({
      guildId: "global",
      module: "servers",
      eventType: "access_revoked",
      actorId: session.userId,
      data: { userId }
    }).catch(() => undefined);

    return { ok: true };
  });

  /* ---------------------------- Admin: metricas ----------------------- */

  app.get("/api/admin/metrics", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const minutes = Number((request.query as { minutes?: string }).minutes ?? 15);
    return snapshotMetrics(Math.max(1, Math.min(minutes, 1440)) * 60_000);
  });

  app.post("/api/admin/metrics/flush", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    await flushMetrics();
    return { ok: true };
  });

  /* -------------------- Assistente de configuração IA ---------------- */

  app.post("/api/guilds/:guildId/ai/config-assistant", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const body = request.body as { prompt?: string };
    const prompt = (body.prompt ?? "").trim();
    if (prompt.length < 10) return reply.code(400).send({ error: "prompt_too_short" });
    if (prompt.length > 500) return reply.code(400).send({ error: "prompt_too_long" });

    const apiKey = process.env.WUMPUS_GROQ_API_KEY;
    if (!apiKey) return reply.code(503).send({ error: "ai_not_configured" });

    const model = process.env.WUMPUS_GROQ_MODEL || "openai/gpt-oss-120b";

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Você é um assistente de configuração para o bot Wumpus no Discord.
O usuário descreve o que quer em linguagem natural. Você devolve um JSON com a configuração sugerida.

Módulos disponíveis: automod, security, logs, moderation, tickets, forms, knowledge, ocr, servers, statistics, staff, roles, automations, integrations.

Para cada módulo que o usuário mencionar, inclua um objeto com:
- "module": o nome do módulo
- "enabled": true/false
- "config": objeto com os campos relevantes

Responda EXATAMENTE neste formato JSON:
{
  "modules": [
    { "module": "automod", "enabled": true, "config": { ... } },
    ...
  ],
  "explanation": "Explicação curta do que foi configurado em português."
}`
            },
            { role: "user", content: prompt }
          ]
        }),
        signal: AbortSignal.timeout(20_000)
      });

      if (!response.ok) {
        const detail = await response.text();
        app.log.error({ status: response.status, detail: detail.slice(0, 200) }, "IA respondeu com erro");
        return reply.code(502).send({ error: "ai_error" });
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = payload.choices?.[0]?.message?.content?.trim();
      if (!raw) return reply.code(502).send({ error: "empty_response" });

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return reply.code(502).send({ error: "invalid_json", raw: raw.slice(0, 500) });
      }

      return { ok: true, suggestion: parsed };
    } catch (error) {
      app.log.error({ err: error }, "falha no assistente de configuração");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /* ---------------------------- Role Drafts IA ----------------------- */

  app.post("/api/guilds/:guildId/roles/draft", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const body = request.body as { request?: string };
    const userRequest = (body.request ?? "").trim();
    if (userRequest.length < 5) return reply.code(400).send({ error: "request_too_short" });

    const apiKey = process.env.WUMPUS_GROQ_API_KEY;
    if (!apiKey) return reply.code(503).send({ error: "ai_not_configured" });

    const model = process.env.WUMPUS_GROQ_MODEL || "openai/gpt-oss-120b";

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 600,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Você gera rascunhos de cargos do Discord. O usuário pede um cargo; você devolve um JSON com:
{
  "name": "Nome do cargo",
  "color": "#hex",
  "hoist": true/false,
  "mentionable": true/false,
  "permissions": ["string de permissões relevantes"],
  "reason": "Por que este cargo faz sentido"
}
Responda apenas com o JSON, em português do Brasil.`
            },
            { role: "user", content: userRequest }
          ]
        }),
        signal: AbortSignal.timeout(20_000)
      });

      if (!response.ok) return reply.code(502).send({ error: "ai_error" });
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = payload.choices?.[0]?.message?.content?.trim();
      if (!raw) return reply.code(502).send({ error: "empty_response" });

      let draft: Record<string, unknown>;
      try { draft = JSON.parse(raw); } catch { return reply.code(502).send({ error: "invalid_json" }); }

      const result = await getPool().query<{ id: number }>(
        `insert into role_drafts (guild_id, created_by, request, draft)
         values ($1, $2, $3, $4::jsonb) returning id`,
        [guildId, session.userId, userRequest, JSON.stringify(draft)]
      );

      await recordAuditEvent({ guildId, module: "roles", eventType: "role_draft_created", actorId: session.userId, data: { draftId: result.rows[0].id } });
      return reply.code(201).send({ id: result.rows[0].id, draft });
    } catch (error) {
      app.log.error({ err: error }, "falha ao gerar rascunho de cargo");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  app.get("/api/guilds/:guildId/roles/drafts", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const result = await getPool().query(
      `select id, request, draft, status, reviewed_by as "reviewedBy", created_at as "createdAt", reviewed_at as "reviewedAt"
       from role_drafts where guild_id = $1 order by created_at desc limit 20`,
      [guildId]
    );
    return { drafts: result.rows };
  });

  app.patch("/api/guilds/:guildId/roles/draft/:draftId", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId, draftId } = request.params as { guildId: string; draftId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const id = Number(draftId);
    if (!Number.isSafeInteger(id)) return reply.code(400).send({ error: "invalid_id" });

    const body = request.body as { status?: string };
    const status = body.status === "applied" ? "applied" : body.status === "rejected" ? "rejected" : null;
    if (!status) return reply.code(400).send({ error: "invalid_status" });

    await getPool().query(
      `update role_drafts set status = $3, reviewed_by = $4, reviewed_at = now()
       where id = $1 and guild_id = $2 and status = 'pending'`,
      [id, guildId, status, session.userId]
    );

    await recordAuditEvent({ guildId, module: "roles", eventType: `role_draft_${status}`, actorId: session.userId, data: { draftId: id } });
    return { ok: true, status };
  });

  /* ---------------------------- Licenças ----------------------------- */

  app.get("/api/admin/licenses", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const result = await getPool().query(
      `select id, discord_user_id as "discordUserId", plan, status,
              max_servers as "maxServers", expires_at as "expiresAt",
              notes, created_at as "createdAt", updated_at as "updatedAt"
       from licenses order by created_at desc limit 100`
    );
    return { licenses: result.rows };
  });

  app.post("/api/admin/licenses", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const body = request.body as { discordUserId?: string; plan?: string; maxServers?: number; expiresAt?: string; notes?: string };
    const userId = (body.discordUserId ?? "").trim();
    if (!/^\d{17,20}$/.test(userId)) return reply.code(400).send({ error: "invalid_user_id" });

    const plan = ["starter", "standard", "professional", "enterprise"].includes(body.plan ?? "") ? body.plan! : "standard";
    const maxServers = typeof body.maxServers === "number" && body.maxServers > 0 ? body.maxServers : 1;

    await getPool().query(
      `insert into licenses (discord_user_id, plan, max_servers, expires_at, notes)
       values ($1, $2, $3, $4, $5)
       on conflict (discord_user_id) do update
         set plan = excluded.plan, max_servers = excluded.max_servers,
             expires_at = excluded.expires_at, notes = excluded.notes, updated_at = now()`,
      [userId, plan, maxServers, body.expiresAt ?? null, (body.notes ?? "").slice(0, 500)]
    );

    return reply.code(201).send({ ok: true });
  });

  app.delete("/api/admin/licenses/:licenseId", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const id = Number((request.params as { licenseId: string }).licenseId);
    if (!Number.isSafeInteger(id)) return reply.code(400).send({ error: "invalid_id" });

    await getPool().query(`delete from licenses where id = $1`, [id]);
    return { ok: true };
  });

  /* ---------------------------- Incidentes --------------------------- */

  /** Historico de incidentes de seguranca detectados pelo bot. */
  app.get("/api/guilds/:guildId/incidents", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 25) || 25, 100);
    const result = await getPool().query(
      `select id, incident_type as "incidentType", severity, status,
              actor_id as "actorId", details, created_at as "createdAt", resolved_at as "resolvedAt"
       from incidents where guild_id = $1 order by created_at desc limit $2`,
      [guildId, limit]
    );
    return { incidents: result.rows };
  });

  /** Encerra um incidente: a equipe confirma que tratou ou que era falso positivo. */
  app.patch("/api/guilds/:guildId/incidents/:incidentId", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId, incidentId } = request.params as { guildId: string; incidentId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const id = Number(incidentId);
    if (!Number.isSafeInteger(id)) return reply.code(400).send({ error: "invalid_incident" });

    const body = request.body as { status?: string };
    const status = body.status === "dismissed" ? "dismissed" : "contained";

    const result = await getPool().query(
      `update incidents set status = $3, resolved_at = now()
       where id = $1 and guild_id = $2 and status = 'open'
       returning id`,
      [id, guildId, status]
    );
    if (result.rowCount === 0) return reply.code(404).send({ error: "incident_not_open" });

    await recordAuditEvent({
      guildId,
      module: "security",
      eventType: status === "dismissed" ? "incident_dismissed" : "incident_resolved",
      actorId: session.userId,
      severity: "info",
      data: { incidentId: id }
    });

    return { ok: true, status };
  });

  /* ------------------------------ Logs ------------------------------- */

  app.get("/api/guilds/:guildId/events", async (request, reply) => {
    const session = await currentSession(request, reply);
    if (!session) return;
    const { guildId } = request.params as { guildId: string };
    if (!hasGuildAccess(session, guildId)) return reply.code(403).send({ error: "access_denied" });

    const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 50) || 50, 200);
    const events = await listAuditEvents(guildId, limit);
    return { events };
  });
}