import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { OrganizePatchSchema, loadOrganizePatchState, validateOrganizePatch } from "@/lib/organize-patch";

const conflict = () => Errors.conflict(
  "Dữ liệu đã thay đổi hoặc đề xuất không còn hợp lệ. Vui lòng tạo đề xuất mới.",
  "STALE_PROPOSAL",
);

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = OrganizePatchSchema.safeParse(body);
  if (!parsed.success) return Errors.validation("Đề xuất áp dụng không hợp lệ.");
  const { new_categories, emoji_assignments, recategorizations, emoji_reassignments } = parsed.data;
  const db = await getDB();
  const userId = session.user.id;
  const { categories, transactions } = await loadOrganizePatchState(db, userId, parsed.data);
  if (!validateOrganizePatch(parsed.data, categories, transactions)) return conflict();
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const now = Math.floor(Date.now() / 1000);
  const statements: D1PreparedStatement[] = [];
  const assertSnapshot = (condition: string, ...parameters: (string | number | null)[]) => {
    statements.push(db.prepare(
      `SELECT CASE WHEN ${condition} THEN 1 ELSE json_extract('invalid JSON', '$') END`,
    ).bind(...parameters));
  };
  for (const cat of new_categories) {
    if (cat.parent_category_id !== null) {
      assertSnapshot(
        `EXISTS (SELECT 1 FROM category c WHERE c.id = ? AND c.user_id = ? AND c.name = ?
          AND c.type = ? AND c.level < 3 AND c.system_kind IS NULL
          AND NOT EXISTS (SELECT 1 FROM "transaction" t
            WHERE t.category_id = c.id AND t.user_id = c.user_id))`,
        cat.parent_category_id, userId, cat.parent_category_name, cat.type,
      );
    }
    assertSnapshot(
      `NOT EXISTS (SELECT 1 FROM category WHERE user_id = ? AND type = ?
        AND parent_id IS ? AND name = ?)`,
      userId, cat.type, cat.parent_category_id, cat.name,
    );
  }
  for (const assignment of emoji_assignments) {
    assertSnapshot(
      `EXISTS (SELECT 1 FROM category WHERE id = ? AND user_id = ? AND name = ?
        AND (emoji IS NULL OR emoji = ''))`,
      assignment.category_id, userId, assignment.category_name,
    );
  }
  for (const move of recategorizations) {
    assertSnapshot(
      `EXISTS (SELECT 1 FROM "transaction" t JOIN category c
        ON c.id = t.category_id AND c.user_id = t.user_id
        WHERE t.id = ? AND t.user_id = ? AND t.category_id = ?
          AND t.note = ? AND t.updated_at = ? AND c.name = ?)`,
      move.transaction_id, userId, move.current_category_id,
      move.note, move.current_updated_at, move.current_category_name,
    );
    if (typeof move.suggested_category_id === "number") {
      assertSnapshot(
        `EXISTS (SELECT 1 FROM category c WHERE c.id = ? AND c.user_id = ?
          AND c.name = ? AND c.system_kind IS NULL AND c.budget_behavior = 'consumption'
          AND NOT EXISTS (SELECT 1 FROM category child
            WHERE child.parent_id = c.id AND child.user_id = c.user_id)
          AND c.type = (SELECT t.type FROM "transaction" t
            WHERE t.id = ? AND t.user_id = ?))`,
        move.suggested_category_id, userId, move.suggested_category_name,
        move.transaction_id, userId,
      );
    }
  }
  for (const assignment of emoji_reassignments) {
    assertSnapshot(
      `EXISTS (SELECT 1 FROM "transaction" t LEFT JOIN category c
        ON c.id = t.category_id AND c.user_id = t.user_id
        WHERE t.id = ? AND t.user_id = ? AND t.note = ?
          AND t.updated_at = ? AND COALESCE(t.emoji, c.emoji) IS ?)`,
      assignment.transaction_id, userId, assignment.note,
      assignment.current_updated_at, assignment.current_emoji,
    );
  }
  // A zero-row conditional update must abort the D1 transaction as a stale patch.
  const assertUpdated = () => statements.push(db.prepare(
    "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('invalid JSON', '$') END",
  ));
  for (const cat of new_categories) {
    const parent = cat.parent_category_id === null ? null : categoryById.get(cat.parent_category_id)!;
    statements.push(db.prepare(`INSERT INTO category
      (user_id, name, type, parent_id, level, sort_order, emoji, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)`).bind(
      userId, cat.name, cat.type, cat.parent_category_id, parent ? parent.level + 1 : 1, cat.emoji, now,
    ));
    for (const move of recategorizations.filter((r) => r.suggested_category_id === cat.temp_id)) {
      statements.push(db.prepare(`UPDATE "transaction" SET category_id = last_insert_rowid(), updated_at = ?
        WHERE id = ? AND user_id = ? AND category_id = ?`).bind(
        now, move.transaction_id, userId, move.current_category_id,
      ));
      assertUpdated();
    }
  }
  for (const assignment of emoji_assignments) {
    statements.push(db.prepare(`UPDATE category SET emoji = ?
      WHERE id = ? AND user_id = ? AND (emoji IS NULL OR emoji = '')`).bind(
      assignment.emoji, assignment.category_id, userId,
    ));
    assertUpdated();
  }
  for (const move of recategorizations.filter((r) => typeof r.suggested_category_id === "number")) {
    statements.push(db.prepare(`UPDATE "transaction" SET category_id = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND category_id = ?`).bind(
      move.suggested_category_id, now, move.transaction_id, userId, move.current_category_id,
    ));
    assertUpdated();
  }
  for (const assignment of emoji_reassignments) {
    statements.push(db.prepare(`UPDATE "transaction" SET emoji = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`).bind(assignment.emoji, now, assignment.transaction_id, userId));
    assertUpdated();
  }
  try {
    if (statements.length > 0) await db.batch(statements);
  } catch (error) {
    console.error("[ai/organize/apply] D1 batch failed:", error);
    const message = String(error);
    return message.includes("SQLITE_CONSTRAINT") || message.includes("malformed JSON")
      ? conflict()
      : Errors.internal();
  }
  return Response.json({
    created_categories: new_categories.length,
    emoji_updated: emoji_assignments.length + emoji_reassignments.length,
    transactions_moved: recategorizations.length,
  });
}
