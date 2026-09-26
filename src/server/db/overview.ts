import { modules as allModules, type ModuleId } from "../../core/brand.js";
import { defaultsFor } from "../../core/module-defaults.js";
import { getPool, type ExceptionMode } from "./index.js";

/**
 * Resolucao em lote.
 *
 * A versao por modulo (resolveModuleConfig) e correta mas faria dezenas de
 * queries para montar uma unica tela. Aqui lemos tudo de uma vez e aplicamos
 * a mesma regra de heranca em memoria: padrao -> grupo -> excecao do servidor.
 */

export type ModuleSummary = {
  module: ModuleId;
  enabled: boolean;
  source: "group" | "server" | "default";
  exceptionMode: ExceptionMode;
  config: Record<string, unknown>;
};

type ConfigRow = { module: ModuleId; enabled: boolean; config: Record<string, unknown> };
type ExceptionRow = { module: ModuleId; mode: ExceptionMode; enabled: boolean; config: Record<string, unknown> };

export async function listResolvedModuleConfigs(
  guildId: string
): Promise<{ groupId: number | null; modules: ModuleSummary[] }> {
  const db = getPool();

  const membership = await db.query<{ groupId: string }>(
    `select group_id as "groupId" from group_servers where guild_id = $1`,
    [guildId]
  );
  const groupId = membership.rows[0] ? Number(membership.rows[0].groupId) : null;

  const [configs, exceptions] = await Promise.all([
    groupId
      ? db.query<ConfigRow>(
          `select module, enabled, config from module_configs where scope = 'group' and scope_id = $1`,
          [String(groupId)]
        )
      : db.query<ConfigRow>(
          `select module, enabled, config from module_configs where scope = 'server' and scope_id = $1`,
          [guildId]
        ),
    db.query<ExceptionRow>(
      `select module, mode, enabled, config from server_module_exceptions where guild_id = $1`,
      [guildId]
    )
  ]);

  const configByModule = new Map(configs.rows.map((row) => [row.module, row]));
  const exceptionByModule = new Map(exceptions.rows.map((row) => [row.module, row]));

  const resolved = allModules.map((descriptor) => {
    const module = descriptor.id;
    const defaults = defaultsFor(module);
    const saved = configByModule.get(module);
    const exception = exceptionByModule.get(module);
    const base = { ...defaults, ...(saved?.config ?? {}) };
    const baseEnabled = saved?.enabled ?? true;

    if (!groupId) {
      return {
        module,
        enabled: saved?.enabled ?? true,
        config: base,
        source: saved ? ("server" as const) : ("default" as const),
        exceptionMode: "inherit" as ExceptionMode
      };
    }

    if (!exception || exception.mode === "inherit") {
      return {
        module,
        enabled: baseEnabled,
        config: base,
        source: "group" as const,
        exceptionMode: "inherit" as ExceptionMode
      };
    }

    if (exception.mode === "disabled") {
      return {
        module,
        enabled: false,
        config: base,
        source: "group" as const,
        exceptionMode: "disabled" as ExceptionMode
      };
    }

    return {
      module,
      enabled: exception.enabled,
      config: { ...base, ...exception.config },
      source: "server" as const,
      exceptionMode: "override" as ExceptionMode
    };
  });

  return { groupId, modules: resolved };
}

export type GroupSummary = {
  id: number;
  name: string;
  description: string;
  color: string;
  serverCount: number;
} | null;

export async function getGroupForGuild(guildId: string): Promise<GroupSummary> {
  const result = await getPool().query<{
    id: number;
    name: string;
    description: string;
    color: string;
    serverCount: number;
  }>(
    `select g.id, g.name, g.description, g.color,
            (select count(*)::integer from group_servers gs2 where gs2.group_id = g.id) as "serverCount"
     from groups g
     join group_servers gs on gs.group_id = g.id
     where gs.guild_id = $1`,
    [guildId]
  );
  return result.rows[0] ?? null;
}

export type GuildOverview = {
  guild: {
    guildId: string;
    name: string;
    iconUrl: string | null;
    memberCount: number | null;
    isActive: boolean;
    lastSyncedAt: string;
  };
  group: GroupSummary;
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

export async function getGuildOverview(guildId: string): Promise<GuildOverview | null> {
  const db = getPool();

  const guildResult = await db.query<{
    guildId: string;
    name: string;
    iconUrl: string | null;
    memberCount: number | null;
    isActive: boolean;
    lastSyncedAt: Date;
  }>(
    `select guild_id as "guildId", name, icon_url as "iconUrl", member_count as "memberCount",
            is_active as "isActive", last_synced_at as "lastSyncedAt"
     from guilds where guild_id = $1`,
    [guildId]
  );
  const guild = guildResult.rows[0];
  if (!guild) return null;

  const [resolved, group, incidents, tickets, knowledge, events] = await Promise.all([
    listResolvedModuleConfigs(guildId),
    getGroupForGuild(guildId),
    db.query<{ total: string }>(
      `select count(*)::text as total from incidents where guild_id = $1 and status = 'open'`,
      [guildId]
    ),
    db.query<{ total: string }>(
      `select count(*)::text as total from tickets where guild_id = $1 and status <> 'closed'`,
      [guildId]
    ),
    db.query<{ total: string }>(
      `select count(*)::text as total from knowledge_articles where guild_id = $1 and status = 'approved'`,
      [guildId]
    ),
    db.query<{ id: number; module: string; eventType: string; severity: string; occurredAt: Date }>(
      `select id, module, event_type as "eventType", severity, occurred_at as "occurredAt"
       from audit_events where guild_id = $1 order by occurred_at desc limit 8`,
      [guildId]
    )
  ]);

  return {
    guild: { ...guild, lastSyncedAt: guild.lastSyncedAt.toISOString() },
    group,
    modules: resolved.modules,
    counts: {
      activeModules: resolved.modules.filter((entry) => entry.enabled).length,
      customModules: resolved.modules.filter((entry) => entry.exceptionMode !== "inherit").length,
      openIncidents: Number(incidents.rows[0]?.total ?? 0),
      openTickets: Number(tickets.rows[0]?.total ?? 0),
      knowledgeArticles: Number(knowledge.rows[0]?.total ?? 0)
    },
    events: events.rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }))
  };
}
