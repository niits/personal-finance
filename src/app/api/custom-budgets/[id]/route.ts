import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
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

  const db = await getKysely();
  const userId = session.user.id;

  const existing = await db
    .selectFrom("custom_budget")
    .select("id")
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing) return Errors.notFound("Custom budget không tồn tại");

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (b.name !== undefined) {
    if (typeof b.name !== "string" || b.name.trim().length === 0)
      return Errors.validation("Tên không được để trống");
    if (b.name.trim().length > 100) return Errors.validation("Tên tối đa 100 ký tự");
    updates.name = b.name.trim();
  }

  if (b.amount !== undefined) {
    const amount = parseAmount(b.amount);
    if (!amount) return Errors.validation("Số tiền mục tiêu phải là số nguyên lớn hơn 0");
    updates.amount = amount;
  }

  if (b.is_active !== undefined) {
    if (b.is_active !== 0 && b.is_active !== 1)
      return Errors.validation("is_active phải là 0 hoặc 1");
    updates.is_active = b.is_active;
  }

  if (Object.keys(updates).length === 0) return Errors.validation("Không có trường nào để cập nhật");

  const row = await db
    .updateTable("custom_budget")
    .set(updates)
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
    .returning(["id", "name", "amount", "is_active", "created_at"])
    .executeTakeFirst();

  return Response.json({ custom_budget: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const budgetId = Number(id);
  if (!Number.isInteger(budgetId)) return Errors.notFound();

  const db = await getKysely();
  const userId = session.user.id;

  const existing = await db
    .selectFrom("custom_budget")
    .select("id")
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing) return Errors.notFound("Custom budget không tồn tại");

  // transaction_custom_budget rows cascade-deleted by DB; transactions are NOT deleted
  await db
    .deleteFrom("custom_budget")
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
    .execute();

  return Response.json({});
}
