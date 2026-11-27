CREATE TABLE IF NOT EXISTS wumpus_outbox (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  job JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wumpus_outbox_pending_idx
  ON wumpus_outbox (guild_id, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS wumpus_outbox_guild_idx
  ON wumpus_outbox (guild_id, created_at DESC);

-- Move a fila que vivia dentro do JSONB de runtime para a tabela dedicada.
INSERT INTO wumpus_outbox (id, guild_id, job, status, created_at)
SELECT
  job->>'id',
  job->>'guildId',
  job,
  CASE WHEN job->>'status' IN ('queued', 'done', 'failed') THEN job->>'status' ELSE 'queued' END,
  to_timestamp(
    CASE WHEN job->>'createdAt' ~ '^[0-9]+$' THEN (job->>'createdAt')::bigint ELSE 0 END / 1000.0
  )
FROM wumpus_state,
  jsonb_array_elements(
    CASE WHEN jsonb_typeof(value->'outbox') = 'array' THEN value->'outbox' ELSE '[]'::jsonb END
  ) AS job
WHERE key = 'runtime'
  AND job->>'id' IS NOT NULL
  AND job->>'guildId' IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE wumpus_state
SET value = jsonb_set(value, '{outbox}', '[]'::jsonb)
WHERE key = 'runtime' AND jsonb_typeof(value->'outbox') = 'array';
