CREATE TABLE IF NOT EXISTS statistics_report (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT    NOT NULL,
  period_type  TEXT    NOT NULL CHECK (period_type IN ('monthly')),
  period_key   TEXT    NOT NULL,
  insights     TEXT    NOT NULL DEFAULT '[]',
  is_dirty     INTEGER NOT NULL DEFAULT 0 CHECK (is_dirty IN (0, 1)),
  generated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_stats_report_user ON statistics_report (user_id, period_type, period_key);
