import {
  defaultHubOrderPanelConfig,
  defaultWumpusModuleConfig,
  parseHubOrderPanelConfig,
  wumpusModules,
  type HubOrderPanelConfig,
  type HubOrderTicketKind,
  type WumpusModule
} from "@huborder/core";
import { Pool } from "pg";

export type TicketKind = HubOrderTicketKind;
export type TicketStatus = "open" | "closed";
export type JsonObject = Record<string, unknown>;

export type SupportTicket = {
  id: number;
  guildId: string;
  channelId: string | null;
  userId: string;
  kind: TicketKind;
  status: TicketStatus;
  intake: JsonObject;
  logChannelId: string | null;
  logMessageId: string | null;
  transcript: JsonObject[];
  feedbackScore: number | null;
  feedbackComment: string | null;
  feedbackAt: Date | null;
  createdAt: Date;
  closedAt: Date | null;
};

export type HubOrderPanelSettings = {
  guildId: string;
  config: HubOrderPanelConfig;
  updatedAt: Date;
};

export type HubOrderTicketEvent = {
  id: number;
  ticketId: number;
  eventType: string;
  actorId: string | null;
  data: JsonObject;
  createdAt: Date;
};

export type HubOrderTicketStats = {
  open: number;
  closedLast30Days: number;
  feedbackCount: number;
  averageFeedback: number | null;
};

export type HubOrderPublication = {
  id: number;
  guildId: string;
  channelId: string;
  kind: "ticket_panel" | "message";
  payload: JsonObject;
  status: "pending" | "published" | "failed";
  messageId: string | null;
  error: string | null;
  createdBy: string;
  createdAt: Date;
  processedAt: Date | null;
};

export type ServiceStatus = {
  service: string;
  status: "operational" | "degraded" | "offline";
  metadata: JsonObject;
  lastHeartbeatAt: Date;
};

export type WumpusGuild = {
  guildId: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  memberCount: number | null;
  botPermissions: string;
  installedAt: Date;
  lastSyncedAt: Date;
  isActive: boolean;
};

export type WumpusModuleConfig = {
  guildId: string;
  module: WumpusModule;
  enabled: boolean;
  config: JsonObject;
  updatedBy: string | null;
  updatedAt: Date;
};

export type WumpusGroup = {
  id: number;
  ownerId: string;
  name: string;
  description: string;
  color: string;
  serverCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WumpusGroupMember = {
  groupId: number;
  guildId: string;
  exceptions: JsonObject;
  addedAt: Date;
};

export type WumpusGroupModuleConfig = {
  groupId: number;
  module: WumpusModule;
  enabled: boolean;
  config: JsonObject;
  updatedBy: string | null;
  updatedAt: Date;
};

export type WumpusResolvedModuleConfig = {
  guildId: string;
  module: WumpusModule;
  enabled: boolean;
  config: JsonObject;
  source: "group" | "server" | "default";
  groupId: number | null;
  exceptionMode: "inherit" | "disabled" | "override";
};

export type WumpusGroupDetails = {
  group: WumpusGroup;
  servers: Array<WumpusGuild & { exceptions: JsonObject; addedAt: Date }>;
  configs: WumpusGroupModuleConfig[];
};

export type WumpusEvent = {
  id: number;
  guildId: string;
  module: string;
  eventType: string;
  actorId: string | null;
  targetId: string | null;
  channelId: string | null;
  data: JsonObject;
  occurredAt: Date;
};

export type WumpusIncident = {
  id: number;
  guildId: string;
  incidentType: "raid" | "nuke" | "automod" | "permission_risk";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "contained" | "dismissed";
  actorId: string | null;
  details: JsonObject;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type WumpusCase = {
  id: number;
  guildId: string;
  caseType: "moderation" | "report" | "appeal";
  status: "open" | "in_review" | "resolved" | "dismissed";
  reporterId: string | null;
  targetId: string | null;
  assignedTo: string | null;
  reason: string;
  evidence: JsonObject;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type WumpusRoleSnapshot = {
  guildId: string;
  roleId: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  updatedAt: Date;
};

export type WumpusChannelSnapshot = {
  guildId: string;
  channelId: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
  updatedAt: Date;
};

export type WumpusPanelPublication = {
  id: number;
  guildId: string;
  channelId: string;
  module: "tickets" | "forms";
  payload: JsonObject;
  status: "pending" | "published" | "failed";
  messageId: string | null;
  error: string | null;
  createdBy: string;
  createdAt: Date;
  processedAt: Date | null;
};

export type WumpusTicket = {
  id: number;
  guildId: string;
  channelId: string | null;
  openerId: string;
  department: string | null;
  status: "open" | "claimed" | "closed";
  claimedBy: string | null;
  createdAt: Date;
  closedAt: Date | null;
};

export type WumpusTicketDepartment = {
  id: number;
  guildId: string;
  name: string;
  description: string;
  emoji: string;
  categoryId: string | null;
  staffRoleIds: string[];
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WumpusForm = {
  id: number;
  guildId: string;
  name: string;
  description: string;
  fields: JsonObject[];
  reviewerRoleIds: string[];
  isActive: boolean;
  createdAt: Date;
};

export type WumpusRoleDraft = {
  id: number;
  guildId: string;
  createdBy: string;
  request: string;
  draft: JsonObject;
  status: "pending" | "applied" | "rejected" | "failed";
  reviewedBy: string | null;
  error: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

export type WumpusDashboardSession = {
  sessionId: string;
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  guilds: JsonObject[];
  expiresAt: Date;
};

export type WumpusLicense = {
  id: number;
  discordUserId: string;
  plan: "starter" | "standard" | "professional" | "enterprise";
  status: "active" | "suspended" | "expired";
  maxServers: number;
  expiresAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WumpusOccurrence = {
  id: number;
  guildId: string;
  targetId: string;
  staffId: string;
  requestedAction: "warn" | "timeout" | "kick" | "ban";
  appliedAction: string | null;
  reason: string;
  evidence: JsonObject[];
  strikeNumber: number;
  timeoutMinutes: number | null;
  status: "pending" | "approved" | "rejected" | "processing" | "applied" | "failed";
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  appliedAt: Date | null;
  error: string | null;
  createdAt: Date;
};

export type WumpusAdminStats = {
  licenses: number;
  activeLicenses: number;
  licensedServers: number;
  installedServers: number;
  pendingOccurrences: number;
  registeredDiscordAccounts: number;
};

export type WumpusOverview = {
  guild: WumpusGuild | null;
  configs: WumpusModuleConfig[];
  group: WumpusGroup | null;
  exceptionModules: WumpusModule[];
  metrics: Array<{ day: Date; joins: number; leaves: number; messages: number; moderationActions: number }>;
  incidents: WumpusIncident[];
  cases: WumpusCase[];
  roles: WumpusRoleSnapshot[];
  events: WumpusEvent[];
  counts: { openIncidents: number; openCases: number; activeAutomations: number; activeWebhooks: number; knowledgeArticles: number };
};

const guildColumns = `guild_id AS "guildId", name, icon_url AS "iconUrl", owner_id AS "ownerId",
  member_count AS "memberCount", bot_permissions AS "botPermissions", installed_at AS "installedAt",
  last_synced_at AS "lastSyncedAt", is_active AS "isActive"`;
const configColumns = `guild_id AS "guildId", module, enabled, config, updated_by AS "updatedBy", updated_at AS "updatedAt"`;
const incidentColumns = `id, guild_id AS "guildId", incident_type AS "incidentType", severity, status,
  actor_id AS "actorId", details, created_at AS "createdAt", resolved_at AS "resolvedAt"`;
const caseColumns = `id, guild_id AS "guildId", case_type AS "caseType", status, reporter_id AS "reporterId",
  target_id AS "targetId", assigned_to AS "assignedTo", reason, evidence, created_at AS "createdAt", resolved_at AS "resolvedAt"`;
const eventColumns = `id, guild_id AS "guildId", module, event_type AS "eventType", actor_id AS "actorId",
  target_id AS "targetId", channel_id AS "channelId", data, occurred_at AS "occurredAt"`;
const supportTicketColumns = `id, guild_id AS "guildId", channel_id AS "channelId", user_id AS "userId", kind, status,
  intake, log_channel_id AS "logChannelId", log_message_id AS "logMessageId", transcript,
  feedback_score AS "feedbackScore", feedback_comment AS "feedbackComment", feedback_at AS "feedbackAt",
  created_at AS "createdAt", closed_at AS "closedAt"`;
const groupColumns = `g.id, g.owner_id AS "ownerId", g.name, g.description, g.color,
  COUNT(gs.guild_id)::integer AS "serverCount", g.created_at AS "createdAt", g.updated_at AS "updatedAt"`;
const groupConfigColumns = `group_id AS "groupId", module, enabled, config, updated_by AS "updatedBy", updated_at AS "updatedAt"`;
const panelPublicationColumns = `id, guild_id AS "guildId", channel_id AS "channelId", module, payload, status, message_id AS "messageId", error,
  created_by AS "createdBy", created_at AS "createdAt", processed_at AS "processedAt"`;
const licenseColumns = `id, discord_user_id AS "discordUserId", plan, status, max_servers AS "maxServers",
  expires_at AS "expiresAt", notes, created_at AS "createdAt", updated_at AS "updatedAt"`;
const occurrenceColumns = `id, guild_id AS "guildId", target_id AS "targetId", staff_id AS "staffId",
  requested_action AS "requestedAction", applied_action AS "appliedAction", reason, evidence,
  strike_number AS "strikeNumber", timeout_minutes AS "timeoutMinutes", status, reviewed_by AS "reviewedBy",
  review_note AS "reviewNote", reviewed_at AS "reviewedAt", applied_at AS "appliedAt", error, created_at AS "createdAt"`;
const hubOrderPublicationColumns = `id, guild_id AS "guildId", channel_id AS "channelId", kind, payload, status,
  message_id AS "messageId", error, created_by AS "createdBy", created_at AS "createdAt", processed_at AS "processedAt"`;

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });

  async function effectiveWumpusModuleConfig(guildId: string, module: WumpusModule): Promise<WumpusResolvedModuleConfig> {
    const [membershipResult, individualResult] = await Promise.all([
      pool.query<WumpusGroupMember>(
        `SELECT group_id AS "groupId", guild_id AS "guildId", exceptions, added_at AS "addedAt"
         FROM wumpus_group_servers WHERE guild_id = $1 LIMIT 1`,
        [guildId]
      ),
      pool.query<WumpusModuleConfig>(`SELECT ${configColumns} FROM wumpus_module_configs WHERE guild_id = $1 AND module = $2`, [guildId, module])
    ]);
    const membership = membershipResult.rows[0];
    const defaultConfig = defaultWumpusModuleConfig(module);
    if (!membership) {
      const saved = individualResult.rows[0];
      const enabled = saved?.enabled ?? true;
      return { guildId, module, enabled, config: { ...defaultConfig, ...(saved?.config ?? {}), enabled }, source: saved ? "server" : "default", groupId: null, exceptionMode: "inherit" };
    }

    const groupConfigResult = await pool.query<WumpusGroupModuleConfig>(
      `SELECT ${groupConfigColumns} FROM wumpus_group_module_configs WHERE group_id = $1 AND module = $2 LIMIT 1`,
      [membership.groupId, module]
    );
    const groupConfig = groupConfigResult.rows[0];
    const rawExceptions = membership.exceptions ?? {};
    const rawException = rawExceptions[module];
    const exception = rawException !== null && typeof rawException === "object" && !Array.isArray(rawException) ? rawException as JsonObject : {};
    const mode = exception.mode === "disabled" || exception.mode === "override" ? exception.mode : "inherit";
    const baseEnabled = groupConfig?.enabled ?? true;
    const baseConfig = { ...defaultConfig, ...(groupConfig?.config ?? {}) };

    if (mode === "disabled") {
      return { guildId, module, enabled: false, config: { ...baseConfig, enabled: false }, source: "group", groupId: membership.groupId, exceptionMode: "disabled" };
    }
    if (mode === "override") {
      const overrideConfig = exception.config !== null && typeof exception.config === "object" && !Array.isArray(exception.config) ? exception.config as JsonObject : {};
      const enabled = exception.enabled !== false;
      return { guildId, module, enabled, config: { ...baseConfig, ...overrideConfig, enabled }, source: "group", groupId: membership.groupId, exceptionMode: "override" };
    }
    return { guildId, module, enabled: baseEnabled, config: { ...baseConfig, enabled: baseEnabled }, source: "group", groupId: membership.groupId, exceptionMode: "inherit" };
  }

  return {
    pool,
    async createTicket(input: { guildId: string; userId: string; kind: TicketKind; intake?: JsonObject }) {
      const result = await pool.query<SupportTicket>(
        `INSERT INTO support_tickets (guild_id, user_id, kind, intake)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING ${supportTicketColumns}`,
        [input.guildId, input.userId, input.kind, JSON.stringify(input.intake ?? {})]
      );
      return result.rows[0];
    },
    async attachTicketChannel(ticketId: number, channelId: string) {
      await pool.query(`UPDATE support_tickets SET channel_id = $2 WHERE id = $1`, [ticketId, channelId]);
    },
    async getTicketByChannel(channelId: string) {
      const result = await pool.query<SupportTicket>(
        `SELECT ${supportTicketColumns} FROM support_tickets WHERE channel_id = $1 LIMIT 1`,
        [channelId]
      );
      return result.rows[0] ?? null;
    },
    async getTicketById(ticketId: number) {
      const result = await pool.query<SupportTicket>(`SELECT ${supportTicketColumns} FROM support_tickets WHERE id = $1 LIMIT 1`, [ticketId]);
      return result.rows[0] ?? null;
    },
    async listOpenTicketsForUser(userId: string) {
      const result = await pool.query<SupportTicket>(`SELECT ${supportTicketColumns} FROM support_tickets WHERE user_id = $1 AND status = 'open' ORDER BY created_at ASC`, [userId]);
      return result.rows;
    },
    async closeTicket(ticketId: number) {
      await pool.query(`UPDATE support_tickets SET status = 'closed', closed_at = NOW() WHERE id = $1`, [ticketId]);
    },
    async setTicketLogMessage(ticketId: number, input: { channelId: string; messageId: string }) {
      await pool.query(`UPDATE support_tickets SET log_channel_id = $2, log_message_id = $3 WHERE id = $1`, [ticketId, input.channelId, input.messageId]);
    },
    async saveTicketTranscript(ticketId: number, transcript: JsonObject[]) {
      await pool.query(`UPDATE support_tickets SET transcript = $2::jsonb WHERE id = $1`, [ticketId, JSON.stringify(transcript)]);
    },
    async saveTicketFeedback(ticketId: number, input: { score: number; comment?: string | null }) {
      const result = await pool.query<SupportTicket>(
        `UPDATE support_tickets SET feedback_score = $2, feedback_comment = $3, feedback_at = NOW()
         WHERE id = $1 RETURNING ${supportTicketColumns}`,
        [ticketId, input.score, input.comment ?? null]
      );
      return result.rows[0] ?? null;
    },
    async recordHubOrderTicketEvent(input: Omit<HubOrderTicketEvent, "id" | "createdAt">) {
      const result = await pool.query<HubOrderTicketEvent>(
        `INSERT INTO support_ticket_events (ticket_id, event_type, actor_id, data)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id, ticket_id AS "ticketId", event_type AS "eventType", actor_id AS "actorId", data, created_at AS "createdAt"`,
        [input.ticketId, input.eventType, input.actorId, JSON.stringify(input.data)]
      );
      return result.rows[0];
    },
    async getHubOrderPanelSettings(guildId: string) {
      const result = await pool.query<HubOrderPanelSettings>(
        `SELECT guild_id AS "guildId", config, updated_at AS "updatedAt" FROM huborder_panel_settings WHERE guild_id = $1 LIMIT 1`,
        [guildId]
      );
      const row = result.rows[0];
      return row ? { ...row, config: parseHubOrderPanelConfig(row.config) } : null;
    },
    async getHubOrderPanelConfig(guildId: string): Promise<HubOrderPanelConfig> {
      return (await this.getHubOrderPanelSettings(guildId))?.config ?? defaultHubOrderPanelConfig();
    },
    async saveHubOrderPanelSettings(input: { guildId: string; config: HubOrderPanelConfig }) {
      const result = await pool.query<HubOrderPanelSettings>(
        `INSERT INTO huborder_panel_settings (guild_id, config)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (guild_id) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
         RETURNING guild_id AS "guildId", config, updated_at AS "updatedAt"`,
        [input.guildId, JSON.stringify(input.config)]
      );
      return { ...result.rows[0], config: parseHubOrderPanelConfig(result.rows[0].config) };
    },
    async getHubOrderTicketStats(guildId: string): Promise<HubOrderTicketStats> {
      const result = await pool.query<{ open: string; closedLast30Days: string; feedbackCount: string; averageFeedback: string | null }>(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'open') AS open,
          COUNT(*) FILTER (WHERE status = 'closed' AND closed_at >= NOW() - INTERVAL '30 days') AS "closedLast30Days",
          COUNT(feedback_score) AS "feedbackCount",
          AVG(feedback_score) AS "averageFeedback"
         FROM support_tickets WHERE guild_id = $1`,
        [guildId]
      );
      const row = result.rows[0] ?? { open: "0", closedLast30Days: "0", feedbackCount: "0", averageFeedback: null };
      return {
        open: Number(row.open),
        closedLast30Days: Number(row.closedLast30Days),
        feedbackCount: Number(row.feedbackCount),
        averageFeedback: row.averageFeedback ? Number(row.averageFeedback) : null
      };
    },
    async queueHubOrderPublication(input: { guildId: string; channelId: string; kind: HubOrderPublication["kind"]; payload?: JsonObject; createdBy: string }) {
      const result = await pool.query<HubOrderPublication>(
        `INSERT INTO huborder_publications (guild_id, channel_id, kind, payload, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING ${hubOrderPublicationColumns}`,
        [input.guildId, input.channelId, input.kind, JSON.stringify(input.payload ?? {}), input.createdBy]
      );
      return result.rows[0];
    },
    async listPendingHubOrderPublications(limit = 20) {
      const result = await pool.query<HubOrderPublication>(
        `SELECT ${hubOrderPublicationColumns} FROM huborder_publications WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`, [limit]
      );
      return result.rows;
    },
    async finishHubOrderPublication(input: { id: number; status: "published" | "failed"; messageId?: string | null; error?: string | null }) {
      await pool.query(`UPDATE huborder_publications SET status = $2, message_id = $3, error = $4, processed_at = NOW() WHERE id = $1 AND status = 'pending'`, [input.id, input.status, input.messageId ?? null, input.error ?? null]);
    },
    async heartbeat(input: Omit<ServiceStatus, "lastHeartbeatAt">) {
      await pool.query(
        `INSERT INTO service_status (service, status, metadata, last_heartbeat_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (service) DO UPDATE SET status = EXCLUDED.status, metadata = EXCLUDED.metadata,
           last_heartbeat_at = NOW()`,
        [input.service, input.status, JSON.stringify(input.metadata)]
      );
    },
    async listServices() {
      const result = await pool.query<ServiceStatus>(
        `SELECT service, status, metadata, last_heartbeat_at AS "lastHeartbeatAt"
         FROM service_status ORDER BY service ASC`
      );
      return result.rows;
    },
    async upsertWumpusGuild(input: Omit<WumpusGuild, "installedAt" | "lastSyncedAt" | "isActive">) {
      const result = await pool.query<WumpusGuild>(
        `INSERT INTO wumpus_guilds (guild_id, name, icon_url, owner_id, member_count, bot_permissions)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (guild_id) DO UPDATE SET name = EXCLUDED.name, icon_url = EXCLUDED.icon_url,
           owner_id = EXCLUDED.owner_id, member_count = EXCLUDED.member_count, bot_permissions = EXCLUDED.bot_permissions,
           is_active = TRUE, last_synced_at = NOW()
         RETURNING ${guildColumns}`,
        [input.guildId, input.name, input.iconUrl, input.ownerId, input.memberCount, input.botPermissions]
      );
      return result.rows[0];
    },
    async markWumpusGuildRemoved(guildId: string) {
      await pool.query(`UPDATE wumpus_guilds SET is_active = FALSE, last_synced_at = NOW() WHERE guild_id = $1`, [guildId]);
    },
    async listWumpusGuilds() {
      const result = await pool.query<WumpusGuild>(`SELECT ${guildColumns} FROM wumpus_guilds WHERE is_active = TRUE ORDER BY name ASC`);
      return result.rows;
    },
    async getWumpusGuild(guildId: string) {
      const result = await pool.query<WumpusGuild>(`SELECT ${guildColumns} FROM wumpus_guilds WHERE guild_id = $1 AND is_active = TRUE`, [guildId]);
      return result.rows[0] ?? null;
    },
    async listWumpusGroups(ownerId: string) {
      const result = await pool.query<WumpusGroup>(
        `SELECT ${groupColumns}
         FROM wumpus_groups g
         LEFT JOIN wumpus_group_servers gs ON gs.group_id = g.id
         WHERE g.owner_id = $1
         GROUP BY g.id
         ORDER BY g.updated_at DESC, g.id DESC`,
        [ownerId]
      );
      return result.rows;
    },
    async createWumpusGroup(input: { ownerId: string; name: string; description?: string; color?: string }) {
      const result = await pool.query<WumpusGroup>(
        `INSERT INTO wumpus_groups (owner_id, name, description, color)
         VALUES ($1, $2, $3, $4)
         RETURNING id, owner_id AS "ownerId", name, description, color, 0::integer AS "serverCount", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [input.ownerId, input.name, input.description ?? "", input.color ?? "#8175FF"]
      );
      return result.rows[0];
    },
    async getWumpusGroup(groupId: number, ownerId?: string) {
      const result = await pool.query<WumpusGroup>(
        `SELECT ${groupColumns}
         FROM wumpus_groups g
         LEFT JOIN wumpus_group_servers gs ON gs.group_id = g.id
         WHERE g.id = $1 ${ownerId ? "AND g.owner_id = $2" : ""}
         GROUP BY g.id`,
        ownerId ? [groupId, ownerId] : [groupId]
      );
      return result.rows[0] ?? null;
    },
    async getWumpusGroupForGuild(guildId: string) {
      const result = await pool.query<WumpusGroup>(
        `SELECT ${groupColumns}
         FROM wumpus_groups g
         JOIN wumpus_group_servers gs ON gs.group_id = g.id
         WHERE gs.guild_id = $1
         GROUP BY g.id`,
        [guildId]
      );
      return result.rows[0] ?? null;
    },
    async getWumpusGroupDetails(groupId: number, ownerId?: string): Promise<WumpusGroupDetails | null> {
      const group = await this.getWumpusGroup(groupId, ownerId);
      if (!group) return null;
      const [serversResult, configsResult] = await Promise.all([
        pool.query<WumpusGuild & { exceptions: JsonObject; addedAt: Date }>(
          `SELECT wg.guild_id AS "guildId", wg.name, wg.icon_url AS "iconUrl", wg.owner_id AS "ownerId",
                  wg.member_count AS "memberCount", wg.bot_permissions AS "botPermissions", wg.installed_at AS "installedAt",
                  wg.last_synced_at AS "lastSyncedAt", wg.is_active AS "isActive",
                  gs.exceptions, gs.added_at AS "addedAt"
           FROM wumpus_group_servers gs
           JOIN wumpus_guilds wg ON wg.guild_id = gs.guild_id
           WHERE gs.group_id = $1 AND wg.is_active = TRUE
           ORDER BY wg.name ASC`,
          [groupId]
        ),
        pool.query<WumpusGroupModuleConfig>(`SELECT ${groupConfigColumns} FROM wumpus_group_module_configs WHERE group_id = $1 ORDER BY module ASC`, [groupId])
      ]);
      return { group, servers: serversResult.rows, configs: configsResult.rows };
    },
    async assignWumpusGuildToGroup(input: { groupId: number; guildId: string }) {
      const result = await pool.query<WumpusGroupMember>(
        `INSERT INTO wumpus_group_servers (group_id, guild_id)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET group_id = EXCLUDED.group_id, exceptions = '{}'::jsonb, added_at = NOW()
         RETURNING group_id AS "groupId", guild_id AS "guildId", exceptions, added_at AS "addedAt"`,
        [input.groupId, input.guildId]
      );
      await pool.query(`UPDATE wumpus_groups SET updated_at = NOW() WHERE id = $1`, [input.groupId]);
      return result.rows[0];
    },
    async removeWumpusGuildFromGroup(input: { groupId: number; guildId: string }) {
      await pool.query(`DELETE FROM wumpus_group_servers WHERE group_id = $1 AND guild_id = $2`, [input.groupId, input.guildId]);
      await pool.query(`UPDATE wumpus_groups SET updated_at = NOW() WHERE id = $1`, [input.groupId]);
    },
    async getWumpusGroupModuleConfig(groupId: number, module: WumpusModule) {
      const result = await pool.query<WumpusGroupModuleConfig>(`SELECT ${groupConfigColumns} FROM wumpus_group_module_configs WHERE group_id = $1 AND module = $2 LIMIT 1`, [groupId, module]);
      return result.rows[0] ?? null;
    },
    async saveWumpusGroupModuleConfig(input: { groupId: number; module: WumpusModule; enabled: boolean; config: JsonObject; updatedBy?: string | null }) {
      const result = await pool.query<WumpusGroupModuleConfig>(
        `INSERT INTO wumpus_group_module_configs (group_id, module, enabled, config, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (group_id, module) DO UPDATE SET enabled = EXCLUDED.enabled, config = EXCLUDED.config, updated_by = EXCLUDED.updated_by, updated_at = NOW()
         RETURNING ${groupConfigColumns}`,
        [input.groupId, input.module, input.enabled, JSON.stringify(input.config), input.updatedBy ?? null]
      );
      await pool.query(`UPDATE wumpus_groups SET updated_at = NOW() WHERE id = $1`, [input.groupId]);
      return result.rows[0];
    },
    async setWumpusServerModuleException(input: { groupId: number; guildId: string; module: WumpusModule; mode: "inherit" | "disabled" | "override"; enabled?: boolean; config?: JsonObject }) {
      const membershipResult = await pool.query<WumpusGroupMember>(
        `SELECT group_id AS "groupId", guild_id AS "guildId", exceptions, added_at AS "addedAt"
         FROM wumpus_group_servers WHERE group_id = $1 AND guild_id = $2 LIMIT 1`,
        [input.groupId, input.guildId]
      );
      const membership = membershipResult.rows[0];
      if (!membership) return null;
      const exceptions = { ...(membership.exceptions ?? {}) };
      if (input.mode === "inherit") delete exceptions[input.module];
      else exceptions[input.module] = input.mode === "disabled" ? { mode: "disabled" } : { mode: "override", enabled: input.enabled !== false, config: input.config ?? {} };
      const result = await pool.query<WumpusGroupMember>(
        `UPDATE wumpus_group_servers SET exceptions = $3::jsonb WHERE group_id = $1 AND guild_id = $2
         RETURNING group_id AS "groupId", guild_id AS "guildId", exceptions, added_at AS "addedAt"`,
        [input.groupId, input.guildId, JSON.stringify(exceptions)]
      );
      await pool.query(`UPDATE wumpus_groups SET updated_at = NOW() WHERE id = $1`, [input.groupId]);
      return result.rows[0] ?? null;
    },
    async getWumpusModuleConfig(guildId: string, module: WumpusModule) {
      const result = await pool.query<WumpusModuleConfig>(`SELECT ${configColumns} FROM wumpus_module_configs WHERE guild_id = $1 AND module = $2`, [guildId, module]);
      return result.rows[0] ?? null;
    },
    async listWumpusModuleConfigs(guildId: string) {
      const result = await pool.query<WumpusModuleConfig>(`SELECT ${configColumns} FROM wumpus_module_configs WHERE guild_id = $1 ORDER BY module ASC`, [guildId]);
      return result.rows;
    },
    async getWumpusConfigOrDefault(guildId: string, module: WumpusModule): Promise<JsonObject> {
      return (await effectiveWumpusModuleConfig(guildId, module)).config;
    },
    async getEffectiveWumpusModuleConfig(guildId: string, module: WumpusModule) {
      return effectiveWumpusModuleConfig(guildId, module);
    },
    async saveWumpusModuleConfig(input: { guildId: string; module: WumpusModule; enabled: boolean; config: JsonObject; updatedBy?: string | null }) {
      const result = await pool.query<WumpusModuleConfig>(
        `INSERT INTO wumpus_module_configs (guild_id, module, enabled, config, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (guild_id, module) DO UPDATE SET enabled = EXCLUDED.enabled, config = EXCLUDED.config,
           updated_by = EXCLUDED.updated_by, updated_at = NOW()
         RETURNING ${configColumns}`,
        [input.guildId, input.module, input.enabled, JSON.stringify(input.config), input.updatedBy ?? null]
      );
      return result.rows[0];
    },
    async recordWumpusEvent(input: Omit<WumpusEvent, "id" | "occurredAt">) {
      const result = await pool.query<WumpusEvent>(
        `INSERT INTO wumpus_events (guild_id, module, event_type, actor_id, target_id, channel_id, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING ${eventColumns}`,
        [input.guildId, input.module, input.eventType, input.actorId, input.targetId, input.channelId, JSON.stringify(input.data)]
      );
      return result.rows[0];
    },
    async incrementWumpusDailyMetric(guildId: string, metric: "joins" | "leaves" | "messages" | "moderationActions", amount = 1) {
      const column: Record<typeof metric, string> = { joins: "joins", leaves: "leaves", messages: "messages", moderationActions: "moderation_actions" };
      await pool.query(
        `INSERT INTO wumpus_daily_metrics (guild_id, day, ${column[metric]}) VALUES ($1, CURRENT_DATE, $2)
         ON CONFLICT (guild_id, day) DO UPDATE SET ${column[metric]} = wumpus_daily_metrics.${column[metric]} + $2`,
        [guildId, amount]
      );
    },
    async addSecurityIncident(input: Omit<WumpusIncident, "id" | "createdAt" | "resolvedAt">) {
      const result = await pool.query<WumpusIncident>(
        `INSERT INTO wumpus_security_incidents (guild_id, incident_type, severity, status, actor_id, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING ${incidentColumns}`,
        [input.guildId, input.incidentType, input.severity, input.status, input.actorId, JSON.stringify(input.details)]
      );
      return result.rows[0];
    },
    async createWumpusCase(input: Omit<WumpusCase, "id" | "createdAt" | "resolvedAt">) {
      const result = await pool.query<WumpusCase>(
        `INSERT INTO wumpus_cases (guild_id, case_type, status, reporter_id, target_id, assigned_to, reason, evidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING ${caseColumns}`,
        [input.guildId, input.caseType, input.status, input.reporterId, input.targetId, input.assignedTo, input.reason, JSON.stringify(input.evidence)]
      );
      return result.rows[0];
    },
    async createWumpusTicket(input: { guildId: string; channelId: string; openerId: string; department?: string | null }) {
      const result = await pool.query<WumpusTicket>(
        `INSERT INTO wumpus_tickets (guild_id, channel_id, opener_id, department)
         VALUES ($1, $2, $3, $4)
         RETURNING id, guild_id AS "guildId", channel_id AS "channelId", opener_id AS "openerId", department, status,
           claimed_by AS "claimedBy", created_at AS "createdAt", closed_at AS "closedAt"`,
        [input.guildId, input.channelId, input.openerId, input.department ?? null]
      );
      return result.rows[0];
    },
    async getWumpusTicketByChannel(channelId: string) {
      const result = await pool.query<WumpusTicket>(
        `SELECT id, guild_id AS "guildId", channel_id AS "channelId", opener_id AS "openerId", department, status,
          claimed_by AS "claimedBy", created_at AS "createdAt", closed_at AS "closedAt"
         FROM wumpus_tickets WHERE channel_id = $1 LIMIT 1`,
        [channelId]
      );
      return result.rows[0] ?? null;
    },
    async closeWumpusTicket(ticketId: number) {
      await pool.query(`UPDATE wumpus_tickets SET status = 'closed', closed_at = NOW() WHERE id = $1`, [ticketId]);
    },
    async listWumpusTicketDepartments(guildId: string) {
      const result = await pool.query<WumpusTicketDepartment>(
        `SELECT id, guild_id AS "guildId", name, description, emoji, category_id AS "categoryId",
          staff_role_ids AS "staffRoleIds", position, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM wumpus_ticket_departments WHERE guild_id = $1 ORDER BY position ASC, name ASC`,
        [guildId]
      );
      return result.rows;
    },
    async saveWumpusTicketDepartment(input: { id?: number; guildId: string; name: string; description?: string; emoji?: string; categoryId?: string | null; staffRoleIds?: string[]; position?: number; isActive?: boolean }) {
      const result = input.id ? await pool.query<WumpusTicketDepartment>(
        `UPDATE wumpus_ticket_departments SET name = $3, description = $4, emoji = $5, category_id = $6,
           staff_role_ids = $7::jsonb, position = $8, is_active = $9, updated_at = NOW()
         WHERE id = $1 AND guild_id = $2
         RETURNING id, guild_id AS "guildId", name, description, emoji, category_id AS "categoryId", staff_role_ids AS "staffRoleIds", position, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [input.id, input.guildId, input.name, input.description ?? "", input.emoji ?? "💬", input.categoryId ?? null, JSON.stringify(input.staffRoleIds ?? []), input.position ?? 0, input.isActive !== false]
      ) : await pool.query<WumpusTicketDepartment>(
        `INSERT INTO wumpus_ticket_departments (guild_id, name, description, emoji, category_id, staff_role_ids, position, is_active)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         ON CONFLICT (guild_id, name) DO UPDATE SET description = EXCLUDED.description, emoji = EXCLUDED.emoji,
           category_id = EXCLUDED.category_id, staff_role_ids = EXCLUDED.staff_role_ids, position = EXCLUDED.position,
           is_active = EXCLUDED.is_active, updated_at = NOW()
         RETURNING id, guild_id AS "guildId", name, description, emoji, category_id AS "categoryId", staff_role_ids AS "staffRoleIds", position, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
        [input.guildId, input.name, input.description ?? "", input.emoji ?? "💬", input.categoryId ?? null, JSON.stringify(input.staffRoleIds ?? []), input.position ?? 0, input.isActive !== false]
      );
      return result.rows[0] ?? null;
    },
    async listWumpusForms(guildId: string) {
      const result = await pool.query<WumpusForm>(
        `SELECT id, guild_id AS "guildId", name, description, fields, reviewer_role_ids AS "reviewerRoleIds",
          is_active AS "isActive", created_at AS "createdAt" FROM wumpus_forms WHERE guild_id = $1 ORDER BY created_at DESC`,
        [guildId]
      );
      return result.rows;
    },
    async saveWumpusForm(input: { id?: number; guildId: string; name: string; description?: string; fields: JsonObject[]; reviewerRoleIds?: string[]; isActive?: boolean }) {
      const result = input.id ? await pool.query<WumpusForm>(
        `UPDATE wumpus_forms SET name = $3, description = $4, fields = $5::jsonb, reviewer_role_ids = $6::jsonb, is_active = $7
         WHERE id = $1 AND guild_id = $2 RETURNING id, guild_id AS "guildId", name, description, fields,
           reviewer_role_ids AS "reviewerRoleIds", is_active AS "isActive", created_at AS "createdAt"`,
        [input.id, input.guildId, input.name, input.description ?? "", JSON.stringify(input.fields), JSON.stringify(input.reviewerRoleIds ?? []), input.isActive !== false]
      ) : await pool.query<WumpusForm>(
        `INSERT INTO wumpus_forms (guild_id, name, description, fields, reviewer_role_ids, is_active)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
         RETURNING id, guild_id AS "guildId", name, description, fields, reviewer_role_ids AS "reviewerRoleIds",
           is_active AS "isActive", created_at AS "createdAt"`,
        [input.guildId, input.name, input.description ?? "", JSON.stringify(input.fields), JSON.stringify(input.reviewerRoleIds ?? []), input.isActive !== false]
      );
      return result.rows[0] ?? null;
    },
    async saveWumpusDashboardSession(input: WumpusDashboardSession) {
      await pool.query(`DELETE FROM wumpus_dashboard_sessions WHERE expires_at <= NOW()`);
      await pool.query(
        `INSERT INTO wumpus_dashboard_sessions (session_id, user_id, username, global_name, avatar, guilds, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         ON CONFLICT (session_id) DO UPDATE SET user_id = EXCLUDED.user_id, username = EXCLUDED.username,
           global_name = EXCLUDED.global_name, avatar = EXCLUDED.avatar, guilds = EXCLUDED.guilds, expires_at = EXCLUDED.expires_at`,
        [input.sessionId, input.userId, input.username, input.globalName, input.avatar, JSON.stringify(input.guilds), input.expiresAt]
      );
    },
    async getWumpusDashboardSession(sessionId: string) {
      const result = await pool.query<WumpusDashboardSession>(
        `SELECT session_id AS "sessionId", user_id AS "userId", username, global_name AS "globalName", avatar, guilds,
           expires_at AS "expiresAt"
         FROM wumpus_dashboard_sessions WHERE session_id = $1 AND expires_at > NOW() LIMIT 1`,
        [sessionId]
      );
      return result.rows[0] ?? null;
    },
    async deleteWumpusDashboardSession(sessionId: string) {
      await pool.query(`DELETE FROM wumpus_dashboard_sessions WHERE session_id = $1`, [sessionId]);
    },
    async saveWumpusLicense(input: { discordUserId: string; plan: WumpusLicense["plan"]; status: WumpusLicense["status"]; maxServers: number; expiresAt?: Date | null; notes?: string }) {
      const result = await pool.query<WumpusLicense>(
        `INSERT INTO wumpus_licenses (discord_user_id, plan, status, max_servers, expires_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (discord_user_id) DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status,
           max_servers = EXCLUDED.max_servers, expires_at = EXCLUDED.expires_at, notes = EXCLUDED.notes, updated_at = NOW()
         RETURNING ${licenseColumns}`,
        [input.discordUserId, input.plan, input.status, input.maxServers, input.expiresAt ?? null, input.notes ?? ""]
      );
      return result.rows[0];
    },
    async getWumpusLicense(discordUserId: string) {
      const result = await pool.query<WumpusLicense>(`SELECT ${licenseColumns} FROM wumpus_licenses WHERE discord_user_id = $1 LIMIT 1`, [discordUserId]);
      return result.rows[0] ?? null;
    },
    async hasActiveWumpusLicense(discordUserId: string) {
      const result = await pool.query<{ allowed: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM wumpus_licenses WHERE discord_user_id = $1 AND status = 'active'
             AND (expires_at IS NULL OR expires_at > NOW())
         ) AS allowed`,
        [discordUserId]
      );
      return result.rows[0]?.allowed === true;
    },
    async listWumpusLicenses(limit = 200) {
      const result = await pool.query<WumpusLicense>(`SELECT ${licenseColumns} FROM wumpus_licenses ORDER BY updated_at DESC LIMIT $1`, [limit]);
      return result.rows;
    },
    async createWumpusOccurrence(input: { guildId: string; targetId: string; staffId: string; requestedAction: WumpusOccurrence["requestedAction"]; reason: string; evidence?: JsonObject[]; strikeNumber: number; timeoutMinutes?: number | null; status: WumpusOccurrence["status"]; appliedAction?: string | null }) {
      const result = await pool.query<WumpusOccurrence>(
        `INSERT INTO wumpus_occurrences (guild_id, target_id, staff_id, requested_action, applied_action, reason, evidence, strike_number, timeout_minutes, status, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, CASE WHEN $10 = 'applied' THEN NOW() ELSE NULL END)
         RETURNING ${occurrenceColumns}`,
        [input.guildId, input.targetId, input.staffId, input.requestedAction, input.appliedAction ?? null, input.reason, JSON.stringify(input.evidence ?? []), input.strikeNumber, input.timeoutMinutes ?? null, input.status]
      );
      return result.rows[0];
    },
    async countWumpusOccurrences(guildId: string, targetId: string) {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM wumpus_occurrences WHERE guild_id = $1 AND target_id = $2 AND status <> 'rejected'`,
        [guildId, targetId]
      );
      return Number(result.rows[0]?.count ?? 0);
    },
    async listWumpusOccurrences(input: { guildId?: string; status?: WumpusOccurrence["status"]; limit?: number } = {}) {
      const values: unknown[] = [];
      const filters: string[] = [];
      if (input.guildId) { values.push(input.guildId); filters.push(`guild_id = $${values.length}`); }
      if (input.status) { values.push(input.status); filters.push(`status = $${values.length}`); }
      values.push(input.limit ?? 200);
      const result = await pool.query<WumpusOccurrence>(
        `SELECT ${occurrenceColumns} FROM wumpus_occurrences ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
         ORDER BY created_at DESC LIMIT $${values.length}`,
        values
      );
      return result.rows;
    },
    async reviewWumpusOccurrence(input: { id: number; decision: "approved" | "rejected"; reviewedBy: string; note?: string }) {
      const result = await pool.query<WumpusOccurrence>(
        `UPDATE wumpus_occurrences SET status = $2, reviewed_by = $3, review_note = $4, reviewed_at = NOW()
         WHERE id = $1 AND status = 'pending' RETURNING ${occurrenceColumns}`,
        [input.id, input.decision, input.reviewedBy, input.note ?? null]
      );
      return result.rows[0] ?? null;
    },
    async claimApprovedWumpusOccurrences(limit = 20) {
      const result = await pool.query<WumpusOccurrence>(
        `UPDATE wumpus_occurrences SET status = 'processing'
         WHERE id IN (SELECT id FROM wumpus_occurrences WHERE status = 'approved' ORDER BY reviewed_at ASC FOR UPDATE SKIP LOCKED LIMIT $1)
         RETURNING ${occurrenceColumns}`,
        [limit]
      );
      return result.rows;
    },
    async finishWumpusOccurrence(input: { id: number; status: "applied" | "failed"; appliedAction?: string | null; error?: string | null }) {
      const result = await pool.query<WumpusOccurrence>(
        `UPDATE wumpus_occurrences SET status = $2, applied_action = $3, error = $4,
           applied_at = CASE WHEN $2 = 'applied' THEN NOW() ELSE applied_at END
         WHERE id = $1 AND status = 'processing' RETURNING ${occurrenceColumns}`,
        [input.id, input.status, input.appliedAction ?? null, input.error ?? null]
      );
      return result.rows[0] ?? null;
    },
    async getWumpusAdminStats(): Promise<WumpusAdminStats> {
      const result = await pool.query<Record<keyof WumpusAdminStats, string>>(
        `SELECT
          (SELECT COUNT(*) FROM wumpus_licenses) AS licenses,
          (SELECT COUNT(*) FROM wumpus_licenses WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())) AS "activeLicenses",
          (SELECT COALESCE(SUM(max_servers), 0) FROM wumpus_licenses WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())) AS "licensedServers",
          (SELECT COUNT(*) FROM wumpus_guilds WHERE is_active = TRUE) AS "installedServers",
          (SELECT COUNT(*) FROM wumpus_occurrences WHERE status = 'pending') AS "pendingOccurrences",
          (SELECT COUNT(DISTINCT user_id) FROM wumpus_dashboard_sessions) AS "registeredDiscordAccounts"`
      );
      const row = result.rows[0];
      return {
        licenses: Number(row?.licenses ?? 0), activeLicenses: Number(row?.activeLicenses ?? 0),
        licensedServers: Number(row?.licensedServers ?? 0), installedServers: Number(row?.installedServers ?? 0),
        pendingOccurrences: Number(row?.pendingOccurrences ?? 0), registeredDiscordAccounts: Number(row?.registeredDiscordAccounts ?? 0)
      };
    },
    async createWumpusApplication(input: { guildId: string; submitterId: string; answers: JsonObject }) {
      const existing = await pool.query<{ id: number }>(`SELECT id FROM wumpus_forms WHERE guild_id = $1 AND name = 'Candidatura padrão' ORDER BY id ASC LIMIT 1`, [input.guildId]);
      let formId = existing.rows[0]?.id;
      if (!formId) {
        const form = await pool.query<{ id: number }>(
          `INSERT INTO wumpus_forms (guild_id, name, description, fields)
           VALUES ($1, 'Candidatura padrão', 'Formulário inicial de candidatura', '[{"key":"application","label":"Candidatura"}]'::jsonb)
           RETURNING id`,
          [input.guildId]
        );
        formId = form.rows[0]?.id;
      }
      if (!formId) throw new Error("Unable to create the default application form.");
      const result = await pool.query<{ id: number }>(
        `INSERT INTO wumpus_form_submissions (form_id, guild_id, submitter_id, answers) VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
        [formId, input.guildId, input.submitterId, JSON.stringify(input.answers)]
      );
      return result.rows[0].id;
    },
    async createWumpusFormSubmission(input: { formId: number; guildId: string; submitterId: string; answers: JsonObject }) {
      const result = await pool.query<{ id: number }>(
        `INSERT INTO wumpus_form_submissions (form_id, guild_id, submitter_id, answers)
         SELECT id, guild_id, $3, $4::jsonb FROM wumpus_forms WHERE id = $1 AND guild_id = $2 AND is_active = TRUE
         RETURNING id`,
        [input.formId, input.guildId, input.submitterId, JSON.stringify(input.answers)]
      );
      return result.rows[0]?.id ?? null;
    },
    async updateWumpusApplicationAiSummary(submissionId: number, summary: JsonObject) {
      await pool.query(`UPDATE wumpus_form_submissions SET ai_summary = $2::jsonb WHERE id = $1`, [submissionId, JSON.stringify(summary)]);
    },
    async createWumpusRoleDraft(input: { guildId: string; createdBy: string; request: string; draft: JsonObject }) {
      const result = await pool.query<WumpusRoleDraft>(
        `INSERT INTO wumpus_role_drafts (guild_id, created_by, request, draft) VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id, guild_id AS "guildId", created_by AS "createdBy", request, draft, status,
           reviewed_by AS "reviewedBy", error, created_at AS "createdAt", reviewed_at AS "reviewedAt"`,
        [input.guildId, input.createdBy, input.request, JSON.stringify(input.draft)]
      );
      return result.rows[0];
    },
    async getWumpusRoleDraft(id: number, guildId: string) {
      const result = await pool.query<WumpusRoleDraft>(
        `SELECT id, guild_id AS "guildId", created_by AS "createdBy", request, draft, status,
           reviewed_by AS "reviewedBy", error, created_at AS "createdAt", reviewed_at AS "reviewedAt"
         FROM wumpus_role_drafts WHERE id = $1 AND guild_id = $2 LIMIT 1`, [id, guildId]
      );
      return result.rows[0] ?? null;
    },
    async finishWumpusRoleDraft(input: { id: number; guildId: string; status: "applied" | "rejected" | "failed"; reviewedBy: string; error?: string | null }) {
      const result = await pool.query<WumpusRoleDraft>(
        `UPDATE wumpus_role_drafts SET status = $3, reviewed_by = $4, error = $5, reviewed_at = NOW()
         WHERE id = $1 AND guild_id = $2 AND status = 'pending'
         RETURNING id, guild_id AS "guildId", created_by AS "createdBy", request, draft, status,
           reviewed_by AS "reviewedBy", error, created_at AS "createdAt", reviewed_at AS "reviewedAt"`,
        [input.id, input.guildId, input.status, input.reviewedBy, input.error ?? null]
      );
      return result.rows[0] ?? null;
    },
    async searchWumpusKnowledge(guildId: string, query: string) {
      const result = await pool.query<{ title: string; content: string; updatedAt: Date }>(
        `SELECT title, content, updated_at AS "updatedAt" FROM wumpus_knowledge_articles
         WHERE guild_id = $1 AND status = 'published' AND (title ILIKE $2 OR content ILIKE $2)
         ORDER BY updated_at DESC LIMIT 5`,
        [guildId, `%${query.slice(0, 160)}%`]
      );
      return result.rows;
    },
    async upsertWumpusRoleSnapshots(guildId: string, roles: Omit<WumpusRoleSnapshot, "guildId" | "updatedAt">[]) {
      const connection = await pool.connect();
      try {
        await connection.query("BEGIN");
        await connection.query(`DELETE FROM wumpus_role_snapshots WHERE guild_id = $1`, [guildId]);
        for (const role of roles) {
          await connection.query(
            `INSERT INTO wumpus_role_snapshots (guild_id, role_id, name, color, position, permissions, managed, mentionable)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [guildId, role.roleId, role.name, role.color, role.position, role.permissions, role.managed, role.mentionable]
          );
        }
        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    },
    async upsertWumpusChannelSnapshots(guildId: string, channels: Omit<WumpusChannelSnapshot, "guildId" | "updatedAt">[]) {
      const connection = await pool.connect();
      try {
        await connection.query("BEGIN");
        await connection.query(`DELETE FROM wumpus_channel_snapshots WHERE guild_id = $1`, [guildId]);
        for (const channel of channels) {
          await connection.query(
            `INSERT INTO wumpus_channel_snapshots (guild_id, channel_id, name, type, parent_id, position)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [guildId, channel.channelId, channel.name, channel.type, channel.parentId, channel.position]
          );
        }
        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    },
    async listWumpusChannelSnapshots(guildId: string) {
      const result = await pool.query<WumpusChannelSnapshot>(
        `SELECT guild_id AS "guildId", channel_id AS "channelId", name, type, parent_id AS "parentId", position, updated_at AS "updatedAt"
         FROM wumpus_channel_snapshots WHERE guild_id = $1 ORDER BY position ASC, name ASC`,
        [guildId]
      );
      return result.rows;
    },
    async queueWumpusPanelPublication(input: { guildId: string; channelId: string; module: "tickets" | "forms"; payload: JsonObject; createdBy: string }) {
      const result = await pool.query<WumpusPanelPublication>(
        `INSERT INTO wumpus_panel_publications (guild_id, channel_id, module, payload, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING ${panelPublicationColumns}`,
        [input.guildId, input.channelId, input.module, JSON.stringify(input.payload), input.createdBy]
      );
      return result.rows[0];
    },
    async listPendingWumpusPanelPublications(limit = 20) {
      const result = await pool.query<WumpusPanelPublication>(
        `SELECT ${panelPublicationColumns} FROM wumpus_panel_publications WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`,
        [limit]
      );
      return result.rows;
    },
    async finishWumpusPanelPublication(input: { id: number; status: "published" | "failed"; messageId?: string | null; error?: string | null }) {
      await pool.query(
        `UPDATE wumpus_panel_publications SET status = $2, message_id = $3, error = $4, processed_at = NOW() WHERE id = $1`,
        [input.id, input.status, input.messageId ?? null, input.error ?? null]
      );
    },
    async getWumpusOverview(guildId: string): Promise<WumpusOverview> {
      const [guildResult, metricsResult, incidentsResult, casesResult, rolesResult, eventsResult, countsResult, groupResult, memberResult, effectiveConfigs] = await Promise.all([
        pool.query<WumpusGuild>(`SELECT ${guildColumns} FROM wumpus_guilds WHERE guild_id = $1 AND is_active = TRUE`, [guildId]),
        pool.query<{ day: Date; joins: number; leaves: number; messages: number; moderationActions: number }>(`SELECT day, joins, leaves, messages, moderation_actions AS "moderationActions" FROM wumpus_daily_metrics WHERE guild_id = $1 ORDER BY day DESC LIMIT 30`, [guildId]),
        pool.query<WumpusIncident>(`SELECT ${incidentColumns} FROM wumpus_security_incidents WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 12`, [guildId]),
        pool.query<WumpusCase>(`SELECT ${caseColumns} FROM wumpus_cases WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 12`, [guildId]),
        pool.query<WumpusRoleSnapshot>(`SELECT guild_id AS "guildId", role_id AS "roleId", name, color, position, permissions, managed, mentionable, updated_at AS "updatedAt" FROM wumpus_role_snapshots WHERE guild_id = $1 ORDER BY position DESC`, [guildId]),
        pool.query<WumpusEvent>(`SELECT ${eventColumns} FROM wumpus_events WHERE guild_id = $1 ORDER BY occurred_at DESC LIMIT 20`, [guildId]),
        pool.query<{ openIncidents: string; openCases: string; activeAutomations: string; activeWebhooks: string; knowledgeArticles: string }>(
          `SELECT
             (SELECT COUNT(*) FROM wumpus_security_incidents WHERE guild_id = $1 AND status = 'open') AS "openIncidents",
             (SELECT COUNT(*) FROM wumpus_cases WHERE guild_id = $1 AND status IN ('open', 'in_review')) AS "openCases",
             (SELECT COUNT(*) FROM wumpus_automations WHERE guild_id = $1 AND enabled = TRUE) AS "activeAutomations",
             (SELECT COUNT(*) FROM wumpus_webhooks WHERE guild_id = $1 AND enabled = TRUE) AS "activeWebhooks",
             (SELECT COUNT(*) FROM wumpus_knowledge_articles WHERE guild_id = $1 AND status = 'published') AS "knowledgeArticles"`,
          [guildId]
        ),
        pool.query<WumpusGroup>(
          `SELECT ${groupColumns}
           FROM wumpus_groups g JOIN wumpus_group_servers gs ON gs.group_id = g.id
           WHERE gs.guild_id = $1 GROUP BY g.id`,
          [guildId]
        ),
        pool.query<WumpusGroupMember>(
          `SELECT group_id AS "groupId", guild_id AS "guildId", exceptions, added_at AS "addedAt"
           FROM wumpus_group_servers WHERE guild_id = $1 LIMIT 1`,
          [guildId]
        ),
        Promise.all(wumpusModules.map((module) => effectiveWumpusModuleConfig(guildId, module)))
      ]);
      const rawCounts = countsResult.rows[0] ?? { openIncidents: "0", openCases: "0", activeAutomations: "0", activeWebhooks: "0", knowledgeArticles: "0" };
      const membership = memberResult.rows[0];
      const exceptionModules = Object.keys(membership?.exceptions ?? {}).filter((module): module is WumpusModule => wumpusModules.includes(module as WumpusModule));
      return {
        guild: guildResult.rows[0] ?? null,
        configs: effectiveConfigs.map((config) => ({ guildId, module: config.module, enabled: config.enabled, config: config.config, updatedBy: null, updatedAt: new Date() })),
        group: groupResult.rows[0] ?? null,
        exceptionModules,
        metrics: metricsResult.rows,
        incidents: incidentsResult.rows,
        cases: casesResult.rows,
        roles: rolesResult.rows,
        events: eventsResult.rows,
        counts: {
          openIncidents: Number(rawCounts.openIncidents),
          openCases: Number(rawCounts.openCases),
          activeAutomations: Number(rawCounts.activeAutomations),
          activeWebhooks: Number(rawCounts.activeWebhooks),
          knowledgeArticles: Number(rawCounts.knowledgeArticles)
        }
      };
    },
    async close() {
      await pool.end();
    }
  };
}
