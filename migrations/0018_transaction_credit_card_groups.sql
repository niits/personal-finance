-- Purchases belong to a statement group, not to an individual physical card.
PRAGMA foreign_keys = OFF;

CREATE TABLE "transaction_new" (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  amount                INTEGER NOT NULL CHECK (amount > 0),
  type                  TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  category_id           INTEGER REFERENCES category(id) ON DELETE RESTRICT,
  note                  TEXT,
  emoji                 TEXT,
  date                  TEXT NOT NULL,
  monthly_budget_id     INTEGER REFERENCES monthly_budget(id) ON DELETE RESTRICT,
  debt_id               TEXT REFERENCES debt(id) ON DELETE SET NULL,
  linked_amount         INTEGER,
  finance_account_id    TEXT REFERENCES finance_account(id) ON DELETE SET NULL,
  credit_card_group_id  TEXT REFERENCES credit_card_group(id) ON DELETE SET NULL,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (type = 'income' OR monthly_budget_id IS NOT NULL OR debt_id IS NOT NULL OR finance_account_id IS NOT NULL)
);

INSERT INTO "transaction_new" (id, user_id, amount, type, category_id, note, emoji, date, monthly_budget_id, debt_id, linked_amount, finance_account_id, credit_card_group_id, created_at, updated_at)
  SELECT t.id, t.user_id, t.amount, t.type, t.category_id, t.note, t.emoji, t.date, t.monthly_budget_id, t.debt_id, t.linked_amount, t.finance_account_id,
    (SELECT c.group_id FROM credit_card AS c WHERE c.id = t.credit_card_id), t.created_at, t.updated_at
  FROM "transaction" AS t;

DROP TABLE "transaction";
ALTER TABLE "transaction_new" RENAME TO "transaction";
CREATE INDEX IF NOT EXISTS idx_transaction_user_date ON "transaction"(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transaction_user_category ON "transaction"(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_monthly_budget ON "transaction"(monthly_budget_id);
CREATE INDEX IF NOT EXISTS idx_transaction_debt ON "transaction"(debt_id);
CREATE INDEX IF NOT EXISTS idx_transaction_finance_account ON "transaction"(finance_account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_credit_card_group ON "transaction"(credit_card_group_id);
PRAGMA foreign_keys = ON;
