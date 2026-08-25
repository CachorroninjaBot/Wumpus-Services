import { parseWumpusModuleConfig, type WumpusModule } from "@huborder/core";
import { createDatabase, type JsonObject } from "@huborder/database";

export type InstalledGuild = {
  guildId: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  memberCount: number | null;
  botPermissions: string;
  installedAt: string;
  lastSyncedAt: string;
  isActive: boolean;
};

export type WumpusGroup = {
  id: number;
  ownerId: string;
  name: string;
  description: string;
  color: string;
  serverCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WumpusOverview = {
  guild: InstalledGuild;
  configs: Array<{ guildId: string; module: WumpusModule; enabled: boolean; config: Record<string, unknown>; updatedBy: string | null; updatedAt: string }>;
  group: WumpusGroup | null;
  exceptionModules: WumpusModule[];
  metrics: Array<{ day: string; joins: number; leaves: number; messages: number; moderationActions: number }>;
  incidents: Array<{ id: number; incidentType: string; severity: string; status: string; actorId: string | null; details: Record<string, unknown>; createdAt: string }>;
  cases: Array<{ id: number; caseType: string; status: string; reason: string; createdAt: string }>;
  roles: Array<{ roleId: string; name: string; color: number; position: number; permissions: string; managed: boolean; mentionable: boolean }>;
  events: Array<{ id: number; module: string; eventType: string; actorId: string | null; targetId: string | null; occurredAt: string; data: Record<string, unknown> }>;
  counts: { openIncidents: number; openCases: number; activeAutomations: number; activeWebhooks: number; knowledgeArticles: number };
};

export type WumpusGroupDetails = {
  group: WumpusGroup;
  servers: Array<InstalledGuild & { exceptions: Record<string, unknown>; addedAt: string }>;
  configs: Array<{ groupId: number; module: WumpusModule; enabled: boolean; config: Record<string, unknown>; updatedBy: string | null; updatedAt: string }>;
};

export type WumpusChannel = { guildId: string; channelId: string; name: string; type: number; parentId: string | null; position: number };

export class InternalApiError extends Error {
  constructor(readonly path: string, readonly status: number) {
    super(`Wumpus data operation returned ${status} for ${path}.`);
    this.name = "InternalApiError";
  }
}

export function isInternalApiError(error: unknown, status?: number): error is InternalApiError {
  return error instanceof InternalApiError && (status === undefined || error.status === status);
}

let database: ReturnType<typeof createDatabase> | null = null;

function db() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  database ??= createDatabase(connectionString);
  return database;
}

function serializable<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function notFound(path: string): never {
  throw new InternalApiError(path, 404);
}

export async function listInstalledWumpusGuilds() {
  return serializable<InstalledGuild[]>(await db().listWumpusGuilds());
}

export async function getWumpusOverview(guildId: string) {
  const overview = await db().getWumpusOverview(guildId);
  if (!overview.guild) notFound(`/wumpus/guilds/${guildId}/overview`);
  return serializable<WumpusOverview>(overview);
}

export async function listWumpusChannels(guildId: string) {
  return serializable<WumpusChannel[]>(await db().listWumpusChannelSnapshots(guildId));
}

export async function saveWumpusModuleConfig(input: { guildId: string; module: WumpusModule; enabled: boolean; config: Record<string, unknown>; userId: string }) {
  if (!await db().getWumpusGuild(input.guildId)) notFound(`/wumpus/guilds/${input.guildId}`);
  const config = parseWumpusModuleConfig(input.module, input.config) as JsonObject;
  const saved = await db().saveWumpusModuleConfig({ guildId: input.guildId, module: input.module, enabled: input.enabled, config, updatedBy: input.userId });
  await db().recordWumpusEvent({ guildId: input.guildId, module: input.module, eventType: "dashboard_config_updated", actorId: input.userId, targetId: null, channelId: null, data: { enabled: saved.enabled } });
  return serializable(saved);
}

export async function listWumpusGroups(userId: string) {
  return serializable<WumpusGroup[]>(await db().listWumpusGroups(userId));
}

export async function createWumpusGroup(input: { userId: string; name: string; description: string; color: string }) {
  try {
    const group = await db().createWumpusGroup({ ownerId: input.userId, name: input.name, description: input.description, color: input.color });
    return { group: serializable<WumpusGroup>(group) };
  } catch {
    throw new InternalApiError("/wumpus/groups", 409);
  }
}

export async function getWumpusGroup(groupId: number, userId: string) {
  const details = await db().getWumpusGroupDetails(groupId, userId);
  if (!details) notFound(`/wumpus/groups/${groupId}`);
  return serializable<WumpusGroupDetails>(details);
}

export async function saveWumpusGroupModuleConfig(input: { groupId: number; module: WumpusModule; enabled: boolean; config: Record<string, unknown>; userId: string }) {
  if (!await db().getWumpusGroup(input.groupId, input.userId)) notFound(`/wumpus/groups/${input.groupId}`);
  const config = parseWumpusModuleConfig(input.module, input.config) as JsonObject;
  const saved = await db().saveWumpusGroupModuleConfig({ groupId: input.groupId, module: input.module, enabled: input.enabled, config, updatedBy: input.userId });
  const details = await db().getWumpusGroupDetails(input.groupId, input.userId);
  await Promise.all((details?.servers ?? []).map((server) => db().recordWumpusEvent({ guildId: server.guildId, module: input.module, eventType: "group_config_updated", actorId: input.userId, targetId: null, channelId: null, data: { groupId: input.groupId, enabled: saved.enabled } })));
  return serializable(saved);
}

export async function assignWumpusServer(input: { groupId: number; guildId: string; userId: string }) {
  if (!await db().getWumpusGroup(input.groupId, input.userId)) notFound(`/wumpus/groups/${input.groupId}`);
  if (!await db().getWumpusGuild(input.guildId)) notFound(`/wumpus/guilds/${input.guildId}`);
  const member = await db().assignWumpusGuildToGroup({ groupId: input.groupId, guildId: input.guildId });
  await db().recordWumpusEvent({ guildId: input.guildId, module: "servers", eventType: "group_assigned", actorId: input.userId, targetId: null, channelId: null, data: { groupId: input.groupId } });
  return serializable(member);
}

export async function removeWumpusServer(input: { groupId: number; guildId: string; userId: string }) {
  if (!await db().getWumpusGroup(input.groupId, input.userId)) notFound(`/wumpus/groups/${input.groupId}`);
  await db().removeWumpusGuildFromGroup({ groupId: input.groupId, guildId: input.guildId });
  await db().recordWumpusEvent({ guildId: input.guildId, module: "servers", eventType: "group_removed", actorId: input.userId, targetId: null, channelId: null, data: { groupId: input.groupId } });
}

export async function saveWumpusServerException(input: { groupId: number; guildId: string; module: WumpusModule; mode: "inherit" | "disabled" | "override"; enabled?: boolean; config?: Record<string, unknown>; userId: string }) {
  if (!await db().getWumpusGroup(input.groupId, input.userId)) notFound(`/wumpus/groups/${input.groupId}`);
  const config = input.mode === "override" ? parseWumpusModuleConfig(input.module, input.config ?? {}) as JsonObject : undefined;
  const member = await db().setWumpusServerModuleException({ groupId: input.groupId, guildId: input.guildId, module: input.module, mode: input.mode, enabled: input.enabled, config });
  if (!member) notFound(`/wumpus/groups/${input.groupId}/servers/${input.guildId}`);
  return serializable(member);
}

export async function publishWumpusPanel(input: { guildId: string; userId: string; module: "tickets" | "forms"; channelId: string; format: "components_v2" | "embed"; title: string; description: string; accentColor: string }) {
  if (!await db().getWumpusGuild(input.guildId)) notFound(`/wumpus/guilds/${input.guildId}`);
  const publication = await db().queueWumpusPanelPublication({ guildId: input.guildId, channelId: input.channelId, module: input.module, payload: input as unknown as JsonObject, createdBy: input.userId });
  return { publication: serializable(publication) };
}
