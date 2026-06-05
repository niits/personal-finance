-- The statistics report now carries a single "Big Idea" headline (storytelling-with-data
-- Step 1): one Vietnamese sentence the whole report supports. Nullable for backward
-- compatibility — reports generated before this column simply have no headline.
ALTER TABLE statistics_report ADD COLUMN headline TEXT;
