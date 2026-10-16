-- Enforce per-account remaining balances within each transaction write.
-- Existing reverse balances may be corrected but may not become more negative.

CREATE TRIGGER finance_balance_insert
BEFORE INSERT ON "transaction"
BEGIN
  SELECT RAISE(ABORT, 'FINANCE_BALANCE_EXCEEDED')
  FROM (
    SELECT a.id, a.user_id,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END AS direction,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END
        * COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS available
    FROM finance_account AS a
    LEFT JOIN "transaction" AS t ON t.finance_account_id = a.id AND t.user_id = a.user_id
    WHERE a.id = NEW.finance_account_id AND a.user_id = NEW.user_id
    GROUP BY a.id, a.user_id
  )
  WHERE available + CASE WHEN id = NEW.finance_account_id AND user_id = NEW.user_id
          THEN direction * CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END
          ELSE 0 END < MIN(0, available);
END;

CREATE TRIGGER finance_balance_update
BEFORE UPDATE OF amount, type, finance_account_id, user_id ON "transaction"
BEGIN
  SELECT RAISE(ABORT, 'FINANCE_BALANCE_EXCEEDED')
  FROM (
    SELECT a.id, a.user_id,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END AS direction,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END
        * COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS available
    FROM finance_account AS a
    LEFT JOIN "transaction" AS t ON t.finance_account_id = a.id AND t.user_id = a.user_id
    WHERE (a.id = OLD.finance_account_id AND a.user_id = OLD.user_id)
       OR (a.id = NEW.finance_account_id AND a.user_id = NEW.user_id)
    GROUP BY a.id, a.user_id
  )
  WHERE available - CASE WHEN id = OLD.finance_account_id AND user_id = OLD.user_id
          THEN direction * CASE WHEN OLD.type = 'income' THEN OLD.amount ELSE -OLD.amount END
          ELSE 0 END + CASE WHEN id = NEW.finance_account_id AND user_id = NEW.user_id
          THEN direction * CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END
          ELSE 0 END < MIN(0, available);
END;

CREATE TRIGGER finance_balance_delete
BEFORE DELETE ON "transaction"
BEGIN
  SELECT RAISE(ABORT, 'FINANCE_BALANCE_EXCEEDED')
  FROM (
    SELECT a.id, a.user_id,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END AS direction,
      CASE WHEN a.type = 'debt' AND a.debt_direction = 'borrow' THEN 1 ELSE -1 END
        * COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS available
    FROM finance_account AS a
    LEFT JOIN "transaction" AS t ON t.finance_account_id = a.id AND t.user_id = a.user_id
    WHERE a.id = OLD.finance_account_id AND a.user_id = OLD.user_id
    GROUP BY a.id, a.user_id
  )
  WHERE available - CASE WHEN id = OLD.finance_account_id AND user_id = OLD.user_id
          THEN direction * CASE WHEN OLD.type = 'income' THEN OLD.amount ELSE -OLD.amount END
          ELSE 0 END < MIN(0, available);
END;
