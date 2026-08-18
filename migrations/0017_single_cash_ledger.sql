-- Additive single-cash position ledger. Legacy finance tables remain untouched.
-- Real calendar validation, semantic position-action compatibility, and deterministic
-- incremental refund apportionment remain service boundaries; SQLite validates date
-- shape/future bounds, the persisted bundle, and all concurrency invariants.

CREATE UNIQUE INDEX ux_category_id_user ON category(id, user_id);
--> statement-breakpoint

CREATE TABLE financial_write_request (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result_resource_id TEXT,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, idempotency_key)
);
--> statement-breakpoint

CREATE TABLE financial_profile (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  ledger_start_date TEXT NOT NULL,
  minimum_cash_reserve INTEGER NOT NULL DEFAULT 0 CHECK (minimum_cash_reserve >= 0),
  initialized_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (length(ledger_start_date) = 10 AND ledger_start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint

CREATE TABLE financial_profile_adjustment (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target = 'minimum_cash_reserve'),
  delta INTEGER NOT NULL CHECK (delta != 0),
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  write_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (user_id, write_key) REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE financial_position (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('term_deposit','personal_receivable','credit_card','personal_payable')),
  counterparty TEXT,
  due_date TEXT,
  reserve_against_cash INTEGER NOT NULL CHECK (reserve_against_cash IN (0,1)),
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  CHECK (due_date IS NULL OR (length(due_date) = 10 AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'))
);
--> statement-breakpoint
CREATE INDEX idx_financial_position_user_kind ON financial_position(user_id, kind);
--> statement-breakpoint

CREATE TABLE budget_period (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  planned_income INTEGER NOT NULL CHECK (planned_income >= 0),
  savings_target INTEGER NOT NULL DEFAULT 0 CHECK (savings_target >= 0),
  spending_limit INTEGER NOT NULL CHECK (spending_limit >= 0),
  objective TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, label),
  UNIQUE (id, user_id),
  CHECK (length(start_date) = 10 AND start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (length(end_date) = 10 AND end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (start_date <= end_date),
  CHECK (spending_limit + savings_target <= planned_income)
);
--> statement-breakpoint

CREATE TABLE ledger_budget_adjustment (
  id TEXT NOT NULL PRIMARY KEY,
  budget_period_id INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('planned_income','savings_target','spending_limit')),
  delta INTEGER NOT NULL CHECK (delta != 0),
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  write_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (budget_period_id, user_id) REFERENCES budget_period(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, write_key) REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE ledger_custom_budget (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  budget_period_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  amount INTEGER NOT NULL CHECK (amount > 0),
  series_key TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (budget_period_id, user_id) REFERENCES budget_period(id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_ledger_custom_budget_period ON ledger_custom_budget(budget_period_id);
--> statement-breakpoint

CREATE TABLE ledger_custom_budget_adjustment (
  id TEXT NOT NULL PRIMARY KEY,
  custom_budget_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK (delta != 0),
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  write_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (custom_budget_id, user_id) REFERENCES ledger_custom_budget(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, write_key) REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE financial_event (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  write_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('opening_cash','opening_position','income_cash','expense_cash','expense_position','refund_cash','refund_position','cash_to_position','position_to_cash','cash_adjustment','position_adjustment','reversal')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  cash_delta INTEGER NOT NULL DEFAULT 0,
  position_id TEXT,
  position_delta INTEGER NOT NULL DEFAULT 0,
  income_delta INTEGER NOT NULL DEFAULT 0,
  expense_delta INTEGER NOT NULL DEFAULT 0,
  equity_delta INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER,
  budget_period_id INTEGER,
  related_event_id TEXT,
  refund_prior_total INTEGER,
  reversal_of_event_id TEXT,
  note TEXT,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (user_id, write_key) REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE CASCADE,
  FOREIGN KEY (position_id, user_id) REFERENCES financial_position(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id, user_id) REFERENCES category(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (budget_period_id, user_id) REFERENCES budget_period(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (related_event_id, user_id) REFERENCES financial_event(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (reversal_of_event_id, user_id) REFERENCES financial_event(id, user_id) ON DELETE CASCADE,
  CHECK (length(date) = 10 AND date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (cash_delta IN (-amount,0,amount)),
  CHECK (position_delta IN (-amount,0,amount)),
  CHECK (income_delta IN (-amount,0,amount)),
  CHECK (expense_delta IN (-amount,0,amount)),
  CHECK (equity_delta IN (-amount,0,amount)),
  CHECK (cash_delta + position_delta = equity_delta + income_delta - expense_delta),
  CHECK ((position_delta = 0 AND position_id IS NULL) OR (position_delta != 0 AND position_id IS NOT NULL)),
  CHECK (
    (kind='opening_cash' AND cash_delta=amount AND position_delta=0 AND income_delta=0 AND expense_delta=0 AND equity_delta=amount) OR
    (kind='opening_position' AND cash_delta=0 AND position_delta IN (-amount,amount) AND income_delta=0 AND expense_delta=0 AND equity_delta=position_delta) OR
    (kind='income_cash' AND cash_delta=amount AND position_delta=0 AND income_delta=amount AND expense_delta=0 AND equity_delta=0) OR
    (kind='expense_cash' AND cash_delta=-amount AND position_delta=0 AND income_delta=0 AND expense_delta=amount AND equity_delta=0) OR
    (kind='expense_position' AND cash_delta=0 AND position_delta=-amount AND income_delta=0 AND expense_delta=amount AND equity_delta=0) OR
    (kind='refund_cash' AND cash_delta=amount AND position_delta=0 AND income_delta=0 AND expense_delta=-amount AND equity_delta=0) OR
    (kind='refund_position' AND cash_delta=0 AND position_delta=amount AND income_delta=0 AND expense_delta=-amount AND equity_delta=0) OR
    (kind='cash_to_position' AND cash_delta=-amount AND position_delta=amount AND income_delta=0 AND expense_delta=0 AND equity_delta=0) OR
    (kind='position_to_cash' AND cash_delta=amount AND position_delta=-amount AND income_delta=0 AND expense_delta=0 AND equity_delta=0) OR
    (kind='cash_adjustment' AND cash_delta IN (-amount,amount) AND position_delta=0 AND income_delta=0 AND expense_delta=0 AND equity_delta=cash_delta) OR
    (kind='position_adjustment' AND cash_delta=0 AND position_delta IN (-amount,amount) AND income_delta=0 AND expense_delta=0 AND equity_delta=position_delta) OR kind='reversal'
  ),
  CHECK (((kind IN ('income_cash','expense_cash','expense_position','refund_cash','refund_position')) AND category_id IS NOT NULL) OR ((kind IN ('opening_cash','opening_position','cash_to_position','position_to_cash','cash_adjustment','position_adjustment')) AND category_id IS NULL) OR kind='reversal'),
  CHECK (((kind IN ('expense_cash','expense_position','refund_cash','refund_position')) AND budget_period_id IS NOT NULL) OR ((kind IN ('opening_cash','opening_position','income_cash','cash_to_position','position_to_cash','cash_adjustment','position_adjustment')) AND budget_period_id IS NULL) OR kind='reversal'),
  CHECK (((kind IN ('refund_cash','refund_position')) AND related_event_id IS NOT NULL) OR ((kind NOT IN ('refund_cash','refund_position')) AND related_event_id IS NULL)),
  CHECK (((kind IN ('refund_cash','refund_position')) AND refund_prior_total IS NOT NULL AND refund_prior_total>=0) OR ((kind NOT IN ('refund_cash','refund_position')) AND refund_prior_total IS NULL)),
  CHECK (kind NOT IN ('cash_adjustment','position_adjustment') OR (note IS NOT NULL AND length(trim(note)) > 0)),
  CHECK ((kind='reversal' AND reversal_of_event_id IS NOT NULL) OR (kind!='reversal' AND reversal_of_event_id IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX ux_financial_event_opening_cash ON financial_event(user_id) WHERE kind='opening_cash';
--> statement-breakpoint
CREATE UNIQUE INDEX ux_financial_event_opening_position ON financial_event(position_id) WHERE kind='opening_position';
--> statement-breakpoint
CREATE UNIQUE INDEX ux_financial_event_reversal ON financial_event(reversal_of_event_id) WHERE reversal_of_event_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX idx_financial_event_user_date ON financial_event(user_id,date);
--> statement-breakpoint
CREATE INDEX idx_financial_event_position_date ON financial_event(position_id,date);
--> statement-breakpoint

CREATE TABLE financial_event_custom_budget_allocation (
  financial_event_id TEXT NOT NULL,
  custom_budget_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  allocated_expense_delta INTEGER NOT NULL CHECK (allocated_expense_delta != 0),
  PRIMARY KEY (financial_event_id, custom_budget_id),
  FOREIGN KEY (financial_event_id, user_id) REFERENCES financial_event(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (custom_budget_id, user_id) REFERENCES ledger_custom_budget(id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE financial_event_commit (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  write_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (event_id, user_id) REFERENCES financial_event(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, write_key) REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE budget_period_lock (
  budget_period_id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  first_event_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (budget_period_id, user_id) REFERENCES budget_period(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (first_event_id, user_id) REFERENCES financial_event(id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE financial_position_closure (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL,
  settlement_event_id TEXT,
  write_key TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id,user_id),
  FOREIGN KEY (position_id,user_id) REFERENCES financial_position(id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (settlement_event_id,user_id) REFERENCES financial_event(id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id,write_key) REFERENCES financial_write_request(user_id,idempotency_key) ON DELETE CASCADE,
  CHECK (length(date)=10 AND date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint

CREATE TABLE financial_position_closure_reversal (
  closure_id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  reversal_event_id TEXT,
  write_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (closure_id,user_id) REFERENCES financial_position_closure(id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (reversal_event_id,user_id) REFERENCES financial_event(id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id,write_key) REFERENCES financial_write_request(user_id,idempotency_key) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE ledger_custom_budget_closure (
  id TEXT NOT NULL PRIMARY KEY,
  custom_budget_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  write_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id,user_id),
  FOREIGN KEY (custom_budget_id,user_id) REFERENCES ledger_custom_budget(id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id,write_key) REFERENCES financial_write_request(user_id,idempotency_key) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE ledger_custom_budget_closure_reversal (
  closure_id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  write_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (closure_id,user_id) REFERENCES ledger_custom_budget_closure(id,user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id,write_key) REFERENCES financial_write_request(user_id,idempotency_key) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TRIGGER trg_profile_adjustment_effective BEFORE INSERT ON financial_profile_adjustment
WHEN (SELECT minimum_cash_reserve FROM financial_profile WHERE user_id=NEW.user_id) + COALESCE((SELECT SUM(delta) FROM financial_profile_adjustment WHERE user_id=NEW.user_id),0) + NEW.delta < 0
BEGIN SELECT RAISE(ABORT,'ledger_negative_reserve'); END;
--> statement-breakpoint
CREATE TRIGGER trg_profile_adjustment_requires_profile BEFORE INSERT ON financial_profile_adjustment
WHEN NOT EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_profile_required'); END;
--> statement-breakpoint

CREATE TRIGGER trg_period_overlap_insert BEFORE INSERT ON budget_period
WHEN EXISTS (SELECT 1 FROM budget_period WHERE user_id=NEW.user_id AND NEW.start_date<=end_date AND NEW.end_date>=start_date)
BEGIN SELECT RAISE(ABORT,'ledger_period_overlap'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_overlap_update BEFORE UPDATE OF start_date,end_date,user_id ON budget_period
WHEN EXISTS (SELECT 1 FROM budget_period WHERE user_id=NEW.user_id AND id!=OLD.id AND NEW.start_date<=end_date AND NEW.end_date>=start_date)
BEGIN SELECT RAISE(ABORT,'ledger_period_overlap'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_financial_immutable BEFORE UPDATE OF planned_income,savings_target,spending_limit ON budget_period
BEGIN SELECT RAISE(ABORT,'ledger_period_financial_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_user_immutable BEFORE UPDATE OF user_id ON budget_period
BEGIN SELECT RAISE(ABORT,'ledger_period_user_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_locked_boundary BEFORE UPDATE OF start_date,end_date ON budget_period
WHEN EXISTS (SELECT 1 FROM budget_period_lock WHERE budget_period_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'ledger_period_locked'); END;
--> statement-breakpoint

CREATE TRIGGER trg_custom_capacity_insert BEFORE INSERT ON ledger_custom_budget
WHEN NEW.amount + COALESCE((SELECT SUM(cb.amount + COALESCE((SELECT SUM(delta) FROM ledger_custom_budget_adjustment ca WHERE ca.custom_budget_id=cb.id),0)) FROM ledger_custom_budget cb WHERE cb.budget_period_id=NEW.budget_period_id),0) >
  (SELECT spending_limit + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment ba WHERE ba.budget_period_id=bp.id AND ba.target='spending_limit'),0) FROM budget_period bp WHERE bp.id=NEW.budget_period_id)
BEGIN SELECT RAISE(ABORT,'ledger_custom_capacity_exceeds_limit'); END;
--> statement-breakpoint

CREATE TRIGGER trg_budget_adjustment_effective BEFORE INSERT ON ledger_budget_adjustment
WHEN
  (SELECT planned_income + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment WHERE budget_period_id=NEW.budget_period_id AND target='planned_income'),0) + CASE WHEN NEW.target='planned_income' THEN NEW.delta ELSE 0 END FROM budget_period WHERE id=NEW.budget_period_id) < 0 OR
  (SELECT savings_target + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment WHERE budget_period_id=NEW.budget_period_id AND target='savings_target'),0) + CASE WHEN NEW.target='savings_target' THEN NEW.delta ELSE 0 END FROM budget_period WHERE id=NEW.budget_period_id) < 0 OR
  (SELECT spending_limit + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment WHERE budget_period_id=NEW.budget_period_id AND target='spending_limit'),0) + CASE WHEN NEW.target='spending_limit' THEN NEW.delta ELSE 0 END FROM budget_period WHERE id=NEW.budget_period_id) < 0 OR
  (SELECT spending_limit + savings_target + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment WHERE budget_period_id=NEW.budget_period_id AND target IN ('spending_limit','savings_target')),0) + CASE WHEN NEW.target IN ('spending_limit','savings_target') THEN NEW.delta ELSE 0 END FROM budget_period WHERE id=NEW.budget_period_id) >
  (SELECT planned_income + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment WHERE budget_period_id=NEW.budget_period_id AND target='planned_income'),0) + CASE WHEN NEW.target='planned_income' THEN NEW.delta ELSE 0 END FROM budget_period WHERE id=NEW.budget_period_id)
BEGIN SELECT RAISE(ABORT,'ledger_invalid_effective_plan'); END;
--> statement-breakpoint
CREATE TRIGGER trg_budget_adjustment_custom_capacity BEFORE INSERT ON ledger_budget_adjustment
WHEN NEW.target='spending_limit' AND
  (SELECT COALESCE(SUM(cb.amount + COALESCE((SELECT SUM(delta) FROM ledger_custom_budget_adjustment ca WHERE ca.custom_budget_id=cb.id),0)),0) FROM ledger_custom_budget cb WHERE cb.budget_period_id=NEW.budget_period_id) >
  (SELECT spending_limit + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment WHERE budget_period_id=NEW.budget_period_id AND target='spending_limit'),0) + NEW.delta FROM budget_period WHERE id=NEW.budget_period_id)
BEGIN SELECT RAISE(ABORT,'ledger_custom_capacity_exceeds_limit'); END;
--> statement-breakpoint

CREATE TRIGGER trg_custom_adjustment_effective BEFORE INSERT ON ledger_custom_budget_adjustment
WHEN
  (SELECT amount + COALESCE((SELECT SUM(delta) FROM ledger_custom_budget_adjustment WHERE custom_budget_id=NEW.custom_budget_id),0) + NEW.delta FROM ledger_custom_budget WHERE id=NEW.custom_budget_id) < 0 OR
  (SELECT COALESCE(SUM(cb.amount + COALESCE((SELECT SUM(delta) FROM ledger_custom_budget_adjustment ca WHERE ca.custom_budget_id=cb.id),0) + CASE WHEN cb.id=NEW.custom_budget_id THEN NEW.delta ELSE 0 END),0) FROM ledger_custom_budget cb WHERE cb.budget_period_id=(SELECT budget_period_id FROM ledger_custom_budget WHERE id=NEW.custom_budget_id)) >
  (SELECT spending_limit + COALESCE((SELECT SUM(delta) FROM ledger_budget_adjustment ba WHERE ba.budget_period_id=bp.id AND ba.target='spending_limit'),0) FROM budget_period bp WHERE bp.id=(SELECT budget_period_id FROM ledger_custom_budget WHERE id=NEW.custom_budget_id))
BEGIN SELECT RAISE(ABORT,'ledger_invalid_custom_capacity'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_adjustment_closed BEFORE INSERT ON ledger_custom_budget_adjustment
WHEN EXISTS (SELECT 1 FROM ledger_custom_budget_closure c WHERE c.custom_budget_id=NEW.custom_budget_id AND NOT EXISTS (SELECT 1 FROM ledger_custom_budget_closure_reversal r WHERE r.closure_id=c.id))
BEGIN SELECT RAISE(ABORT,'ledger_custom_budget_closed'); END;
--> statement-breakpoint

CREATE TRIGGER trg_allocation_sealed BEFORE INSERT ON financial_event_custom_budget_allocation
WHEN EXISTS (SELECT 1 FROM financial_event_commit WHERE event_id=NEW.financial_event_id)
BEGIN SELECT RAISE(ABORT,'ledger_event_sealed'); END;
--> statement-breakpoint
CREATE TRIGGER trg_allocation_before_insert BEFORE INSERT ON financial_event_custom_budget_allocation
WHEN
  (SELECT kind NOT IN ('expense_cash','expense_position','refund_cash','refund_position','reversal') FROM financial_event WHERE id=NEW.financial_event_id) OR
  (SELECT budget_period_id FROM financial_event WHERE id=NEW.financial_event_id)!=(SELECT budget_period_id FROM ledger_custom_budget WHERE id=NEW.custom_budget_id) OR
  ((SELECT kind IN ('expense_cash','expense_position') FROM financial_event WHERE id=NEW.financial_event_id) AND NEW.allocated_expense_delta<=0) OR
  ((SELECT kind IN ('refund_cash','refund_position') FROM financial_event WHERE id=NEW.financial_event_id) AND NEW.allocated_expense_delta>=0) OR
  EXISTS (SELECT 1 FROM ledger_custom_budget_closure c WHERE c.custom_budget_id=NEW.custom_budget_id AND NOT EXISTS (SELECT 1 FROM ledger_custom_budget_closure_reversal r WHERE r.closure_id=c.id))
BEGIN SELECT RAISE(ABORT,'ledger_invalid_allocation'); END;
--> statement-breakpoint

CREATE TRIGGER trg_event_commit_validate BEFORE INSERT ON financial_event_commit
BEGIN
  SELECT RAISE(ABORT,'ledger_null_identity') WHERE NEW.event_id IS NULL;
  SELECT RAISE(ABORT,'ledger_profile_required') WHERE NOT EXISTS (SELECT 1 FROM financial_event e JOIN financial_profile p ON p.user_id=e.user_id WHERE e.id=NEW.event_id);
  SELECT RAISE(ABORT,'ledger_commit_write_mismatch') WHERE NEW.write_key!=(SELECT write_key FROM financial_event WHERE id=NEW.event_id);
  SELECT RAISE(ABORT,'ledger_event_before_start') WHERE (SELECT date < ledger_start_date FROM financial_event e JOIN financial_profile p ON p.user_id=e.user_id WHERE e.id=NEW.event_id);
  SELECT RAISE(ABORT,'ledger_opening_date') WHERE (SELECT e.kind IN ('opening_cash','opening_position') AND e.date!=p.ledger_start_date FROM financial_event e JOIN financial_profile p ON p.user_id=e.user_id WHERE e.id=NEW.event_id);
  SELECT RAISE(ABORT,'ledger_future_event') WHERE (SELECT date > date('now','+7 hours') FROM financial_event WHERE id=NEW.event_id);
  SELECT RAISE(ABORT,'ledger_category_type') WHERE EXISTS (SELECT 1 FROM financial_event e JOIN category c ON c.id=e.category_id AND c.user_id=e.user_id WHERE e.id=NEW.event_id AND ((e.kind='income_cash' AND c.type!='income') OR (e.kind IN ('expense_cash','expense_position','refund_cash','refund_position') AND c.type!='expense')));
  SELECT RAISE(ABORT,'ledger_position_kind') WHERE EXISTS (SELECT 1 FROM financial_event e JOIN financial_position p ON p.id=e.position_id AND p.user_id=e.user_id WHERE e.id=NEW.event_id AND e.kind IN ('expense_position','refund_position') AND p.kind!='credit_card');
  SELECT RAISE(ABORT,'ledger_event_outside_period') WHERE EXISTS (SELECT 1 FROM financial_event e JOIN budget_period bp ON bp.id=e.budget_period_id AND bp.user_id=e.user_id WHERE e.id=NEW.event_id AND e.kind IN ('expense_cash','expense_position') AND (e.date<bp.start_date OR e.date>bp.end_date));
  SELECT RAISE(ABORT,'ledger_allocation_exceeds_event') WHERE EXISTS (SELECT 1 FROM financial_event e WHERE e.id=NEW.event_id AND e.kind IN ('expense_cash','expense_position') AND COALESCE((SELECT SUM(allocated_expense_delta) FROM financial_event_custom_budget_allocation WHERE financial_event_id=e.id),0)>e.amount);
  SELECT RAISE(ABORT,'ledger_refund_mismatch') WHERE EXISTS (SELECT 1 FROM financial_event r LEFT JOIN financial_event o ON o.id=r.related_event_id AND o.user_id=r.user_id LEFT JOIN financial_event_commit oc ON oc.event_id=o.id WHERE r.id=NEW.event_id AND r.kind IN ('refund_cash','refund_position') AND (oc.event_id IS NULL OR o.kind NOT IN ('expense_cash','expense_position') OR r.category_id!=o.category_id OR r.budget_period_id!=o.budget_period_id OR r.position_id IS NOT o.position_id OR (r.kind='refund_cash')!=(o.kind='expense_cash') OR EXISTS (SELECT 1 FROM financial_event_commit rc JOIN financial_event rev ON rev.id=rc.event_id WHERE rev.reversal_of_event_id=o.id)));
  SELECT RAISE(ABORT,'ledger_refund_stale_prior') WHERE EXISTS (SELECT 1 FROM financial_event r WHERE r.id=NEW.event_id AND r.kind IN ('refund_cash','refund_position') AND r.refund_prior_total!=COALESCE((SELECT SUM(pr.amount) FROM financial_event pr JOIN financial_event_commit pc ON pc.event_id=pr.id WHERE pr.related_event_id=r.related_event_id AND pr.kind IN ('refund_cash','refund_position') AND NOT EXISTS (SELECT 1 FROM financial_event rr JOIN financial_event_commit rrc ON rrc.event_id=rr.id WHERE rr.reversal_of_event_id=pr.id)),0));
  SELECT RAISE(ABORT,'ledger_refund_exceeds_expense') WHERE EXISTS (SELECT 1 FROM financial_event r JOIN financial_event o ON o.id=r.related_event_id WHERE r.id=NEW.event_id AND r.kind IN ('refund_cash','refund_position') AND r.amount + COALESCE((SELECT SUM(pr.amount) FROM financial_event pr JOIN financial_event_commit pc ON pc.event_id=pr.id WHERE pr.related_event_id=o.id AND pr.kind IN ('refund_cash','refund_position') AND NOT EXISTS (SELECT 1 FROM financial_event rr JOIN financial_event_commit rrc ON rrc.event_id=rr.id WHERE rr.reversal_of_event_id=pr.id)),0)>o.amount);
  SELECT RAISE(ABORT,'ledger_refund_allocation_exceeds_original') WHERE EXISTS (SELECT 1 FROM financial_event r WHERE r.id=NEW.event_id AND r.kind IN ('refund_cash','refund_position') AND (-COALESCE((SELECT SUM(allocated_expense_delta) FROM financial_event_custom_budget_allocation WHERE financial_event_id=r.id),0)>r.amount OR EXISTS (SELECT 1 FROM financial_event_custom_budget_allocation a WHERE a.financial_event_id=r.id AND -a.allocated_expense_delta > COALESCE((SELECT SUM(oa.allocated_expense_delta) FROM financial_event_custom_budget_allocation oa WHERE oa.financial_event_id=r.related_event_id AND oa.custom_budget_id=a.custom_budget_id),0) + COALESCE((SELECT SUM(pa.allocated_expense_delta) FROM financial_event pr JOIN financial_event_commit pc ON pc.event_id=pr.id JOIN financial_event_custom_budget_allocation pa ON pa.financial_event_id=pr.id WHERE pr.related_event_id=r.related_event_id AND pa.custom_budget_id=a.custom_budget_id AND NOT EXISTS (SELECT 1 FROM financial_event rr JOIN financial_event_commit rrc ON rrc.event_id=rr.id WHERE rr.reversal_of_event_id=pr.id)),0))));
  SELECT RAISE(ABORT,'ledger_reversal_mismatch') WHERE EXISTS (SELECT 1 FROM financial_event r LEFT JOIN financial_event o ON o.id=r.reversal_of_event_id AND o.user_id=r.user_id LEFT JOIN financial_event_commit oc ON oc.event_id=o.id WHERE r.id=NEW.event_id AND r.kind='reversal' AND (oc.event_id IS NULL OR o.kind IN ('opening_cash','opening_position','reversal') OR r.amount!=o.amount OR r.date!=o.date OR r.cash_delta!=-o.cash_delta OR r.position_delta!=-o.position_delta OR r.income_delta!=-o.income_delta OR r.expense_delta!=-o.expense_delta OR r.equity_delta!=-o.equity_delta OR r.position_id IS NOT o.position_id OR r.category_id IS NOT o.category_id OR r.budget_period_id IS NOT o.budget_period_id));
  SELECT RAISE(ABORT,'ledger_reversal_allocation_mismatch') WHERE EXISTS (SELECT 1 FROM financial_event r WHERE r.id=NEW.event_id AND r.kind='reversal' AND (EXISTS (SELECT 1 FROM financial_event_custom_budget_allocation oa WHERE oa.financial_event_id=r.reversal_of_event_id AND NOT EXISTS (SELECT 1 FROM financial_event_custom_budget_allocation ra WHERE ra.financial_event_id=r.id AND ra.custom_budget_id=oa.custom_budget_id AND ra.allocated_expense_delta=-oa.allocated_expense_delta)) OR EXISTS (SELECT 1 FROM financial_event_custom_budget_allocation ra WHERE ra.financial_event_id=r.id AND NOT EXISTS (SELECT 1 FROM financial_event_custom_budget_allocation oa WHERE oa.financial_event_id=r.reversal_of_event_id AND oa.custom_budget_id=ra.custom_budget_id AND ra.allocated_expense_delta=-oa.allocated_expense_delta))));
  SELECT RAISE(ABORT,'ledger_expense_has_refunds') WHERE EXISTS (SELECT 1 FROM financial_event r JOIN financial_event o ON o.id=r.reversal_of_event_id WHERE r.id=NEW.event_id AND r.kind='reversal' AND o.kind IN ('expense_cash','expense_position') AND EXISTS (SELECT 1 FROM financial_event refund JOIN financial_event_commit fc ON fc.event_id=refund.id WHERE refund.related_event_id=o.id AND NOT EXISTS (SELECT 1 FROM financial_event rev JOIN financial_event_commit rc ON rc.event_id=rev.id WHERE rev.reversal_of_event_id=refund.id)));
  SELECT RAISE(ABORT,'ledger_position_closed') WHERE EXISTS (SELECT 1 FROM financial_event e JOIN financial_position_closure c ON c.position_id=e.position_id WHERE e.id=NEW.event_id AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal cr WHERE cr.closure_id=c.id AND (cr.reversal_event_id IS NULL OR EXISTS (SELECT 1 FROM financial_event_commit crc WHERE crc.event_id=cr.reversal_event_id))) AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal cr WHERE cr.closure_id=c.id AND cr.reversal_event_id=e.id AND e.kind='reversal' AND e.reversal_of_event_id=c.settlement_event_id));
  SELECT RAISE(ABORT,'ledger_position_crosses_zero') WHERE EXISTS (SELECT 1 FROM financial_event e WHERE e.id=NEW.event_id AND e.kind IN ('cash_to_position','position_to_cash') AND ((COALESCE((SELECT SUM(prior.position_delta) FROM financial_event prior JOIN financial_event_commit prior_commit ON prior_commit.event_id=prior.id WHERE prior.position_id=e.position_id),0)>0 AND COALESCE((SELECT SUM(prior.position_delta) FROM financial_event prior JOIN financial_event_commit prior_commit ON prior_commit.event_id=prior.id WHERE prior.position_id=e.position_id),0)+e.position_delta<0) OR (COALESCE((SELECT SUM(prior.position_delta) FROM financial_event prior JOIN financial_event_commit prior_commit ON prior_commit.event_id=prior.id WHERE prior.position_id=e.position_id),0)<0 AND COALESCE((SELECT SUM(prior.position_delta) FROM financial_event prior JOIN financial_event_commit prior_commit ON prior_commit.event_id=prior.id WHERE prior.position_id=e.position_id),0)+e.position_delta>0)));
END;
--> statement-breakpoint

CREATE TRIGGER trg_event_commit_lock AFTER INSERT ON financial_event_commit
WHEN (SELECT budget_period_id IS NOT NULL FROM financial_event WHERE id=NEW.event_id)
BEGIN INSERT INTO budget_period_lock(budget_period_id,user_id,first_event_id) SELECT e.budget_period_id,e.user_id,e.id FROM financial_event e WHERE e.id=NEW.event_id AND NOT EXISTS (SELECT 1 FROM budget_period_lock l WHERE l.budget_period_id=e.budget_period_id); END;
--> statement-breakpoint

CREATE TRIGGER trg_position_closure_validate BEFORE INSERT ON financial_position_closure
BEGIN
  SELECT RAISE(ABORT,'ledger_position_already_closed') WHERE EXISTS (SELECT 1 FROM financial_position_closure c WHERE c.position_id=NEW.position_id AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal r WHERE r.closure_id=c.id AND (r.reversal_event_id IS NULL OR EXISTS (SELECT 1 FROM financial_event_commit rc WHERE rc.event_id=r.reversal_event_id))));
  SELECT RAISE(ABORT,'ledger_future_close') WHERE NEW.date > date('now','+7 hours');
  SELECT RAISE(ABORT,'ledger_close_before_start') WHERE NEW.date < (SELECT ledger_start_date FROM financial_profile WHERE user_id=NEW.user_id);
  SELECT RAISE(ABORT,'ledger_close_before_activity') WHERE NEW.date < COALESCE((SELECT MAX(date) FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.position_id=NEW.position_id),'0000-00-00');
  SELECT RAISE(ABORT,'ledger_close_requires_settlement') WHERE NEW.settlement_event_id IS NULL AND COALESCE((SELECT SUM(e.position_delta) FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.position_id=NEW.position_id),0)!=0;
  SELECT RAISE(ABORT,'ledger_close_multiple_movements') WHERE NEW.settlement_event_id IS NOT NULL AND EXISTS (SELECT 1 FROM financial_event s JOIN financial_event_commit sc ON sc.event_id=s.id JOIN financial_event other ON other.position_id=s.position_id AND other.write_key=s.write_key AND other.date=s.date AND other.id!=s.id AND other.position_delta!=0 JOIN financial_event_commit oc ON oc.event_id=other.id WHERE s.id=NEW.settlement_event_id);
  SELECT RAISE(ABORT,'ledger_invalid_close_settlement') WHERE NEW.settlement_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_event s JOIN financial_event_commit sc ON sc.event_id=s.id WHERE s.id=NEW.settlement_event_id AND s.user_id=NEW.user_id AND s.position_id=NEW.position_id AND s.write_key=NEW.write_key AND s.date=NEW.date AND s.kind IN ('cash_to_position','position_to_cash') AND sc.sequence=(SELECT MAX(pc.sequence) FROM financial_event pe JOIN financial_event_commit pc ON pc.event_id=pe.id WHERE pe.position_id=NEW.position_id) AND COALESCE((SELECT SUM(e.position_delta) FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.position_id=NEW.position_id),0)=0 AND ((s.kind='position_to_cash' AND s.position_delta=-s.amount AND (SELECT COALESCE(SUM(e.position_delta),0) FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.position_id=NEW.position_id AND e.id!=s.id)=s.amount) OR (s.kind='cash_to_position' AND s.position_delta=s.amount AND (SELECT COALESCE(SUM(e.position_delta),0) FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.position_id=NEW.position_id AND e.id!=s.id)=-s.amount)));
END;
--> statement-breakpoint

CREATE TRIGGER trg_position_closure_reversal_validate BEFORE INSERT ON financial_position_closure_reversal
WHEN EXISTS (SELECT 1 FROM financial_position_closure c WHERE c.id=NEW.closure_id AND ((c.settlement_event_id IS NULL AND NEW.reversal_event_id IS NOT NULL) OR (c.settlement_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_event r WHERE r.id=NEW.reversal_event_id AND r.reversal_of_event_id=c.settlement_event_id AND r.write_key=NEW.write_key AND NOT EXISTS (SELECT 1 FROM financial_event_commit rc WHERE rc.event_id=r.id)))))
BEGIN SELECT RAISE(ABORT,'ledger_invalid_closure_reversal'); END;
--> statement-breakpoint

CREATE TRIGGER trg_write_request_duplicate BEFORE INSERT ON financial_write_request
WHEN EXISTS (SELECT 1 FROM financial_write_request WHERE user_id=NEW.user_id AND idempotency_key=NEW.idempotency_key)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_profile_duplicate BEFORE INSERT ON financial_profile
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_profile_adjustment_duplicate BEFORE INSERT ON financial_profile_adjustment
WHEN EXISTS (SELECT 1 FROM financial_profile_adjustment WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_budget_adjustment_duplicate BEFORE INSERT ON ledger_budget_adjustment
WHEN EXISTS (SELECT 1 FROM ledger_budget_adjustment WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_adjustment_duplicate BEFORE INSERT ON ledger_custom_budget_adjustment
WHEN EXISTS (SELECT 1 FROM ledger_custom_budget_adjustment WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_event_duplicate BEFORE INSERT ON financial_event
WHEN EXISTS (SELECT 1 FROM financial_event WHERE id=NEW.id) OR
  (NEW.kind='opening_cash' AND EXISTS (SELECT 1 FROM financial_event WHERE user_id=NEW.user_id AND kind='opening_cash')) OR
  (NEW.kind='opening_position' AND EXISTS (SELECT 1 FROM financial_event WHERE position_id=NEW.position_id AND kind='opening_position')) OR
  (NEW.reversal_of_event_id IS NOT NULL AND EXISTS (SELECT 1 FROM financial_event WHERE reversal_of_event_id=NEW.reversal_of_event_id))
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_allocation_duplicate BEFORE INSERT ON financial_event_custom_budget_allocation
WHEN EXISTS (SELECT 1 FROM financial_event_custom_budget_allocation WHERE financial_event_id=NEW.financial_event_id AND custom_budget_id=NEW.custom_budget_id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_commit_duplicate BEFORE INSERT ON financial_event_commit
WHEN EXISTS (SELECT 1 FROM financial_event_commit WHERE event_id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_lock_duplicate BEFORE INSERT ON budget_period_lock
WHEN EXISTS (SELECT 1 FROM budget_period_lock WHERE budget_period_id=NEW.budget_period_id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_closure_duplicate BEFORE INSERT ON financial_position_closure
WHEN EXISTS (SELECT 1 FROM financial_position_closure WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_closure_reversal_duplicate BEFORE INSERT ON financial_position_closure_reversal
WHEN EXISTS (SELECT 1 FROM financial_position_closure_reversal WHERE closure_id=NEW.closure_id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_closure_duplicate BEFORE INSERT ON ledger_custom_budget_closure
WHEN EXISTS (SELECT 1 FROM ledger_custom_budget_closure WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_closure_reversal_duplicate BEFORE INSERT ON ledger_custom_budget_closure_reversal
WHEN EXISTS (SELECT 1 FROM ledger_custom_budget_closure_reversal WHERE closure_id=NEW.closure_id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_duplicate BEFORE INSERT ON financial_position
WHEN EXISTS (SELECT 1 FROM financial_position WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_budget_period_duplicate BEFORE INSERT ON budget_period
WHEN EXISTS (SELECT 1 FROM budget_period WHERE id=NEW.id OR (user_id=NEW.user_id AND label=NEW.label))
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_budget_duplicate BEFORE INSERT ON ledger_custom_budget
WHEN EXISTS (SELECT 1 FROM ledger_custom_budget WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint

CREATE TRIGGER trg_custom_closure_validate BEFORE INSERT ON ledger_custom_budget_closure
WHEN EXISTS (SELECT 1 FROM ledger_custom_budget_closure c WHERE c.custom_budget_id=NEW.custom_budget_id AND NOT EXISTS (SELECT 1 FROM ledger_custom_budget_closure_reversal r WHERE r.closure_id=c.id)) OR
  (SELECT cb.amount + COALESCE((SELECT SUM(delta) FROM ledger_custom_budget_adjustment WHERE custom_budget_id=cb.id),0) - COALESCE((SELECT SUM(a.allocated_expense_delta) FROM financial_event_custom_budget_allocation a JOIN financial_event_commit ec ON ec.event_id=a.financial_event_id WHERE a.custom_budget_id=cb.id),0) FROM ledger_custom_budget cb WHERE cb.id=NEW.custom_budget_id)!=0
BEGIN SELECT RAISE(ABORT,'ledger_invalid_custom_closure'); END;
--> statement-breakpoint

CREATE TRIGGER trg_position_kind_immutable BEFORE UPDATE OF id,user_id,kind,reserve_against_cash,created_at ON financial_position
BEGIN SELECT RAISE(ABORT,'ledger_position_financial_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_budget_financial_immutable BEFORE UPDATE OF amount,budget_period_id,user_id ON ledger_custom_budget
BEGIN SELECT RAISE(ABORT,'ledger_custom_budget_financial_immutable'); END;
--> statement-breakpoint

CREATE TRIGGER trg_write_request_update BEFORE UPDATE ON financial_write_request BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_profile_update BEFORE UPDATE ON financial_profile BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_profile_adjustment_update BEFORE UPDATE ON financial_profile_adjustment BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_budget_adjustment_update BEFORE UPDATE ON ledger_budget_adjustment BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_adjustment_update BEFORE UPDATE ON ledger_custom_budget_adjustment BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_event_update BEFORE UPDATE ON financial_event BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_allocation_update BEFORE UPDATE ON financial_event_custom_budget_allocation BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_commit_update BEFORE UPDATE ON financial_event_commit BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_lock_update BEFORE UPDATE ON budget_period_lock BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_closure_update BEFORE UPDATE ON financial_position_closure BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_closure_reversal_update BEFORE UPDATE ON financial_position_closure_reversal BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_closure_update BEFORE UPDATE ON ledger_custom_budget_closure BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_closure_reversal_update BEFORE UPDATE ON ledger_custom_budget_closure_reversal BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint

CREATE TRIGGER trg_write_request_delete BEFORE DELETE ON financial_write_request WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_profile_delete BEFORE DELETE ON financial_profile WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_profile_adjustment_delete BEFORE DELETE ON financial_profile_adjustment WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_delete BEFORE DELETE ON financial_position WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_delete BEFORE DELETE ON budget_period WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_budget_adjustment_delete BEFORE DELETE ON ledger_budget_adjustment WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_budget_delete BEFORE DELETE ON ledger_custom_budget WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_adjustment_delete BEFORE DELETE ON ledger_custom_budget_adjustment WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_event_delete BEFORE DELETE ON financial_event WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_allocation_delete BEFORE DELETE ON financial_event_custom_budget_allocation WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_commit_delete BEFORE DELETE ON financial_event_commit WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_period_lock_delete BEFORE DELETE ON budget_period_lock WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_closure_delete BEFORE DELETE ON financial_position_closure WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_position_closure_reversal_delete BEFORE DELETE ON financial_position_closure_reversal WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_closure_delete BEFORE DELETE ON ledger_custom_budget_closure WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER trg_custom_closure_reversal_delete BEFORE DELETE ON ledger_custom_budget_closure_reversal WHEN EXISTS(SELECT 1 FROM user WHERE id=OLD.user_id) BEGIN SELECT RAISE(ABORT,'ledger_append_only'); END;
