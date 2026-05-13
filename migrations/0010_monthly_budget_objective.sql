-- Allow users to set a personal financial objective for each budget month.
-- The objective is used by the AI to generate aligned insights.
ALTER TABLE monthly_budget ADD COLUMN objective TEXT;
