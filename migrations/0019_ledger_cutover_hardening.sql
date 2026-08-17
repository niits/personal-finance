-- Durable cutover isolation and refund chronology. Application guards provide
-- friendly failures; these triggers close direct-write and concurrency races.
CREATE TRIGGER trg_profile_legacy_consent BEFORE INSERT ON financial_profile
WHEN NOT EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
  AND (NEW.legacy_data_archive_state!='preserved' OR NEW.legacy_data_consent_at IS NULL)
  AND (
    EXISTS (SELECT 1 FROM "transaction" WHERE user_id=NEW.user_id) OR
    EXISTS (SELECT 1 FROM monthly_budget WHERE user_id=NEW.user_id) OR
    EXISTS (SELECT 1 FROM custom_budget WHERE user_id=NEW.user_id) OR
    EXISTS (SELECT 1 FROM debt WHERE user_id=NEW.user_id)
  )
BEGIN SELECT RAISE(ABORT,'ledger_legacy_data_consent_required'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_transaction_insert BEFORE INSERT ON "transaction"
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_transaction_update BEFORE UPDATE ON "transaction"
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id OR user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_transaction_delete BEFORE DELETE ON "transaction"
WHEN EXISTS (SELECT 1 FROM user WHERE id=OLD.user_id) AND EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_monthly_budget_insert BEFORE INSERT ON monthly_budget
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_monthly_budget_update BEFORE UPDATE ON monthly_budget
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id OR user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_monthly_budget_delete BEFORE DELETE ON monthly_budget
WHEN EXISTS (SELECT 1 FROM user WHERE id=OLD.user_id) AND EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_custom_budget_insert BEFORE INSERT ON custom_budget
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_custom_budget_update BEFORE UPDATE ON custom_budget
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id OR user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_custom_budget_delete BEFORE DELETE ON custom_budget
WHEN EXISTS (SELECT 1 FROM user WHERE id=OLD.user_id) AND EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_legacy_debt_insert BEFORE INSERT ON debt
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_debt_update BEFORE UPDATE ON debt
WHEN EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id OR user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint
CREATE TRIGGER trg_legacy_debt_delete BEFORE DELETE ON debt
WHEN EXISTS (SELECT 1 FROM user WHERE id=OLD.user_id) AND EXISTS (SELECT 1 FROM financial_profile WHERE user_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'ledger_cutover_active'); END;
--> statement-breakpoint

CREATE TRIGGER trg_event_commit_refund_chronology BEFORE INSERT ON financial_event_commit
WHEN EXISTS (
  SELECT 1 FROM financial_event refund
  JOIN financial_event original ON original.id=refund.related_event_id AND original.user_id=refund.user_id
  WHERE refund.id=NEW.event_id
    AND refund.kind IN ('refund_cash','refund_position')
    AND refund.date<original.date
)
BEGIN SELECT RAISE(ABORT,'ledger_refund_before_expense'); END;
