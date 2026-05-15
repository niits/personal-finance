-- Track last-modified time on transactions so the AI feed can use a
-- time-based window that captures edits (category changes, note updates,
-- budget link changes) that the old ID-based window would have missed.

ALTER TABLE "transaction" ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_transaction_user_updated_at ON "transaction"(user_id, updated_at);

-- Extend ai_suggestion_run to record timestamp-based window bounds.
-- Old rows will have NULLs; code treats NULL from_updated_at as "from beginning".
ALTER TABLE ai_suggestion_run ADD COLUMN from_updated_at  INTEGER;
ALTER TABLE ai_suggestion_run ADD COLUMN up_to_updated_at INTEGER;
