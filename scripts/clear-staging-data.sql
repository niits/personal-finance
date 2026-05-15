-- Wipes all rows from the staging database before a prod→staging data sync.
-- Run this BEFORE importing the prod dump so INSERT statements don't conflict.
-- Table order respects FK constraints (leaf tables first).

PRAGMA foreign_keys = OFF;

DELETE FROM transaction_custom_budget;
DELETE FROM ai_suggestion_run;
DELETE FROM budget_adjustment;
DELETE FROM "transaction";
DELETE FROM monthly_budget;
DELETE FROM custom_budget;
DELETE FROM budget_config;
DELETE FROM category;
DELETE FROM session;
DELETE FROM account;
DELETE FROM verification;
DELETE FROM "user";

PRAGMA foreign_keys = ON;
