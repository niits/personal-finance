-- Marks an expense as paid by credit card, so budget "remaining" can be
-- shown alongside how much of it hasn't actually left cash yet.
ALTER TABLE "transaction" ADD COLUMN is_credit_card INTEGER NOT NULL DEFAULT 0;
