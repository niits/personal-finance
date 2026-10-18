import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { CategoryTreePlanSchema, resolveCategoryTreePlan } from "@/lib/category-tree-organize";
import { assertCategoryTreeState, categoryTreeSnapshot, loadCategoryTreeState } from "@/lib/category-tree-organize-server";

const ApplySchema = CategoryTreePlanSchema.extend({ snapshot: z.string().regex(/^[a-f0-9]{64}$/) });
const conflict = () => Errors.conflict("Danh mục đã thay đổi hoặc đề xuất không hợp lệ. Vui lòng đóng và tạo đề xuất mới.", "STALE_PROPOSAL");

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const parsed = ApplySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "VALIDATION_ERROR", error: "Đề xuất cây danh mục không hợp lệ." }, { status: 422 });
  const db = await getDB();
  const userId = session.user.id;
  const categories = await loadCategoryTreeState(db, userId);
  if (parsed.data.snapshot !== await categoryTreeSnapshot(categories)) return conflict();
  const changes = resolveCategoryTreePlan(categories, parsed.data);
  if (!changes) return conflict();
  try {
    if (changes.length > 0) {
      await db.batch([
        assertCategoryTreeState(db, userId, categories),
        ...changes.map((change) => db.prepare(`UPDATE category SET parent_id = ?, level = ?, sort_order = ?
          WHERE id = ? AND user_id = ?`).bind(change.parent_id, change.level, change.sort_order, change.id, userId)),
      ]);
    }
  } catch (error) {
    if (/SQLITE_CONSTRAINT|malformed JSON/.test(String(error))) return conflict();
    console.error("[categories/organize/apply] D1 batch failed:", error);
    return Errors.internal();
  }
  return Response.json({ updated_categories: changes.length });
}
