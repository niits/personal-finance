-- Allow a transaction to represent only a partial debt obligation.
-- When linked_amount is set, debt calculations use it instead of the full amount.
ALTER TABLE "transaction" ADD COLUMN linked_amount INTEGER NULL;
