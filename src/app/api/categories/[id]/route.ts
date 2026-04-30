import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return Errors.notFound();

  const db = await getDB();
  const userId = session.user.id;

  const existing = await db
    .prepare("SELECT id FROM category WHERE id = ? AND user_id = ?")
    .bind(categoryId, userId)
    .first<{ id: number }>();
  if (!existing) return Errors.notFound("Danh mục không tồn tại");

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const { name, sort_order } = body as { name?: unknown; sort_order?: unknown };
  const updates: string[] = [];
  const binds: unknown[] = [];

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0)
      return Errors.validation("Tên danh mục không được để trống");
    if (name.trim().length > 100)
      return Errors.validation("Tên danh mục tối đa 100 ký tự");
    updates.push("name = ?");
    binds.push(name.trim());
  }

  if (sort_order !== undefined) {
    if (typeof sort_order !== "number" || !Number.isInteger(sort_order))
      return Errors.validation("sort_order phải là số nguyên");
    updates.push("sort_order = ?");
    binds.push(sort_order);
  }

  if (updates.length === 0) return Errors.validation("Không có trường nào để cập nhật");

  binds.push(categoryId, userId);
  const row = await db
    .prepare(
      `UPDATE category SET ${updates.join(", ")} WHERE id = ? AND user_id = ? RETURNING id, name, parent_id, level, sort_order, created_at`,
    )
    .bind(...binds)
    .first();

  return Response.json({ category: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return Errors.notFound();

  const db = await getDB();
  const userId = session.user.id;

  const existing = await db
    .prepare("SELECT id FROM category WHERE id = ? AND user_id = ?")
    .bind(categoryId, userId)
    .first<{ id: number }>();
  if (!existing) return Errors.notFound("Danh mục không tồn tại");

  const txnCount = await db
    .prepare('SELECT COUNT(*) as cnt FROM "transaction" WHERE category_id = ? AND user_id = ?')
    .bind(categoryId, userId)
    .first<{ cnt: number }>();
  if ((txnCount?.cnt ?? 0) > 0) {
    return Errors.conflict(
      `Danh mục đang được dùng bởi ${txnCount!.cnt} giao dịch`,
      "CATEGORY_IN_USE",
      { transaction_count: txnCount!.cnt },
    );
  }

  const childCount = await db
    .prepare("SELECT COUNT(*) as cnt FROM category WHERE parent_id = ? AND user_id = ?")
    .bind(categoryId, userId)
    .first<{ cnt: number }>();
  if ((childCount?.cnt ?? 0) > 0) {
    return Errors.conflict("Vui lòng xóa danh mục con trước");
  }

  await db
    .prepare("DELETE FROM category WHERE id = ? AND user_id = ?")
    .bind(categoryId, userId)
    .run();

  return Response.json({});
}
