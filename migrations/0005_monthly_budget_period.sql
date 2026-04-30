-- Add start_date and end_date to monthly_budget so transaction queries
-- can filter by stored dates instead of recomputing the budget period each time.
-- start_date: first date of the budget period (inclusive)
-- end_date:   last date of the budget period (inclusive)
ALTER TABLE monthly_budget ADD COLUMN start_date TEXT NOT NULL DEFAULT '';
ALTER TABLE monthly_budget ADD COLUMN end_date   TEXT NOT NULL DEFAULT '';
