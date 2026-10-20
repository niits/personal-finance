-- Preserve all existing movements and add the income counterpart of debt repayment.
INSERT INTO category (user_id, name, parent_id, level, sort_order, type, system_kind, budget_behavior)
SELECT id, 'Nhận tiền trả nợ', NULL, 1, 100, 'income', 'debt_collection', 'non_budget'
FROM user
WHERE NOT EXISTS (
  SELECT 1 FROM category
  WHERE category.user_id = user.id AND category.system_kind = 'debt_collection'
);
