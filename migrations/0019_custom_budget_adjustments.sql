CREATE TABLE IF NOT EXISTS custom_budget_adjustment (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  custom_budget_id INTEGER NOT NULL REFERENCES custom_budget(id) ON DELETE CASCADE,
  previous_amount  INTEGER NOT NULL CHECK (previous_amount > 0),
  new_amount       INTEGER NOT NULL CHECK (new_amount > 0),
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_custom_budget_adjustment_budget
  ON custom_budget_adjustment(custom_budget_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_custom_budget_amount_adjustment
AFTER UPDATE OF amount ON custom_budget
WHEN OLD.amount <> NEW.amount
BEGIN
  INSERT INTO custom_budget_adjustment (custom_budget_id, previous_amount, new_amount)
  VALUES (NEW.id, OLD.amount, NEW.amount);
END;
