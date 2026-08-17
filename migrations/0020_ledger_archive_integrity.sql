-- Freeze the remaining legacy finance archive after ledger activation and keep
-- categories used by committed events as permanent leaves.
CREATE TRIGGER trg_legacy_budget_adjustment_insert BEFORE INSERT ON budget_adjustment
WHEN EXISTS (
  SELECT 1 FROM monthly_budget mb
  JOIN financial_profile fp ON fp.user_id=mb.user_id
  WHERE mb.id=NEW.monthly_budget_id
)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_budget_adjustment_update BEFORE UPDATE ON budget_adjustment
WHEN EXISTS (
  SELECT 1 FROM monthly_budget mb
  JOIN financial_profile fp ON fp.user_id=mb.user_id
  WHERE mb.id IN (OLD.monthly_budget_id,NEW.monthly_budget_id)
)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_budget_adjustment_delete BEFORE DELETE ON budget_adjustment
WHEN EXISTS (
  SELECT 1 FROM monthly_budget mb
  JOIN financial_profile fp ON fp.user_id=mb.user_id
  WHERE mb.id=OLD.monthly_budget_id
)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_tcb_insert BEFORE INSERT ON transaction_custom_budget
WHEN EXISTS (
  SELECT 1 FROM "transaction" t
  JOIN financial_profile fp ON fp.user_id=t.user_id
  WHERE t.id=NEW.transaction_id
) OR EXISTS (
  SELECT 1 FROM custom_budget cb
  JOIN financial_profile fp ON fp.user_id=cb.user_id
  WHERE cb.id=NEW.custom_budget_id
)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_tcb_update BEFORE UPDATE ON transaction_custom_budget
WHEN EXISTS (
  SELECT 1 FROM "transaction" t
  JOIN financial_profile fp ON fp.user_id=t.user_id
  WHERE t.id IN (OLD.transaction_id,NEW.transaction_id)
) OR EXISTS (
  SELECT 1 FROM custom_budget cb
  JOIN financial_profile fp ON fp.user_id=cb.user_id
  WHERE cb.id IN (OLD.custom_budget_id,NEW.custom_budget_id)
)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_tcb_delete BEFORE DELETE ON transaction_custom_budget
WHEN EXISTS (
  SELECT 1 FROM "transaction" t
  JOIN financial_profile fp ON fp.user_id=t.user_id
  WHERE t.id=OLD.transaction_id
) OR EXISTS (
  SELECT 1 FROM custom_budget cb
  JOIN financial_profile fp ON fp.user_id=cb.user_id
  WHERE cb.id=OLD.custom_budget_id
)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_budget_config_insert BEFORE INSERT ON budget_config
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_budget_config_update BEFORE UPDATE ON budget_config
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id IN (OLD.user_id,NEW.user_id))
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_budget_config_delete BEFORE DELETE ON budget_config
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_statistics_insert BEFORE INSERT ON statistics_report
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_statistics_update BEFORE UPDATE ON statistics_report
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id IN (OLD.user_id,NEW.user_id))
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_statistics_delete BEFORE DELETE ON statistics_report
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_ai_run_insert BEFORE INSERT ON ai_suggestion_run
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_ai_run_update BEFORE UPDATE ON ai_suggestion_run
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id IN (OLD.user_id,NEW.user_id))
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_ai_run_delete BEFORE DELETE ON ai_suggestion_run
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_category_used_parent BEFORE INSERT ON category
WHEN NEW.parent_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM category parent
  JOIN financial_event e ON e.category_id=parent.id AND e.user_id=parent.user_id
  JOIN financial_event_commit ec ON ec.event_id=e.id
  WHERE parent.id=NEW.parent_id AND parent.user_id=NEW.user_id
)
BEGIN SELECT RAISE(ABORT,'ledger_category_in_use'); END;
