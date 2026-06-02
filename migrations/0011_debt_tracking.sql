-- Debt tracking: lending/borrowing relationships and their repayment history.
-- Repayments are stored as regular transactions with debt_id set, so this
-- migration is two steps: create the debt table first, then add the FK column.

CREATE TABLE IF NOT EXISTS debt (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('lend', 'borrow')),
  party      TEXT NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Nullable FK on transaction — existing rows unaffected (expand step).
ALTER TABLE "transaction" ADD COLUMN debt_id TEXT REFERENCES debt(id) ON DELETE SET NULL;
