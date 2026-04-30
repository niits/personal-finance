-- Add type column to category: 'income' | 'expense'
-- Default is 'expense' so existing rows are backward-compatible.
ALTER TABLE category ADD COLUMN type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense'));

-- Data migration: mark the seeded "Thu nhập" tree as income.
-- Uses name-based matching — acceptable for a single-user personal app
-- where the seed structure is known. New users created after this migration
-- will have the correct type set by seedNewUser().
UPDATE category
SET type = 'income'
WHERE name = 'Thu nhập' AND parent_id IS NULL;

UPDATE category
SET type = 'income'
WHERE parent_id IN (
  SELECT id FROM category WHERE name = 'Thu nhập' AND parent_id IS NULL
);
