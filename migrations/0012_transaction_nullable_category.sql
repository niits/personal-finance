-- Make category_id nullable and relax the monthly_budget_id CHECK constraint
-- so debt transactions (no category, no budget) can be stored in the same table.
--
-- New CHECK rule: expense transactions must have a budget OR be a debt entry.
-- income transactions never have a budget (unchanged).
--
-- SQLite requires a full table recreation to change column constraints.

PRAGMA foreign_keys = OFF;

CREATE TABLE "transaction_new" (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL CHECK (amount > 0),
  type              TEXT    NOT NULL CHECK (type IN ('expense', 'income')),
  category_id       INTEGER REFERENCES category(id) ON DELETE RESTRICT,
  note              TEXT,
  emoji             TEXT,
  date              TEXT    NOT NULL,
  monthly_budget_id INTEGER REFERENCES monthly_budget(id) ON DELETE RESTRICT,
  debt_id           TEXT    REFERENCES debt(id) ON DELETE SET NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (
    (type = 'income') OR
    (type = 'expense' AND (monthly_budget_id IS NOT NULL OR debt_id IS NOT NULL))
  )
);

INSERT INTO "transaction_new"
  SELECT id, user_id, amount, type, category_id, note, emoji, date,
         monthly_budget_id, debt_id, created_at, updated_at
  FROM "transaction";

DROP TABLE "transaction";
ALTER TABLE "transaction_new" RENAME TO "transaction";

CREATE INDEX IF NOT EXISTS idx_transaction_user_date      ON "transaction"(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transaction_user_category  ON "transaction"(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_monthly_budget ON "transaction"(monthly_budget_id);
CREATE INDEX IF NOT EXISTS idx_transaction_debt           ON "transaction"(debt_id);

PRAGMA foreign_keys = ON;
