-- AI suggestion run log: tracks each "Gợi ý" session with its transaction window and state.
-- Status flow: pending → available (after categories applied) → done (after recategorize completes).
CREATE TABLE IF NOT EXISTS ai_suggestion_run (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  from_tx_id  INTEGER,           -- exclusive lower bound; NULL means from the very beginning
  up_to_tx_id INTEGER NOT NULL,  -- inclusive upper bound (MAX(id) at suggest time)
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'available', 'done')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ai_run_user ON ai_suggestion_run(user_id, status, id);
