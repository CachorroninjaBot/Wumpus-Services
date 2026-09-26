import type { ModuleId } from "../core/brand";

/* ------------------------------------------------------------------ *
 * Tipos espelhando as respostas da API do servidor.
 * ------------------------------------------------------------------ */

export type SessionUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
};

export type SessionGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  wumpusInstalled: boolean;
};

export type Group = {
  id: number;
  ownerId: string;
  name: string;
  description: string;
  color: string;
  serverCount: number;
};

export type GuildGroupLink = {
  guildId: string;
  groupId: number;
  name: string;
  color: string;
};

export type Me = {
  user: SessionUser;
  guilds: SessionGuild[];
  groups: Group[];
  guildGroups: GuildGroupLink[];
};

export type ExceptionMode = "inherit" | "disabled" | "override";

export type ModuleSummary = {
  module: ModuleId;
  enabled: boolean;
  source: "group" | "server" | "default";
  exceptionMode: ExceptionMode;
  config: Record<string, unknown>;
};

export type GuildOverview = {
  guild: {
    guildId: string;
    name: string;
    iconUrl: string | null;
    memberCount: number | null;
    isActive: boolean;
    lastSyncedAt: string;
  };
  group: Group | null;
  modules: ModuleSummary[];
  counts: {
    activeModules: number;
    customModules: number;
    openIncidents: number;
    openTickets: number;
    knowledgeArticles: number;
  };
  events: Array<{ id: number; module: string; eventType: string; severity: string; occurredAt: string }>;
};

export type GroupDetails = {
  group: { id: number; name: string; description: string; color: string };
  servers: Array<{ guildId: string; name: string; iconUrl: string | null; exceptions: number }>;
  configs: Array<{ module: ModuleId; enabled: boolean; config: Record<string, unknown> }>;
};

export type ModuleDetail = {
  module: ModuleId;
  group: Group | null;
  resolved: ModuleSummary;
  defaults: Record<string, unknown>;
  exceptions: Array<{ module: ModuleId; mode: ExceptionMode }>;
};

export type AuditEvent = {
  id: number;
  module: string;
  eventType: string;
  actorId: string | null;
  targetId: string | null;
  severity: string;
  data: Record<string, unknown>;
  occurredAt: string;
};

/* ------------------------------------------------------------------ *
 * Cliente HTTP
 * ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin"
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "request_failed";
    throw new ApiError(response.status, code);
  }

  return payload as T;
}

/* ------------------------------------------------------------------ *
 * Acoes
 * ------------------------------------------------------------------ */

export const getMe = () => api<Me>("/api/me");

export const getOverview = (guildId: string) => api<GuildOverview>(`/api/guilds/${guildId}/overview`);

export const getModule = (guildId: string, module: ModuleId) =>
  api<ModuleDetail>(`/api/guilds/${guildId}/modules/${module}`);

export const saveGuildModule = (
  guildId: string,
  module: ModuleId,
  body: { mode?: ExceptionMode; enabled?: boolean; config?: Record<string, unknown> }
) => api<{ ok: boolean; scope: string }>(`/api/guilds/${guildId}/modules/${module}`, {
  method: "PUT",
  body: JSON.stringify(body)
});

export const saveGroupModule = (
  groupId: number,
  module: ModuleId,
  body: { enabled?: boolean; config?: Record<string, unknown> }
) => api<{ ok: boolean; affectedServers: number }>(`/api/groups/${groupId}/modules/${module}`, {
  method: "PUT",
  body: JSON.stringify(body)
});

export const getGroup = (groupId: number) => api<GroupDetails>(`/api/groups/${groupId}`);

export const createGroup = (body: { name: string; description: string; color: string }) =>
  api<{ group: Group }>("/api/groups", { method: "POST", body: JSON.stringify(body) });

export const addServerToGroup = (groupId: number, guildId: string) =>
  api<void>(`/api/groups/${groupId}/servers`, { method: "POST", body: JSON.stringify({ guildId }) });

export const removeServerFromGroup = (groupId: number, guildId: string) =>
  api<void>(`/api/groups/${groupId}/servers/${guildId}`, { method: "DELETE" });

export const getEvents = (guildId: string, limit = 50) =>
  api<{ events: AuditEvent[] }>(`/api/guilds/${guildId}/events?limit=${limit}`);

/* ---------------------------- incidentes --------------------------- */

export type Incident = {
  id: number;
  incidentType: "raid" | "nuke" | "automod" | "permission_risk";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "contained" | "dismissed";
  actorId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
};

export const getIncidents = (guildId: string, limit = 25) =>
  api<{ incidents: Incident[] }>(`/api/guilds/${guildId}/incidents?limit=${limit}`);

export const closeIncident = (guildId: string, incidentId: number, status: "contained" | "dismissed") =>
  api<{ ok: boolean }>(`/api/guilds/${guildId}/incidents/${incidentId}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });

/* ------------------------ base de conhecimento ---------------------- */

export type KnowledgeArticle = {
  id: number;
  title: string;
  body: string;
  tags: string[];
  status: "draft" | "approved" | "archived";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export const getArticles = (guildId: string) =>
  api<{ articles: KnowledgeArticle[] }>(`/api/guilds/${guildId}/knowledge`);

export const createArticle = (
  guildId: string,
  input: { title: string; body: string; tags: string[]; status: KnowledgeArticle["status"] }
) =>
  api<{ id: number; status: string }>(`/api/guilds/${guildId}/knowledge`, {
    method: "POST",
    body: JSON.stringify(input)
  });

export const updateArticle = (
  guildId: string,
  articleId: number,
  input: Partial<{ title: string; body: string; tags: string[]; status: KnowledgeArticle["status"] }>
) =>
  api<{ ok: boolean; status: string }>(`/api/guilds/${guildId}/knowledge/${articleId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });

export const deleteArticle = (guildId: string, articleId: number) =>
  api<{ ok: boolean }>(`/api/guilds/${guildId}/knowledge/${articleId}`, { method: "DELETE" });

/* ---------------------------- publicacoes -------------------------- */

export type GuildAssets = {
  channels: Array<{ id: string; name: string; type: number; parentId: string | null; position: number }>;
  roles: Array<{ id: string; name: string; color: number; position: number; managed: boolean }>;
  syncedAt: string | null;
};

export type Publication = {
  id: number;
  channelId: string;
  module: string;
  format: string;
  status: "pending" | "published" | "failed";
  messageId: string | null;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
};

export const getAssets = (guildId: string) => api<GuildAssets>(`/api/guilds/${guildId}/assets`);

export const getPublications = (guildId: string) =>
  api<{ publications: Publication[] }>(`/api/guilds/${guildId}/publications`);

export const publishPanel = (
  guildId: string,
  body: {
    module: string;
    channelId: string;
    format: "components_v2" | "embed";
    title: string;
    description: string;
    accentColor: string;
  }
) =>
  api<{ publication: { id: number } }>(`/api/guilds/${guildId}/publications`, {
    method: "POST",
    body: JSON.stringify(body)
  });

export const logout = () => api<void>("/auth/logout", { method: "POST" });

export const adminLogin = (username: string, password: string) =>
  api<{ ok: boolean; method: string }>("/auth/admin", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

/* ---------------------------- Admin: metricas ----------------------- */

export type MetricRoute = {
  kind: string;
  name: string;
  count: number;
  errors: number;
  totalMs: number;
  lastMs: number;
  lastOk: boolean;
  avgMs: number;
  errorRate: number;
};

export type MetricSample = {
  kind: string;
  name: string;
  durationMs: number;
  ok: boolean;
  status: number | null;
  at: string;
};

export type MetricsSnapshot = {
  windowMinutes: number;
  totals: {
    requests: number;
    requestErrors: number;
    avgRequestMs: number;
    aiCalls: number;
    aiErrors: number;
    avgAiMs: number;
  };
  routes: MetricRoute[];
  recent: MetricSample[];
};

export type AccessInfo = {
  userId: string;
  isAdmin: boolean;
  ownerId: string | null;
};

export const getAccess = () => api<AccessInfo>("/api/access");

export const getMetrics = (minutes = 15) =>
  api<MetricsSnapshot>(`/api/admin/metrics?minutes=${minutes}`);

export const getMembers = () =>
  api<{ members: Array<{ userId: string; role: string; note: string | null; addedBy: string | null; createdAt: string; lastSeenAt: string | null }>; ownerId: string | null }>("/api/admin/members");

export const addDashboardMember = (userId: string, role: string, note?: string) =>
  api<{ ok: boolean }>(`/api/admin/members`, {
    method: "POST",
    body: JSON.stringify({ userId, role, note })
  });

export const removeDashboardMember = (userId: string) =>
  api<{ ok: boolean }>(`/api/admin/members/${userId}`, { method: "DELETE" });

/* ------------------------------------------------------------------ *
 * Roteamento simples por pathname
 * ------------------------------------------------------------------ */

export type Route =
  | { name: "home" }
  | { name: "guild"; guildId: string }
  | { name: "module"; guildId: string; module: string }
  | { name: "group"; groupId: number }
  | { name: "admin" };

export function parseRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);

  // /wumpus/admin
  if (parts[0] === "wumpus" && parts[1] === "admin") {
    return { name: "admin" };
  }
  // /wumpus/groups/:groupId
  if (parts[0] === "wumpus" && parts[1] === "groups" && parts[2]) {
    const groupId = Number(parts[2]);
    if (Number.isSafeInteger(groupId)) return { name: "group", groupId };
    return { name: "home" };
  }
  // /wumpus/:guildId/:module
  if (parts[0] === "wumpus" && parts[1] && parts[2]) {
    return { name: "module", guildId: parts[1], module: parts[2] };
  }
  // /wumpus/:guildId
  if (parts[0] === "wumpus" && parts[1]) {
    return { name: "guild", guildId: parts[1] };
  }
  return { name: "home" };
}

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}