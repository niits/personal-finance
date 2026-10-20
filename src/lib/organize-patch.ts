import { z } from "zod";
import { isUnicodeEmoji } from "./emoji";

export const OrganizeEmojiSchema = z.string().trim().min(1).refine(isUnicodeEmoji, "Một emoji Unicode hợp lệ là bắt buộc.");

export const OrganizeCategorySnapshotSchema = z.object({
  id: z.number().int().positive(), name: z.string(), type: z.enum(["income", "expense"]),
  parent_id: z.number().int().positive().nullable(), level: z.number().int(),
  sort_order: z.number().int(), emoji: z.string().nullable(), system_kind: z.string().nullable(),
  budget_behavior: z.string(), child_count: z.number().int(), transaction_count: z.number().int(),
});

export const OrganizePatchSchema = z.object({
  category_snapshot: z.array(OrganizeCategorySnapshotSchema).default([]),
  category_merges: z.array(z.object({
    source_category_id: z.number().int().positive(), source_category_name: z.string(),
    target_category_id: z.number().int().positive(), target_category_name: z.string(),
    transaction_count: z.number().int().nonnegative(), reason: z.string(),
  })).default([]),
  category_moves: z.array(z.object({
    category_id: z.number().int().positive(), category_name: z.string(),
    parent_category_id: z.number().int().positive().nullable(), parent_category_name: z.string().nullable(),
    sort_order: z.number().int().nonnegative(), reason: z.string(),
  })).default([]),
  new_categories: z.array(z.object({
    temp_id: z.string().regex(/^new:\d+$/),
    name: z.string().trim().min(1).max(100),
    type: z.enum(["income", "expense"]),
    parent_category_id: z.number().int().positive().nullable(),
    parent_category_name: z.string().nullable(),
    emoji: OrganizeEmojiSchema,
    example_notes: z.array(z.string()),
  })),
  emoji_assignments: z.array(z.object({
    category_id: z.number().int().positive(),
    category_name: z.string(),
    current_emoji: z.string().nullable(),
    emoji: OrganizeEmojiSchema,
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
    emoji: OrganizeEmojiSchema,
    reason: z.string(),
  })),
});

export type OrganizePatch = z.infer<typeof OrganizePatchSchema>;

export const OrganizeRetrySchema = z.object({
  patch: z.record(z.string(), z.unknown()),
  errors: z.array(z.string().min(1).max(500)).min(1).max(20),
});

export type OrganizeRetry = z.infer<typeof OrganizeRetrySchema>;

export type OrganizeCategoryState = z.infer<typeof OrganizeCategorySnapshotSchema>;

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
    db.prepare(`SELECT c.id, c.name, c.type, c.parent_id, c.level, c.sort_order, c.emoji, c.system_kind,
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
  errors: string[] = [],
): boolean {
  const fail = (message: string) => { errors.push(message); return false; };
  const unique = <T,>(values: T[]) => new Set(values).size === values.length;
  const { new_categories, emoji_assignments, recategorizations, emoji_reassignments, category_merges, category_moves } = patch;
  if (category_merges.length || category_moves.length) {
    const snapshotById = new Map(patch.category_snapshot.map((category) => [category.id, category]));
    if (snapshotById.size !== categories.length || patch.category_snapshot.length !== categories.length ||
        categories.some((category) => {
          const snapshot = snapshotById.get(category.id);
          return !snapshot || Object.keys(snapshot).some((key) =>
            snapshot[key as keyof OrganizeCategoryState] !== category[key as keyof OrganizeCategoryState]);
        })) return fail("category_snapshot: Cấu trúc, emoji hoặc số giao dịch không khớp dữ liệu danh mục hiện tại.");
  }
  const finalCategories = resolveOrganizeTree(patch, categories, errors);
  if (!finalCategories) return false;
  if (!unique(new_categories.map((category) => category.temp_id)) ||
      !unique(emoji_assignments.map((assignment) => assignment.category_id)) ||
      !unique(recategorizations.map((move) => move.transaction_id)) ||
      !unique(emoji_reassignments.map((assignment) => assignment.transaction_id))) return fail("Mỗi danh mục hoặc giao dịch chỉ được xuất hiện một lần trong từng nhóm đề xuất.");

  const categoryById = new Map(finalCategories.map((category) => [category.id, category]));
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const newById = new Map(new_categories.map((category) => [category.temp_id, category]));
  const newNames = new Set<string>();

  for (const category of new_categories) {
    const parent = category.parent_category_id === null ? null : categoryById.get(category.parent_category_id);
    if (category.parent_category_id !== null &&
        (!parent || parent.name !== category.parent_category_name || parent.type !== category.type ||
          parent.level >= 3 || parent.transaction_count > 0 || parent.system_kind)) return fail(`new_categories.${category.temp_id}: Danh mục cha phải tồn tại, cùng loại, dưới cấp ba, không được bảo vệ và không có giao dịch.`);
    if (category.parent_category_id === null && category.parent_category_name !== null) return fail(`new_categories.${category.temp_id}: Danh mục cấp gốc phải có parent_category_name bằng null.`);
    const siblingKey = `${category.type}:${category.parent_category_id ?? "root"}:${category.name.toLocaleLowerCase("vi")}`;
    if (newNames.has(siblingKey) || finalCategories.some((existing) =>
      existing.type === category.type && existing.parent_id === category.parent_category_id &&
        existing.name.toLocaleLowerCase("vi") === category.name.toLocaleLowerCase("vi"))) return fail(`new_categories.${category.temp_id}: Tên danh mục trùng với danh mục khác cùng loại và cùng cha.`);
    newNames.add(siblingKey);
  }
  for (const assignment of emoji_assignments) {
    const category = categoryById.get(assignment.category_id);
    if (!category || category.name !== assignment.category_name ||
        (category.emoji || null) !== assignment.current_emoji || category.emoji) return fail(`emoji_assignments.${assignment.category_id}: Chỉ được gán emoji cho danh mục hiện có chưa có emoji; tên và emoji hiện tại phải khớp.`);
  }
  for (const move of recategorizations) {
    const transaction = transactionById.get(move.transaction_id);
    const current = categoryById.get(move.current_category_id);
    const target = typeof move.suggested_category_id === "number"
      ? categoryById.get(move.suggested_category_id)
      : newById.get(move.suggested_category_id);
    if (!transaction || !current || !target || transaction.category_id !== current.id ||
        transaction.note !== move.note || transaction.updated_at !== move.current_updated_at ||
        current.name !== move.current_category_name || current.system_kind || current.budget_behavior !== "consumption" ||
        target.name !== move.suggested_category_name || target.type !== transaction.type ||
        move.suggested_category_id === current.id) return fail(`recategorizations.${move.transaction_id}: Nguồn phải là danh mục thông thường, dữ liệu giao dịch phải khớp và đích phải khác nguồn, cùng loại với giao dịch.`);
    if ("id" in target && (target.child_count > 0 || target.system_kind || target.budget_behavior !== "consumption" ||
        new_categories.some((category) => category.parent_category_id === target.id))) return fail(`recategorizations.${move.transaction_id}: Đích phải là danh mục lá thông thường có budget_behavior là consumption.`);
  }
  for (const assignment of emoji_reassignments) {
    const transaction = transactionById.get(assignment.transaction_id);
    if (!transaction || transaction.note !== assignment.note ||
        transaction.updated_at !== assignment.current_updated_at ||
        (transaction.emoji ?? transaction.category_emoji) !== assignment.current_emoji) return fail(`emoji_reassignments.${assignment.transaction_id}: Ghi chú, thời điểm cập nhật và emoji hiện tại phải khớp dữ liệu giao dịch.`);
  }
  return true;
}

/** Validate the complete resulting tree and derive descendant levels before writing. */
export function resolveOrganizeTree(
  patch: OrganizePatch,
  categories: OrganizeCategoryState[],
  errors: string[] = [],
): OrganizeCategoryState[] | null {
  const fail = (message: string) => { errors.push(message); return null; };
  if (patch.category_merges.length === 0 && patch.category_moves.length === 0) return categories.map((category) => ({ ...category }));
  const originals = new Map(categories.map((category) => [category.id, category]));
  const final = new Map(categories.map((category) => [category.id, { ...category }]));
  const sources = new Set(patch.category_merges.map((merge) => merge.source_category_id));
  const moved = new Set(patch.category_moves.map((move) => move.category_id));
  if (sources.size !== patch.category_merges.length || moved.size !== patch.category_moves.length) return fail("category_merges/category_moves: Mỗi danh mục nguồn chỉ được xuất hiện một lần trong từng nhóm.");
  for (const merge of patch.category_merges) {
    const source = originals.get(merge.source_category_id);
    const target = originals.get(merge.target_category_id);
    if (!source || !target || source.id === target.id || sources.has(target.id) ||
        moved.has(source.id) || moved.has(target.id) ||
        source.name !== merge.source_category_name || target.name !== merge.target_category_name ||
        source.transaction_count !== merge.transaction_count || source.child_count || target.child_count ||
        source.system_kind || target.system_kind || source.budget_behavior !== "consumption" ||
        target.budget_behavior !== source.budget_behavior || source.type !== target.type ||
        source.parent_id !== target.parent_id || target.transaction_count < source.transaction_count ||
        (target.transaction_count === source.transaction_count && target.id > source.id)) return fail(`category_merges.${merge.source_category_id}: Chỉ hợp nhất hai danh mục lá thông thường cùng loại, cùng cha và consumption; giữ đích có nhiều giao dịch hơn, nếu bằng nhau giữ ID nhỏ hơn. Không tạo chuỗi hợp nhất hoặc đồng thời di chuyển nguồn/đích.`);
    final.delete(source.id);
    final.get(target.id)!.transaction_count += source.transaction_count;
  }
  for (const move of patch.category_moves) {
    const category = final.get(move.category_id);
    const parent = move.parent_category_id === null ? null : final.get(move.parent_category_id);
    if (!category || category.system_kind || category.budget_behavior !== "consumption" ||
        category.name !== move.category_name ||
        (move.parent_category_id !== null && (!parent || parent.system_kind ||
          parent.budget_behavior !== category.budget_behavior || parent.name !== move.parent_category_name ||
          parent.type !== category.type || parent.transaction_count > 0)) ||
        (move.parent_category_id === null && move.parent_category_name !== null) ||
        (category.parent_id === move.parent_category_id && category.sort_order === move.sort_order)) return fail(`category_moves.${move.category_id}: Danh mục phải là mục thông thường. Cha phải tồn tại, cùng loại, không được bảo vệ và không có giao dịch. Tên danh mục phải khớp; vị trí mới phải khác vị trí hiện tại.`);
    category.parent_id = move.parent_category_id;
    category.sort_order = move.sort_order;
  }
  const names = new Set<string>();
  for (const category of final.values()) {
    const visited = new Set([category.id]);
    let ancestor = category;
    let level = 1;
    while (ancestor.parent_id !== null) {
      const parent = final.get(ancestor.parent_id);
      if (!parent) return fail(`category_moves.${category.id}: Danh mục cha ${ancestor.parent_id} không tồn tại trong cây kết quả.`);
      if (visited.has(parent.id)) return fail(`category_moves.${category.id}: Cây kết quả tạo vòng lặp qua danh mục ${parent.id}.`);
      if (parent.type !== category.type) return fail(`category_moves.${category.id}: Danh mục và toàn bộ tổ tiên phải cùng loại.`);
      if (++level > 3) return fail(`category_moves.${category.id}: Cây kết quả vượt ba cấp, bao gồm cả danh mục con.`);
      visited.add(parent.id);
      ancestor = parent;
    }
    if (category.system_kind && level !== category.level) return fail(`category_moves.${category.id}: Không được thay đổi cấp của danh mục được bảo vệ.`);
    category.level = level;
    category.child_count = [...final.values()].filter((child) => child.parent_id === category.id).length;
    if (category.child_count && category.transaction_count > 0) return fail(`category_moves.${category.id}: Danh mục có giao dịch phải giữ trạng thái danh mục lá.`);
    const key = `${category.type}:${category.parent_id}:${category.name.toLocaleLowerCase("vi")}`;
    if (names.has(key) && (patch.category_moves.length || patch.category_merges.length)) return fail(`category_moves.${category.id}: Tên ${category.name} trùng với danh mục khác cùng loại và cùng cha trong cây kết quả.`);
    names.add(key);
  }
  // Structural operations cannot delete references selected in other proposal groups.
  if (patch.recategorizations.some((move) => sources.has(move.current_category_id) ||
      (typeof move.suggested_category_id === "number" && sources.has(move.suggested_category_id))) ||
      patch.emoji_assignments.some((assignment) => sources.has(assignment.category_id)) ||
      patch.new_categories.some((category) => category.parent_category_id !== null && sources.has(category.parent_category_id))) return fail("category_merges: Danh mục nguồn sẽ bị xóa nên không được dùng trong phân loại lại, gán emoji hoặc làm cha của danh mục mới.");
  return [...final.values()];
}
