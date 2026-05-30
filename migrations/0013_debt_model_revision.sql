-- Revise debt table:
--   • remove `amount` (principal now derived from opening_transaction.amount)
--   • add `opening_transaction_id` FK so debt knows which transaction started it
--   • add `due_date` for overdue tracking
--
-- SQLite requires full table recreation to drop a column.

PRAGMA foreign_keys = OFF;

CREATE TABLE debt_new (
  id                     TEXT    PRIMARY KEY,
  user_id                TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  type                   TEXT    NOT NULL CHECK (type IN ('lend', 'borrow')),
  party                  TEXT    NOT NULL,
  note                   TEXT,
  due_date               TEXT,
  status                 TEXT    NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open', 'settled')),
  opening_transaction_id INTEGER REFERENCES "transaction"(id) ON DELETE SET NULL,
  created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Migrate existing rows. opening_transaction_id starts NULL for pre-existing
-- debts — the opening transaction link is lost because the old schema had no
-- way to identify which transaction was the opener vs. a repayment.
-- New debts created after this migration will always have the FK set.
INSERT INTO debt_new (id, user_id, type, party, note, status, created_at)
  SELECT id, user_id, type, party, note, status, created_at FROM debt;

DROP TABLE debt;
ALTER TABLE debt_new RENAME TO debt;

PRAGMA foreign_keys = ON;
