import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount } from "@/lib/validators";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const budgetId = Number(id);
  if (!Number.isInteger(budgetId)) return Errors.notFound();

  const db = await getDB();
  const userId = session.user.id;

  const existing = await db
    .prepare("SELECT id FROM custom_budget WHERE id = ? AND user_id = ?")
    .bind(budgetId, userId)
    .first<{ id: number }>();
  if (!existing) return Errors.notFound("Custom budget không tồn tại");

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  const updates: string[] = [];
  const binds: unknown[] = [];

  if (b.name !== undefined) {
    if (typeof b.name !== "string" || b.name.trim().length === 0)
      return Errors.validation("Tên không được để trống");
    if (b.name.trim().length > 100) return Errors.validation("Tên tối đa 100 ký tự");
    updates.push("name = ?");
    binds.push(b.name.trim());
  }

  if (b.amount !== undefined) {
    const amount = parseAmount(b.amount);
    if (!amount) return Errors.validation("Số tiền mục tiêu phải là số nguyên lớn hơn 0");
    updates.push("amount = ?");
    binds.push(amount);
  }

  if (b.is_active !== undefined) {
    if (b.is_active !== 0 && b.is_active !== 1)
      return Errors.validation("is_active phải là 0 hoặc 1");
    updates.push("is_active = ?");
    binds.push(b.is_active);
  }

  if (updates.length === 0) return Errors.validation("Không có trường nào để cập nhật");

  binds.push(budgetId, userId);
  const row = await db
    .prepare(
      `UPDATE custom_budget SET ${updates.join(", ")} WHERE id = ? AND user_id = ? RETURNING id, name, amount, is_active, created_at`,
    )
    .bind(...binds)
    .first();

  return Response.json({ custom_budget: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const budgetId = Number(id);
  if (!Number.isInteger(budgetId)) return Errors.notFound();

  const db = await getDB();
  const userId = session.user.id;

  const existing = await db
    .prepare("SELECT id FROM custom_budget WHERE id = ? AND user_id = ?")
    .bind(budgetId, userId)
    .first<{ id: number }>();
  if (!existing) return Errors.notFound("Custom budget không tồn tại");

  // transaction_custom_budget rows cascade-deleted by DB; transactions are NOT deleted
  await db
    .prepare("DELETE FROM custom_budget WHERE id = ? AND user_id = ?")
    .bind(budgetId, userId)
    .run();

  return Response.json({});
}
