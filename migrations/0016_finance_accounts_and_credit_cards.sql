-- Explicit transaction classification preserves legacy debt rows while making
-- new debt/savings categories non-budgetable and immutable.
ALTER TABLE category ADD COLUMN system_kind TEXT;
ALTER TABLE category ADD COLUMN budget_behavior TEXT NOT NULL DEFAULT 'consumption'
  CHECK (budget_behavior IN ('consumption', 'non_budget'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_system_kind
  ON category(user_id, system_kind) WHERE system_kind IS NOT NULL;

CREATE TABLE IF NOT EXISTS finance_account (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('debt', 'savings')),
  name TEXT NOT NULL,
  debt_direction TEXT CHECK (debt_direction IN ('lend', 'borrow')),
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK ((type = 'debt' AND debt_direction IS NOT NULL) OR (type = 'savings' AND debt_direction IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_finance_account_user ON finance_account(user_id, type);

ALTER TABLE "transaction" ADD COLUMN finance_account_id TEXT
  REFERENCES finance_account(id) ON DELETE SET NULL;
ALTER TABLE "transaction" ADD COLUMN credit_card_id TEXT;
CREATE INDEX IF NOT EXISTS idx_transaction_finance_account ON "transaction"(finance_account_id);

CREATE TABLE IF NOT EXISTS credit_card_group (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  statement_close_day INTEGER NOT NULL CHECK (statement_close_day BETWEEN 1 AND 31),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS credit_card (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES credit_card_group(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_credit_card_user_group ON credit_card(user_id, group_id);

CREATE TABLE IF NOT EXISTS credit_card_statement (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES credit_card_group(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_at TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(group_id, period_start),
  CHECK ((status = 'unpaid' AND paid_at IS NULL) OR (status = 'paid' AND paid_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_card_statement_user_group_period
  ON credit_card_statement(user_id, group_id, period_start, period_end);

-- FK is intentionally added after the card table exists. Existing transactions
-- have NULL and therefore retain their historical behavior.
CREATE INDEX IF NOT EXISTS idx_transaction_credit_card ON "transaction"(credit_card_id);
