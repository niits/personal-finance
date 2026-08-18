-- Wipes all rows from the staging database before a prod→staging data sync
-- or a fresh-start onboarding reset.
-- Run this BEFORE importing a prod dump so INSERT statements don't conflict.
--
-- Ordering constraints:
--   * `user` is deleted FIRST: the append-only ledger and legacy cutover
--     delete triggers only fire while the owning user still exists
--     (`WHEN EXISTS (SELECT 1 FROM user WHERE id=OLD.user_id)`), so deleting
--     the owner first lets every other table be wiped.
--   * Ledger event tables are deleted before `category` because
--     `trg_category_financial_history` blocks deleting a category that still
--     has committed financial_event rows.
-- Table order otherwise respects FK constraints (leaf tables first).

PRAGMA foreign_keys = OFF;

DELETE FROM "user";

DELETE FROM financial_event_custom_budget_allocation;
DELETE FROM financial_event_commit;
DELETE FROM financial_event;
DELETE FROM financial_position_closure_reversal;
DELETE FROM financial_position_closure;
DELETE FROM ledger_custom_budget_closure_reversal;
DELETE FROM ledger_custom_budget_closure;
DELETE FROM ledger_custom_budget_adjustment;
DELETE FROM ledger_custom_budget;
DELETE FROM ledger_budget_adjustment;
DELETE FROM budget_period_lock;
DELETE FROM budget_period;
DELETE FROM financial_position;
DELETE FROM financial_profile_adjustment;
DELETE FROM financial_profile;
DELETE FROM financial_write_request;

DELETE FROM transaction_custom_budget;
DELETE FROM ai_suggestion_run;
DELETE FROM budget_adjustment;
DELETE FROM "transaction";
DELETE FROM debt;
DELETE FROM monthly_budget;
DELETE FROM custom_budget;
DELETE FROM budget_config;
DELETE FROM statistics_report;
DELETE FROM category;
DELETE FROM session;
DELETE FROM account;
DELETE FROM verification;

PRAGMA foreign_keys = ON;