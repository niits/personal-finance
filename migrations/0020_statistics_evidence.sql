-- Persist reproducible statistics evidence and model provenance.
ALTER TABLE statistics_report ADD COLUMN snapshot TEXT;
ALTER TABLE statistics_report ADD COLUMN model_id TEXT;
ALTER TABLE statistics_report ADD COLUMN report_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE statistics_report ADD COLUMN source_revision INTEGER NOT NULL DEFAULT 0;
UPDATE statistics_report SET is_dirty = 1;

CREATE TABLE statistics_revision (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER statistics_transaction_insert AFTER INSERT ON "transaction"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_transaction_update AFTER UPDATE ON "transaction"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_transaction_delete AFTER DELETE ON "transaction"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER statistics_category_insert AFTER INSERT ON "category"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_category_update AFTER UPDATE ON "category"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_category_delete AFTER DELETE ON "category"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER statistics_monthly_budget_insert AFTER INSERT ON "monthly_budget"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_monthly_budget_update AFTER UPDATE ON "monthly_budget"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_monthly_budget_delete AFTER DELETE ON "monthly_budget"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER statistics_credit_card_statement_insert AFTER INSERT ON "credit_card_statement"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_credit_card_statement_update AFTER UPDATE ON "credit_card_statement"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_credit_card_statement_delete AFTER DELETE ON "credit_card_statement"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER statistics_credit_card_group_insert AFTER INSERT ON "credit_card_group"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_credit_card_group_update AFTER UPDATE ON "credit_card_group"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
  INSERT INTO statistics_revision (user_id, revision) VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER statistics_credit_card_group_delete AFTER DELETE ON "credit_card_group"
BEGIN
  INSERT INTO statistics_revision (user_id, revision) VALUES (OLD.user_id, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
  UPDATE statistics_report SET is_dirty = 1 WHERE user_id = OLD.user_id;
END;
