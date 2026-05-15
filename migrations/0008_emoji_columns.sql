-- Add optional emoji to categories and transactions for visual display in lists
ALTER TABLE category ADD COLUMN emoji TEXT;
ALTER TABLE "transaction" ADD COLUMN emoji TEXT;
