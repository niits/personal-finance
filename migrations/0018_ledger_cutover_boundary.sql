-- Phase 6/7 cutover state and durable category-history protection.
ALTER TABLE financial_profile ADD COLUMN legacy_data_consent_at INTEGER;
--> statement-breakpoint
ALTER TABLE financial_profile ADD COLUMN legacy_data_archive_state TEXT NOT NULL DEFAULT 'not_applicable'
  CHECK (legacy_data_archive_state IN ('not_applicable','preserved'));
--> statement-breakpoint

CREATE TRIGGER trg_event_commit_leaf_category BEFORE INSERT ON financial_event_commit
WHEN EXISTS (
  SELECT 1 FROM financial_event e
  WHERE e.id=NEW.event_id
    AND e.category_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM category child WHERE child.parent_id=e.category_id AND child.user_id=e.user_id)
)
BEGIN SELECT RAISE(ABORT,'ledger_category_not_leaf'); END;
--> statement-breakpoint

CREATE TRIGGER trg_category_financial_history BEFORE DELETE ON category
WHEN EXISTS (
  SELECT 1 FROM financial_event e
  JOIN financial_event_commit ec ON ec.event_id=e.id
  WHERE e.category_id=OLD.id AND e.user_id=OLD.user_id
)
BEGIN SELECT RAISE(ABORT,'ledger_category_in_use'); END;
