import type { CategoryTreeState } from "./category-tree-organize";

export async function loadCategoryTreeState(db: D1Database, userId: string): Promise<CategoryTreeState[]> {
  const { results } = await db.prepare(`SELECT c.id, c.name, c.type, c.parent_id,
    c.level, c.sort_order, c.system_kind, c.budget_behavior,
    (SELECT COUNT(*) FROM "transaction" t WHERE t.category_id = c.id AND t.user_id = c.user_id) AS transaction_count
    FROM category c WHERE c.user_id = ? ORDER BY c.id`).bind(userId).all<CategoryTreeState>();
  return results;
}

export async function categoryTreeSnapshot(categories: CategoryTreeState[]): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(categories)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Recheck the full snapshot within the same D1 transaction as the writes. */
export function assertCategoryTreeState(db: D1Database, userId: string, categories: CategoryTreeState[]) {
  return db.prepare(`SELECT CASE WHEN
    (SELECT COUNT(*) FROM category WHERE user_id = ?) = ? AND NOT EXISTS (
      SELECT 1 FROM json_each(?) expected LEFT JOIN category c
        ON c.id = json_extract(expected.value, '$.id') AND c.user_id = ?
      WHERE c.id IS NULL
        OR c.name IS NOT json_extract(expected.value, '$.name')
        OR c.type IS NOT json_extract(expected.value, '$.type')
        OR c.parent_id IS NOT json_extract(expected.value, '$.parent_id')
        OR c.level IS NOT json_extract(expected.value, '$.level')
        OR c.sort_order IS NOT json_extract(expected.value, '$.sort_order')
        OR c.system_kind IS NOT json_extract(expected.value, '$.system_kind')
        OR c.budget_behavior IS NOT json_extract(expected.value, '$.budget_behavior')
        OR (SELECT COUNT(*) FROM "transaction" t WHERE t.category_id = c.id AND t.user_id = c.user_id)
          != json_extract(expected.value, '$.transaction_count')
    ) THEN 1 ELSE json_extract('invalid JSON', '$') END`)
    .bind(userId, categories.length, JSON.stringify(categories), userId);
}
