-- Overdraft accounts: a bank borrowing account (type 'debt', direction 'borrow')
-- that consumption expenses can be paid from. Paying by overdraft increases the
-- amount owed on that account; repayments reduce it.

ALTER TABLE finance_account ADD COLUMN is_overdraft INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "transaction" ADD COLUMN overdraft_account_id TEXT
  REFERENCES finance_account(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_overdraft_account ON "transaction"(overdraft_account_id);

-- Recreate the per-account balance guards from 0022 so an account's balance also
-- includes purchases paid from it (overdraft_account_id). For accounts without
-- overdraft purchases the formula is unchanged:
--   available = direction * SUM(income - expense over finance_account_id)
--             + SUM(amount over overdraft_account_id)
-- A write may not push available below MIN(0, available).
DROP TRIGGER IF EXISTS finance_balance_insert;
DROP TRIGGER IF EXISTS finance_balance_update;
DROP TRIGGER IF EXISTS finance_balance_delete;

CREATE TRIGGER finance_balance_insert
BEFORE INSERT ON "transaction"
BEGIN
  SELECT RAISE(ABORT, 'FINANCE_BALANCE_EXCEEDED')
  FROM (
    SELECT a.id, a.user_id,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END AS direction,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END
        * (SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
           FROM "transaction" AS t WHERE t.finance_account_id = a.id AND t.user_id = a.user_id)
        + (SELECT COALESCE(SUM(t.amount), 0)
           FROM "transaction" AS t WHERE t.overdraft_account_id = a.id AND t.user_id = a.user_id) AS available
    FROM finance_account AS a
    WHERE a.user_id = NEW.user_id AND a.id IN (NEW.finance_account_id, NEW.overdraft_account_id)
  )
  WHERE available
    + CASE WHEN id = NEW.finance_account_id THEN direction * CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END ELSE 0 END
    + CASE WHEN id = NEW.overdraft_account_id THEN NEW.amount ELSE 0 END
    < MIN(0, available);
END;

CREATE TRIGGER finance_balance_update
BEFORE UPDATE OF amount, type, finance_account_id, overdraft_account_id, user_id ON "transaction"
BEGIN
  SELECT RAISE(ABORT, 'FINANCE_BALANCE_EXCEEDED')
  FROM (
    SELECT a.id, a.user_id,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END AS direction,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END
        * (SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
           FROM "transaction" AS t WHERE t.finance_account_id = a.id AND t.user_id = a.user_id)
        + (SELECT COALESCE(SUM(t.amount), 0)
           FROM "transaction" AS t WHERE t.overdraft_account_id = a.id AND t.user_id = a.user_id) AS available
    FROM finance_account AS a
    WHERE (a.user_id = OLD.user_id AND a.id IN (OLD.finance_account_id, OLD.overdraft_account_id))
       OR (a.user_id = NEW.user_id AND a.id IN (NEW.finance_account_id, NEW.overdraft_account_id))
  )
  WHERE available
    - CASE WHEN id = OLD.finance_account_id AND user_id = OLD.user_id THEN direction * CASE WHEN OLD.type = 'income' THEN OLD.amount ELSE -OLD.amount END ELSE 0 END
    - CASE WHEN id = OLD.overdraft_account_id AND user_id = OLD.user_id THEN OLD.amount ELSE 0 END
    + CASE WHEN id = NEW.finance_account_id AND user_id = NEW.user_id THEN direction * CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END ELSE 0 END
    + CASE WHEN id = NEW.overdraft_account_id AND user_id = NEW.user_id THEN NEW.amount ELSE 0 END
    < MIN(0, available);
END;

CREATE TRIGGER finance_balance_delete
BEFORE DELETE ON "transaction"
BEGIN
  SELECT RAISE(ABORT, 'FINANCE_BALANCE_EXCEEDED')
  FROM (
    SELECT a.id, a.user_id,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END AS direction,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END
        * (SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
           FROM "transaction" AS t WHERE t.finance_account_id = a.id AND t.user_id = a.user_id)
        + (SELECT COALESCE(SUM(t.amount), 0)
           FROM "transaction" AS t WHERE t.overdraft_account_id = a.id AND t.user_id = a.user_id) AS available
    FROM finance_account AS a
    WHERE a.user_id = OLD.user_id AND a.id IN (OLD.finance_account_id, OLD.overdraft_account_id)
  )
  WHERE available
    - CASE WHEN id = OLD.finance_account_id THEN direction * CASE WHEN OLD.type = 'income' THEN OLD.amount ELSE -OLD.amount END ELSE 0 END
    - CASE WHEN id = OLD.overdraft_account_id THEN OLD.amount ELSE 0 END
    < MIN(0, available);
END;
