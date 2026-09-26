/**
 * Schema do Wumpus 2.0.
 *
 * Regras de desenho:
 * - A configuracao vive no GRUPO. O servidor herda, desativa ou sobrescreve
 *   um modulo individualmente (tabela server_module_exceptions).
 * - module_configs usa (scope, scope_id): scope = 'group' aponta para o id do
 *   grupo, scope = 'server' aponta para o guild_id de um servidor sem grupo.
 *   Assim o mesmo codigo resolve os dois casos.
 * - IDs do Discord sao snowflakes: ficam como text, nunca como bigint.
 * - Nada de conteudo de mensagem em massa: guardamos eventos e metadados.
 */

export const SCHEMA_SQL = /* sql */ `
-- ---------------------------------------------------------------- pessoas
create table if not exists users (
  id           text primary key,
  username     text not null,
  global_name  text,
  avatar       text,
  locale       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Sessao do dashboard. O access token do Discord NAO e persistido:
-- guardamos apenas o retrato dos servidores visiveis no momento do login.
create table if not exists sessions (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  guilds      jsonb not null default '[]'::jsonb,
  user_agent  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_user_idx on sessions (user_id);

-- Quem pode entrar na dashboard. Sem linha aqui, o usuario nao acessa nada.
-- O Discord autentica a identidade; esta tabela decide a AUTORIZACAO.
create table if not exists dashboard_members (
  user_id      text primary key,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  note         text,
  added_by     text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- ---------------------------------------------------------------- servidores
create table if not exists guilds (
  guild_id         text primary key,
  name             text not null,
  icon_url         text,
  owner_id         text,
  member_count     integer,
  bot_permissions  text,
  installed_at     timestamptz not null default now(),
  last_synced_at   timestamptz not null default now(),
  is_active        boolean not null default true
);

create table if not exists guild_snapshots (
  guild_id    text not null,
  roles       jsonb not null default '[]'::jsonb,
  channels    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (guild_id)
);

-- ---------------------------------------------------------------- grupos
create table if not exists groups (
  id           bigserial primary key,
  owner_id     text not null,
  name         text not null,
  description  text not null default '',
  color        text not null default '#7c5cff',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner_id, name)
);

-- Um servidor pertence a no maximo um grupo (primary key no guild_id).
create table if not exists group_servers (
  guild_id   text primary key references guilds(guild_id) on delete cascade,
  group_id   bigint not null references groups(id) on delete cascade,
  added_at   timestamptz not null default now()
);
create index if not exists group_servers_group_idx on group_servers (group_id);

-- ---------------------------------------------------------------- configuracao
create table if not exists module_configs (
  scope       text not null check (scope in ('group', 'server')),
  scope_id    text not null,
  module      text not null,
  enabled     boolean not null default true,
  config      jsonb not null default '{}'::jsonb,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (scope, scope_id, module)
);

-- Excecoes por servidor: os tres modos do produto.
--   inherit  -> segue o grupo
--   disabled -> modulo pausado somente neste servidor
--   override -> configuracao exclusiva deste servidor
create table if not exists server_module_exceptions (
  guild_id    text not null,
  module      text not null,
  mode        text not null check (mode in ('inherit', 'disabled', 'override')),
  enabled     boolean not null default true,
  config      jsonb not null default '{}'::jsonb,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (guild_id, module)
);

-- ---------------------------------------------------------------- publicacoes
create table if not exists publications (
  id            bigserial primary key,
  guild_id      text not null,
  channel_id    text not null,
  module        text not null,
  format        text not null check (format in ('components_v2', 'embed')),
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  message_id    text,
  error         text,
  created_by    text not null,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index if not exists publications_status_idx on publications (status, created_at);

-- ---------------------------------------------------------------- atendimento
create table if not exists ticket_departments (
  id              bigserial primary key,
  guild_id        text not null,
  name            text not null,
  description     text not null default '',
  emoji           text not null default '',
  category_id     text,
  staff_role_ids  text[] not null default '{}',
  position        integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ticket_departments_guild_idx on ticket_departments (guild_id, position);

create table if not exists tickets (
  id           bigserial primary key,
  guild_id     text not null,
  channel_id   text,
  opener_id    text not null,
  department   text,
  subject      text not null default '',
  status       text not null default 'open' check (status in ('open', 'claimed', 'closed')),
  claimed_by   text,
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  log_channel_id   text,
  log_message_id   text,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create index if not exists tickets_guild_status_idx on tickets (guild_id, status, created_at desc);
create index if not exists tickets_channel_idx on tickets (channel_id);
create index if not exists tickets_opener_idx on tickets (opener_id, status);

create table if not exists ticket_events (
  id          bigserial primary key,
  ticket_id   bigint not null references tickets(id) on delete cascade,
  event_type  text not null,
  actor_id    text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ticket_events_ticket_idx on ticket_events (ticket_id, created_at);

-- Transcricao: conteudo fica aqui, nao em tabela de estatistica.
create table if not exists ticket_messages (
  id           bigserial primary key,
  ticket_id    bigint not null references tickets(id) on delete cascade,
  author_id    text not null,
  author_name  text,
  content      text not null default '',
  attachments  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on ticket_messages (ticket_id, created_at);

create table if not exists ticket_feedback (
  ticket_id   bigint primary key references tickets(id) on delete cascade,
  guild_id    text not null,
  score       smallint not null check (score between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);
create index if not exists ticket_feedback_guild_idx on ticket_feedback (guild_id, created_at desc);

-- ---------------------------------------------------------------- formularios
create table if not exists forms (
  id                 bigserial primary key,
  guild_id           text not null,
  name               text not null,
  description        text not null default '',
  fields             jsonb not null default '[]'::jsonb,
  reviewer_role_ids  text[] not null default '{}',
  review_channel_id  text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists form_submissions (
  id           bigserial primary key,
  form_id      bigint not null references forms(id) on delete cascade,
  guild_id     text not null,
  user_id      text not null,
  answers      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  text,
  review_note  text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

-- ---------------------------------------------------------------- logs e auditoria
create table if not exists audit_events (
  id           bigserial primary key,
  guild_id     text not null,
  module       text not null,
  event_type   text not null,
  actor_id     text,
  target_id    text,
  channel_id   text,
  severity     text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  data         jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);
create index if not exists audit_events_guild_idx on audit_events (guild_id, occurred_at desc);
create index if not exists audit_events_module_idx on audit_events (guild_id, module, occurred_at desc);

create table if not exists incidents (
  id             bigserial primary key,
  guild_id       text not null,
  incident_type  text not null check (incident_type in ('raid', 'nuke', 'automod', 'permission_risk')),
  severity       text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status         text not null default 'open' check (status in ('open', 'contained', 'dismissed')),
  actor_id       text,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index if not exists incidents_guild_idx on incidents (guild_id, status, created_at desc);

create table if not exists moderation_occurrences (
  id                bigserial primary key,
  guild_id          text not null,
  target_id         text not null,
  staff_id          text not null,
  requested_action  text not null check (requested_action in ('warn', 'timeout', 'kick', 'ban')),
  applied_action    text,
  reason            text not null default '',
  evidence          jsonb not null default '[]'::jsonb,
  strike_number     integer not null default 1,
  timeout_minutes   integer,
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'processing', 'applied', 'failed')),
  reviewed_by       text,
  review_note       text,
  reviewed_at       timestamptz,
  applied_at        timestamptz,
  error             text,
  created_at        timestamptz not null default now()
);
create index if not exists occurrences_guild_idx on moderation_occurrences (guild_id, status, created_at desc);

-- ---------------------------------------------------------------- inteligencia
create table if not exists knowledge_articles (
  id          bigserial primary key,
  guild_id    text not null,
  title       text not null,
  body        text not null,
  tags        text[] not null default '{}',
  status      text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists knowledge_guild_idx on knowledge_articles (guild_id, status);

-- Rascunhos de cargo gerados por IA: sempre revisados por humano antes de aplicar.
create table if not exists role_drafts (
  id           bigserial primary key,
  guild_id     text not null,
  created_by   text not null,
  request      text not null,
  draft        jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending', 'applied', 'rejected', 'failed')),
  reviewed_by  text,
  error        text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

-- Apoio interno da staff: a IA analisa o contexto do ticket e sugere,
-- mas nunca responde nem executa acao no Discord.
create table if not exists ai_analyses (
  id            bigserial primary key,
  guild_id      text not null,
  ticket_id     bigint references tickets(id) on delete set null,
  requested_by  text not null,
  model         text,
  context       jsonb not null default '{}'::jsonb,
  analysis      text not null default '',
  suggestions   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists ai_analyses_ticket_idx on ai_analyses (ticket_id, created_at desc);

-- ---------------------------------------------------------------- operacao
create table if not exists service_health (
  service           text primary key,
  status            text not null default 'operational' check (status in ('operational', 'degraded', 'offline')),
  metadata          jsonb not null default '{}'::jsonb,
  last_heartbeat_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- licencas
create table if not exists licenses (
  id               bigserial primary key,
  discord_user_id  text not null,
  plan             text not null default 'standard' check (plan in ('starter', 'standard', 'professional', 'enterprise')),
  status           text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  max_servers      integer not null default 1,
  expires_at       timestamptz,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists licenses_user_idx on licenses (discord_user_id);
`;
