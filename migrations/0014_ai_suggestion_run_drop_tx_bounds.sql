-- Contract step of the expand/contract started in 0007: the AI feed switched to
-- timestamp-based window bounds (from_updated_at / up_to_updated_at), but the old
-- ID-based bounds from 0006 stayed behind. up_to_tx_id is NOT NULL with no default,
-- so every INSERT from the current code (which only writes the *_updated_at columns)
-- fails with a NOT NULL constraint error.
--
-- No code reads from_tx_id / up_to_tx_id anymore, so drop them. SQLite requires a
-- full table recreation to remove columns / constraints (see 0012 for the pattern).

PRAGMA foreign_keys = OFF;

CREATE TABLE ai_suggestion_run_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  from_updated_at  INTEGER,           -- exclusive lower bound; NULL means from the very beginning
  up_to_updated_at INTEGER,           -- inclusive upper bound (MAX(updated_at) at suggest time)
  status           TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'available', 'done')),
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO ai_suggestion_run_new (id, user_id, from_updated_at, up_to_updated_at, status, created_at)
  SELECT id, user_id, from_updated_at, up_to_updated_at, status, created_at
  FROM ai_suggestion_run;

DROP TABLE ai_suggestion_run;
ALTER TABLE ai_suggestion_run_new RENAME TO ai_suggestion_run;

CREATE INDEX IF NOT EXISTS idx_ai_run_user ON ai_suggestion_run(user_id, status, id);

PRAGMA foreign_keys = ON;
