import pg from "pg";
import type { ModuleId } from "../../core/brand.js";
import { defaultsFor } from "../../core/module-defaults.js";
import { SCHEMA_SQL } from "./schema.js";
import { resolveConfigRefs } from "./channel-refs.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao esta configurada.");
  }
  pool ??= new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000 });
  return pool;
}

/** Aplica o schema. Idempotente: todo comando usa IF NOT EXISTS. */
export async function migrate(): Promise<void> {
  await getPool().query(SCHEMA_SQL);
}

export async function databaseHealthy(): Promise<boolean> {
  try {
    await getPool().query("select 1");
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}

/* ------------------------------------------------------------------ *
 * Heranca de configuracao
 * ------------------------------------------------------------------ */

export type ExceptionMode = "inherit" | "disabled" | "override";

export type ResolvedModuleConfig = {
  guildId: string;
  module: ModuleId;
  enabled: boolean;
  config: Record<string, unknown>;
  /** De onde veio o valor efetivo, para a dashboard rotular a origem. */
  source: "group" | "server" | "default";
  groupId: number | null;
  exceptionMode: ExceptionMode;
};

type ConfigRow = { enabled: boolean; config: Record<string, unknown> };
type ExceptionRow = { mode: ExceptionMode; enabled: boolean; config: Record<string, unknown> };

/**
 * Resolve o que o bot deve realmente executar em um servidor:
 * padrao do modulo  ->  config do grupo  ->  excecao do servidor.
 */
async function resolveModuleConfigBase(guildId: string, module: ModuleId): Promise<ResolvedModuleConfig> {
  const db = getPool();
  const defaults = defaultsFor(module);

  const membership = await db.query<{ groupId: string }>(
    `select group_id as "groupId" from group_servers where guild_id = $1`,
    [guildId]
  );

  // Servidor sem grupo: vale a configuracao individual, se existir.
  if (membership.rows.length === 0) {
    const saved = await db.query<ConfigRow>(
      `select enabled, config from module_configs
       where scope = 'server' and scope_id = $1 and module = $2`,
      [guildId, module]
    );
    const row = saved.rows[0];
    if (!row) {
      return { guildId, module, enabled: true, config: defaults, source: "default", groupId: null, exceptionMode: "inherit" };
    }
    return {
      guildId,
      module,
      enabled: row.enabled,
      config: { ...defaults, ...row.config },
      source: "server",
      groupId: null,
      exceptionMode: "inherit"
    };
  }

  const groupId = Number(membership.rows[0].groupId);
  const [groupConfig, exception] = await Promise.all([
    db.query<ConfigRow>(
      `select enabled, config from module_configs
       where scope = 'group' and scope_id = $1 and module = $2`,
      [String(groupId), module]
    ),
    db.query<ExceptionRow>(
      `select mode, enabled, config from server_module_exceptions
       where guild_id = $1 and module = $2`,
      [guildId, module]
    )
  ]);

  const groupRow = groupConfig.rows[0];
  const base = { ...defaults, ...(groupRow?.config ?? {}) };
  const baseEnabled = groupRow?.enabled ?? true;
  const exceptionRow = exception.rows[0];

  if (!exceptionRow) {
    return { guildId, module, enabled: baseEnabled, config: base, source: "group", groupId, exceptionMode: "inherit" };
  }

  if (exceptionRow.mode === "disabled") {
    return { guildId, module, enabled: false, config: base, source: "group", groupId, exceptionMode: "disabled" };
  }

  if (exceptionRow.mode === "override") {
    return {
      guildId,
      module,
      enabled: exceptionRow.enabled,
      config: { ...base, ...exceptionRow.config },
      source: "server",
      groupId,
      exceptionMode: "override"
    };
  }

  return { guildId, module, enabled: baseEnabled, config: base, source: "group", groupId, exceptionMode: "inherit" };
}

/**
 * Resolve a configuracao final do servidor, ja com nomes de canal traduzidos
 * para os IDs daquele servidor. O bot usa sempre esta funcao.
 *
 * A traducao acontece aqui, e nao na gravacao, por um motivo: o mesmo grupo
 * vale para varios servidores, e cada um tem os seus proprios IDs. Traduzir
 * no momento da leitura e o unico ponto em que o servidor certo e conhecido.
 */
export async function resolveModuleConfig(
  guildId: string,
  module: ModuleId
): Promise<ResolvedModuleConfig> {
  const resolved = await resolveModuleConfigBase(guildId, module);
  // Falha na traducao nao pode derrubar a configuracao: mantemos os nomes.
  const config = await resolveConfigRefs(guildId, module, resolved.config).catch(() => resolved.config);
  return { ...resolved, config };
}

/** Grava a configuracao do grupo (scope 'group') ou de um servidor sem grupo. */
export async function saveModuleConfig(input: {
  scope: "group" | "server";
  scopeId: string;
  module: ModuleId;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedBy: string;
}): Promise<void> {
  await getPool().query(
    `insert into module_configs (scope, scope_id, module, enabled, config, updated_by, updated_at)
     values ($1, $2, $3, $4, $5::jsonb, $6, now())
     on conflict (scope, scope_id, module) do update
       set enabled = excluded.enabled,
           config = excluded.config,
           updated_by = excluded.updated_by,
           updated_at = now()`,
    [input.scope, input.scopeId, input.module, input.enabled, JSON.stringify(input.config), input.updatedBy]
  );
}

/** Define a excecao de um modulo em um servidor especifico. */
export async function setServerException(input: {
  guildId: string;
  module: ModuleId;
  mode: ExceptionMode;
  enabled?: boolean;
  config?: Record<string, unknown>;
  updatedBy: string;
}): Promise<void> {
  await getPool().query(
    `insert into server_module_exceptions (guild_id, module, mode, enabled, config, updated_by, updated_at)
     values ($1, $2, $3, $4, $5::jsonb, $6, now())
     on conflict (guild_id, module) do update
       set mode = excluded.mode,
           enabled = excluded.enabled,
           config = excluded.config,
           updated_by = excluded.updated_by,
           updated_at = now()`,
    [
      input.guildId,
      input.module,
      input.mode,
      input.enabled ?? true,
      JSON.stringify(input.config ?? {}),
      input.updatedBy
    ]
  );
}

export async function listServerExceptions(guildId: string): Promise<Array<{ module: ModuleId; mode: ExceptionMode }>> {
  const result = await getPool().query<{ module: ModuleId; mode: ExceptionMode }>(
    `select module, mode from server_module_exceptions where guild_id = $1`,
    [guildId]
  );
  return result.rows;
}

/* ------------------------------------------------------------------ *
 * Servidores e grupos
 * ------------------------------------------------------------------ */

export type GuildRow = {
  guildId: string;
  name: string;
  iconUrl: string | null;
  ownerId: string | null;
  memberCount: number | null;
  botPermissions: string | null;
  isActive: boolean;
  lastSyncedAt: Date;
};

export async function upsertGuild(input: {
  guildId: string;
  name: string;
  iconUrl: string | null;
  ownerId: string | null;
  memberCount: number | null;
  botPermissions: string | null;
}): Promise<void> {
  await getPool().query(
    `insert into guilds (guild_id, name, icon_url, owner_id, member_count, bot_permissions, last_synced_at, is_active)
     values ($1, $2, $3, $4, $5, $6, now(), true)
     on conflict (guild_id) do update
       set name = excluded.name,
           icon_url = excluded.icon_url,
           owner_id = excluded.owner_id,
           member_count = excluded.member_count,
           bot_permissions = excluded.bot_permissions,
           last_synced_at = now(),
           is_active = true`,
    [input.guildId, input.name, input.iconUrl, input.ownerId, input.memberCount, input.botPermissions]
  );
}

export async function listInstalledGuilds(): Promise<GuildRow[]> {
  const result = await getPool().query<GuildRow>(
    `select guild_id as "guildId", name, icon_url as "iconUrl", owner_id as "ownerId",
            member_count as "memberCount", bot_permissions as "botPermissions",
            is_active as "isActive", last_synced_at as "lastSyncedAt"
     from guilds where is_active = true order by name`
  );
  return result.rows;
}

export type GroupRow = {
  id: number;
  ownerId: string;
  name: string;
  description: string;
  color: string;
  serverCount: number;
};

export async function listGroups(ownerId: string): Promise<GroupRow[]> {
  const result = await getPool().query<GroupRow>(
    `select g.id, g.owner_id as "ownerId", g.name, g.description, g.color,
            count(gs.guild_id)::integer as "serverCount"
     from groups g
     left join group_servers gs on gs.group_id = g.id
     where g.owner_id = $1
     group by g.id
     order by g.created_at`,
    [ownerId]
  );
  return result.rows;
}

export async function createGroup(input: {
  ownerId: string;
  name: string;
  description: string;
  color: string;
}): Promise<GroupRow> {
  const result = await getPool().query<GroupRow>(
    `insert into groups (owner_id, name, description, color)
     values ($1, $2, $3, $4)
     returning id, owner_id as "ownerId", name, description, color, 0::integer as "serverCount"`,
    [input.ownerId, input.name, input.description, input.color]
  );
  return result.rows[0];
}

export async function assignGuildToGroup(groupId: number, guildId: string): Promise<void> {
  await getPool().query(
    `insert into group_servers (guild_id, group_id) values ($1, $2)
     on conflict (guild_id) do update set group_id = excluded.group_id, added_at = now()`,
    [guildId, groupId]
  );
}

export async function removeGuildFromGroup(guildId: string): Promise<void> {
  await getPool().query(`delete from group_servers where guild_id = $1`, [guildId]);
}

/* ------------------------------------------------------------------ *
 * Logs e auditoria
 * ------------------------------------------------------------------ */

export async function recordAuditEvent(input: {
  guildId: string;
  module: string;
  eventType: string;
  actorId?: string | null;
  targetId?: string | null;
  channelId?: string | null;
  severity?: "info" | "warning" | "critical";
  data?: Record<string, unknown>;
}): Promise<void> {
  await getPool().query(
    `insert into audit_events (guild_id, module, event_type, actor_id, target_id, channel_id, severity, data)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      input.guildId,
      input.module,
      input.eventType,
      input.actorId ?? null,
      input.targetId ?? null,
      input.channelId ?? null,
      input.severity ?? "info",
      JSON.stringify(input.data ?? {})
    ]
  );
}

export async function listAuditEvents(guildId: string, limit = 50) {
  const result = await getPool().query(
    `select id, module, event_type as "eventType", actor_id as "actorId", target_id as "targetId",
            channel_id as "channelId", severity, data, occurred_at as "occurredAt"
     from audit_events where guild_id = $1 order by occurred_at desc limit $2`,
    [guildId, limit]
  );
  return result.rows;
}
