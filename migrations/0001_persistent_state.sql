CREATE TABLE IF NOT EXISTS wumpus_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wumpus_legacy_imports (
  source_path TEXT PRIMARY KEY,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count INTEGER NOT NULL DEFAULT 0
);
