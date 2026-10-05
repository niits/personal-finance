import { z } from "zod";

export const OrganizePatchSchema = z.object({
  new_categories: z.array(z.object({
    temp_id: z.string().regex(/^new:\d+$/),
    name: z.string().trim().min(1).max(100),
    type: z.enum(["income", "expense"]),
    parent_category_id: z.number().int().positive().nullable(),
    parent_category_name: z.string().nullable(),
    emoji: z.string().trim().min(1),
    example_notes: z.array(z.string()),
  })),
  emoji_assignments: z.array(z.object({
    category_id: z.number().int().positive(),
    category_name: z.string(),
    current_emoji: z.string().nullable(),
    emoji: z.string().trim().min(1),
  })),
  recategorizations: z.array(z.object({
    transaction_id: z.number().int().positive(),
    note: z.string(),
    current_category_id: z.number().int().positive(),
    current_category_name: z.string(),
    current_updated_at: z.number().int(),
    suggested_category_id: z.union([z.number().int().positive(), z.string().regex(/^new:\d+$/)]),
    suggested_category_name: z.string(),
    reason: z.string(),
  })),
  emoji_reassignments: z.array(z.object({
    transaction_id: z.number().int().positive(),
    note: z.string(),
    current_emoji: z.string().nullable(),
    current_updated_at: z.number().int(),
    emoji: z.string().trim().min(1),
    reason: z.string(),
  })),
});

export type OrganizePatch = z.infer<typeof OrganizePatchSchema>;

export type OrganizeCategoryState = {
  id: number; name: string; type: "income" | "expense"; parent_id: number | null;
  level: number; emoji: string | null; system_kind: string | null;
  budget_behavior: string; child_count: number; transaction_count: number;
};

export type OrganizeTransactionState = {
  id: number; note: string | null; type: "income" | "expense";
  category_id: number | null; emoji: string | null; category_emoji: string | null; updated_at: number;
};

export async function loadOrganizePatchState(
  db: D1Database,
  userId: string,
  patch: OrganizePatch,
) {
  const transactionIds = [...new Set([
    ...patch.recategorizations.map((move) => move.transaction_id),
    ...patch.emoji_reassignments.map((assignment) => assignment.transaction_id),
  ])];
  const [categoryResult, transactionResult] = await db.batch([
    db.prepare(`SELECT c.id, c.name, c.type, c.parent_id, c.level, c.emoji, c.system_kind,
      c.budget_behavior,
      (SELECT COUNT(*) FROM category child WHERE child.parent_id = c.id AND child.user_id = c.user_id) AS child_count,
      (SELECT COUNT(*) FROM "transaction" t WHERE t.category_id = c.id AND t.user_id = c.user_id) AS transaction_count
      FROM category c WHERE c.user_id = ?`).bind(userId),
    transactionIds.length === 0
      ? db.prepare('SELECT id FROM "transaction" WHERE 0')
      : db.prepare(`SELECT t.id, t.note, t.type, t.category_id, t.emoji, t.updated_at,
        c.emoji AS category_emoji FROM "transaction" t
        LEFT JOIN category c ON c.id = t.category_id AND c.user_id = t.user_id
        WHERE t.user_id = ? AND t.id IN (${transactionIds.map(() => "?").join(",")})`)
        .bind(userId, ...transactionIds),
  ]);
  return {
    categories: categoryResult.results as OrganizeCategoryState[],
    transactions: transactionResult.results as OrganizeTransactionState[],
  };
}

export function validateOrganizePatch(
  patch: OrganizePatch,
  categories: OrganizeCategoryState[],
  transactions: OrganizeTransactionState[],
): boolean {
  const unique = <T,>(values: T[]) => new Set(values).size === values.length;
  const { new_categories, emoji_assignments, recategorizations, emoji_reassignments } = patch;
  if (!unique(new_categories.map((category) => category.temp_id)) ||
      !unique(emoji_assignments.map((assignment) => assignment.category_id)) ||
      !unique(recategorizations.map((move) => move.transaction_id)) ||
      !unique(emoji_reassignments.map((assignment) => assignment.transaction_id))) return false;

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const newById = new Map(new_categories.map((category) => [category.temp_id, category]));
  const newNames = new Set<string>();

  for (const category of new_categories) {
    const parent = category.parent_category_id === null ? null : categoryById.get(category.parent_category_id);
    if (category.parent_category_id !== null &&
        (!parent || parent.name !== category.parent_category_name || parent.type !== category.type ||
          parent.level >= 3 || parent.transaction_count > 0 || parent.system_kind)) return false;
    if (category.parent_category_id === null && category.parent_category_name !== null) return false;
    const siblingKey = `${category.type}:${category.parent_category_id ?? "root"}:${category.name.toLocaleLowerCase("vi")}`;
    if (newNames.has(siblingKey) || categories.some((existing) =>
      existing.type === category.type && existing.parent_id === category.parent_category_id &&
      existing.name.toLocaleLowerCase("vi") === category.name.toLocaleLowerCase("vi"))) return false;
    newNames.add(siblingKey);
  }
  for (const assignment of emoji_assignments) {
    const category = categoryById.get(assignment.category_id);
    if (!category || category.name !== assignment.category_name ||
        (category.emoji || null) !== assignment.current_emoji || category.emoji) return false;
  }
  for (const move of recategorizations) {
    const transaction = transactionById.get(move.transaction_id);
    const current = categoryById.get(move.current_category_id);
    const target = typeof move.suggested_category_id === "number"
      ? categoryById.get(move.suggested_category_id)
      : newById.get(move.suggested_category_id);
    if (!transaction || !current || !target || transaction.category_id !== current.id ||
        transaction.note !== move.note || transaction.updated_at !== move.current_updated_at ||
        current.name !== move.current_category_name ||
        target.name !== move.suggested_category_name || target.type !== transaction.type ||
        move.suggested_category_id === current.id) return false;
    if ("id" in target && (target.child_count > 0 || target.system_kind || target.budget_behavior !== "consumption" ||
        new_categories.some((category) => category.parent_category_id === target.id))) return false;
  }
  for (const assignment of emoji_reassignments) {
    const transaction = transactionById.get(assignment.transaction_id);
    if (!transaction || transaction.note !== assignment.note ||
        transaction.updated_at !== assignment.current_updated_at ||
        (transaction.emoji ?? transaction.category_emoji) !== assignment.current_emoji) return false;
  }
  return true;
}
