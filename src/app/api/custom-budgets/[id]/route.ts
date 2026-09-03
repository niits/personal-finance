import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount } from "@/lib/validators";
import { sql } from "kysely";

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
    .select(["id", "amount"])
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

  await db
    .updateTable("custom_budget")
    .set(updates)
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
    .execute();

  const row = await db
    .selectFrom("custom_budget")
    .select(["id", "name", "amount", "is_active", "created_at"])
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
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

  const linked = await db
    .selectFrom("transaction_custom_budget")
    .select(({ fn }) => fn.count<number>("transaction_id").as("count"))
    .where("custom_budget_id", "=", budgetId)
    .executeTakeFirstOrThrow();
  const affectedCount = Number(linked.count);
  if (affectedCount > 0) {
    return Errors.conflict(
      `Không thể xoá vì ngân sách đang liên kết với ${affectedCount} giao dịch`,
      "CUSTOM_BUDGET_LINKED",
      { affected_count: affectedCount },
    );
  }

  const deleted = await db
    .deleteFrom("custom_budget")
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
    .where(sql<boolean>`NOT EXISTS (
      SELECT 1 FROM transaction_custom_budget
      WHERE custom_budget_id = ${budgetId}
    )`)
    .executeTakeFirst();

  if (Number(deleted.numDeletedRows) === 0) {
    const currentLinked = await db
      .selectFrom("transaction_custom_budget")
      .select(({ fn }) => fn.count<number>("transaction_id").as("count"))
      .where("custom_budget_id", "=", budgetId)
      .executeTakeFirstOrThrow();
    return Errors.conflict(
      `Không thể xoá vì ngân sách đang liên kết với ${Number(currentLinked.count)} giao dịch`,
      "CUSTOM_BUDGET_LINKED",
      { affected_count: Number(currentLinked.count) },
    );
  }

  return Response.json({});
}
