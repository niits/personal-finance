import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const budgetId = Number(id);
  if (!Number.isInteger(budgetId)) return Errors.notFound();

  const db = await getKysely();
  const userId = session.user.id;

  const budget = await db
    .selectFrom("monthly_budget")
    .select(["id", "amount"])
    .where("id", "=", budgetId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!budget) return Errors.notFound("Budget không tồn tại");

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  const delta = b.delta;
  const hasObjective = "objective" in b;
  const newObjective = hasObjective
    ? (typeof b.objective === "string" ? b.objective.trim().substring(0, 500) || null : null)
    : undefined;

  const hasDelta = delta !== undefined;

  if (!hasDelta && !hasObjective)
    return Errors.validation("Cần cung cấp ít nhất một trong: delta, objective");

  if (hasDelta) {
    if (typeof delta !== "number" || !Number.isInteger(delta))
      return Errors.validation("delta phải là số nguyên");
    if (delta === 0) return Errors.validation("Delta phải khác 0");

    const newAmount = budget.amount + (delta as number);
    if (newAmount <= 0)
      return Errors.validation(
        `Số tiền budget sau điều chỉnh phải lớn hơn 0. Hiện tại: ${budget.amount} ₫, delta: ${delta} ₫`,
      );
  }

  const note = typeof b.note === "string" ? b.note.substring(0, 500) : null;

  if (hasDelta) {
    await db
      .updateTable("monthly_budget")
      .set((eb) => ({ amount: eb("amount", "+", delta as number) }))
      .where("id", "=", budgetId)
      .where("user_id", "=", userId)
      .execute();

    await db
      .insertInto("budget_adjustment")
      .values({ monthly_budget_id: budgetId, delta: delta as number, note })
      .execute();
  }

  if (hasObjective) {
    await db
      .updateTable("monthly_budget")
      .set({ objective: newObjective })
      .where("id", "=", budgetId)
      .where("user_id", "=", userId)
      .execute();
  }

  const updatedBudget = await db
    .selectFrom("monthly_budget")
    .select(["id", "month", "amount", "objective", "created_at"])
    .where("id", "=", budgetId)
    .executeTakeFirst();

  const adjustments = await db
    .selectFrom("budget_adjustment")
    .select(["id", "delta", "note", "created_at"])
    .where("monthly_budget_id", "=", budgetId)
    .orderBy("created_at", "asc")
    .execute();

  const latestAdj = adjustments[adjustments.length - 1];

  return Response.json({
    monthly_budget: { ...updatedBudget, adjustments },
    adjustment: latestAdj,
  });
}
