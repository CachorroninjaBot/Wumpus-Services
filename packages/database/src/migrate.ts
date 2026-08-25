import { requiredEnv } from "@huborder/core";
import { createDatabase } from "./index.js";

const migration = `
  CREATE TABLE IF NOT EXISTS service_status (
    service TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('operational', 'degraded', 'offline')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT UNIQUE,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('bot', 'server', 'website', 'wumpus', 'other')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS support_tickets_user_status_idx
    ON support_tickets (user_id, status);

  -- These additions are intentionally idempotent because existing installations
  -- may already have created the original ticket table.
  ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS intake JSONB NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS log_channel_id TEXT;
  ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS log_message_id TEXT;
  ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS transcript JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_score SMALLINT CHECK (feedback_score BETWEEN 1 AND 5);
  ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_comment TEXT;
  ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS huborder_panel_settings (
    guild_id TEXT PRIMARY KEY,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS huborder_publications (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('ticket_panel', 'message')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    message_id TEXT,
    error TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS huborder_publications_pending_idx ON huborder_publications (status, created_at);

  CREATE TABLE IF NOT EXISTS support_ticket_events (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS support_ticket_events_ticket_time_idx ON support_ticket_events (ticket_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS wumpus_guilds (
    guild_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT,
    owner_id TEXT NOT NULL,
    member_count INTEGER,
    bot_permissions TEXT NOT NULL DEFAULT '0',
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  );

  CREATE TABLE IF NOT EXISTS wumpus_module_configs (
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, module)
  );

  -- A Wumpus group represents one business/community unit. A server can belong
  -- to at most one group, starts ungrouped, and inherits the group configuration.
  CREATE TABLE IF NOT EXISTS wumpus_groups (
    id BIGSERIAL PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#8175FF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, name)
  );

  CREATE TABLE IF NOT EXISTS wumpus_group_servers (
    group_id BIGINT NOT NULL REFERENCES wumpus_groups(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL UNIQUE REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    exceptions JSONB NOT NULL DEFAULT '{}'::jsonb,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, guild_id)
  );
  CREATE INDEX IF NOT EXISTS wumpus_group_servers_group_idx ON wumpus_group_servers (group_id);

  CREATE TABLE IF NOT EXISTS wumpus_group_module_configs (
    group_id BIGINT NOT NULL REFERENCES wumpus_groups(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, module)
  );

  CREATE TABLE IF NOT EXISTS wumpus_events (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_id TEXT,
    target_id TEXT,
    channel_id TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS wumpus_events_guild_time_idx ON wumpus_events (guild_id, occurred_at DESC);

  CREATE TABLE IF NOT EXISTS wumpus_security_incidents (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('raid', 'nuke', 'automod', 'permission_risk')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'contained', 'dismissed')),
    actor_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS wumpus_incidents_guild_status_idx ON wumpus_security_incidents (guild_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS wumpus_cases (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    case_type TEXT NOT NULL CHECK (case_type IN ('moderation', 'report', 'appeal')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
    reporter_id TEXT,
    target_id TEXT,
    assigned_to TEXT,
    reason TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS wumpus_cases_guild_status_idx ON wumpus_cases (guild_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS wumpus_role_snapshots (
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT '0',
    managed BOOLEAN NOT NULL DEFAULT FALSE,
    mentionable BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, role_id)
  );

  -- Brand migration: keep data created before the product was renamed to Wumpus.
  -- These are the only intentional references to the retired table prefix.
  DO $$
  BEGIN
    IF to_regclass('public.wumply_role_drafts') IS NOT NULL
       AND to_regclass('public.wumpus_role_drafts') IS NULL THEN
      ALTER TABLE wumply_role_drafts RENAME TO wumpus_role_drafts;
    END IF;
    IF to_regclass('public.wumply_ticket_departments') IS NOT NULL
       AND to_regclass('public.wumpus_ticket_departments') IS NULL THEN
      ALTER TABLE wumply_ticket_departments RENAME TO wumpus_ticket_departments;
    END IF;
    IF to_regclass('public.wumply_licenses') IS NOT NULL
       AND to_regclass('public.wumpus_licenses') IS NULL THEN
      ALTER TABLE wumply_licenses RENAME TO wumpus_licenses;
    END IF;
    IF to_regclass('public.wumply_occurrences') IS NOT NULL
       AND to_regclass('public.wumpus_occurrences') IS NULL THEN
      ALTER TABLE wumply_occurrences RENAME TO wumpus_occurrences;
    END IF;
  END $$;

  DROP INDEX IF EXISTS wumply_ticket_departments_guild_idx;
  DROP INDEX IF EXISTS wumply_licenses_status_idx;
  DROP INDEX IF EXISTS wumply_occurrences_guild_status_idx;
  DROP INDEX IF EXISTS wumply_occurrences_target_idx;

  CREATE TABLE IF NOT EXISTS wumpus_role_drafts (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,
    request TEXT NOT NULL,
    draft JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'failed')),
    reviewed_by TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS wumpus_channel_snapshots (
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type INTEGER NOT NULL,
    parent_id TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS wumpus_panel_publications (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    module TEXT NOT NULL CHECK (module IN ('tickets', 'forms')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
    message_id TEXT,
    error TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS wumpus_panel_publications_pending_idx ON wumpus_panel_publications (status, created_at);

  CREATE TABLE IF NOT EXISTS wumpus_daily_metrics (
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    day DATE NOT NULL,
    joins INTEGER NOT NULL DEFAULT 0,
    leaves INTEGER NOT NULL DEFAULT 0,
    messages INTEGER NOT NULL DEFAULT 0,
    moderation_actions INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, day)
  );

  CREATE TABLE IF NOT EXISTS wumpus_ticket_panels (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    name TEXT NOT NULL,
    departments JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS wumpus_tickets (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    panel_id BIGINT REFERENCES wumpus_ticket_panels(id) ON DELETE SET NULL,
    channel_id TEXT UNIQUE,
    opener_id TEXT NOT NULL,
    department TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'closed')),
    claimed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS wumpus_ticket_departments (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '💬',
    category_id TEXT,
    staff_role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (guild_id, name)
  );
  CREATE INDEX IF NOT EXISTS wumpus_ticket_departments_guild_idx ON wumpus_ticket_departments (guild_id, position, name);

  CREATE TABLE IF NOT EXISTS wumpus_dashboard_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    global_name TEXT,
    avatar TEXT,
    guilds JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS wumpus_dashboard_sessions_expiry_idx
    ON wumpus_dashboard_sessions (expires_at);

  CREATE TABLE IF NOT EXISTS wumpus_licenses (
    id BIGSERIAL PRIMARY KEY,
    discord_user_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'standard' CHECK (plan IN ('starter', 'standard', 'professional', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    max_servers INTEGER NOT NULL DEFAULT 1 CHECK (max_servers BETWEEN 1 AND 1000),
    expires_at TIMESTAMPTZ,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS wumpus_licenses_status_idx ON wumpus_licenses (status, expires_at);

  CREATE TABLE IF NOT EXISTS wumpus_occurrences (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    target_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    requested_action TEXT NOT NULL CHECK (requested_action IN ('warn', 'timeout', 'kick', 'ban')),
    applied_action TEXT,
    reason TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    strike_number INTEGER NOT NULL CHECK (strike_number > 0),
    timeout_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'applied', 'failed')),
    reviewed_by TEXT,
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS wumpus_occurrences_guild_status_idx ON wumpus_occurrences (guild_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS wumpus_occurrences_target_idx ON wumpus_occurrences (guild_id, target_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS wumpus_forms (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    reviewer_role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS wumpus_form_submissions (
    id BIGSERIAL PRIMARY KEY,
    form_id BIGINT NOT NULL REFERENCES wumpus_forms(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    submitter_id TEXT NOT NULL,
    answers JSONB NOT NULL,
    ai_summary JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS wumpus_automations (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger JSONB NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS wumpus_webhooks (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    secret_hash TEXT,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS wumpus_knowledge_articles (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES wumpus_guilds(guild_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (guild_id, slug)
  );
  CREATE INDEX IF NOT EXISTS wumpus_knowledge_search_idx ON wumpus_knowledge_articles (guild_id, status, updated_at DESC);
`;

const database = createDatabase(requiredEnv("DATABASE_URL"));

try {
  await database.pool.query(migration);
  console.log("HubOrder database migrations completed.");
} finally {
  await database.close();
}
