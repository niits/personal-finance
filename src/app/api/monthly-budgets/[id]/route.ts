import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const budgetId = Number(id);
  if (!Number.isInteger(budgetId)) return Errors.notFound();

  const db = await getDB();
  const userId = session.user.id;

  const budget = await db
    .prepare("SELECT id, amount FROM monthly_budget WHERE id = ? AND user_id = ?")
    .bind(budgetId, userId)
    .first<{ id: number; amount: number }>();
  if (!budget) return Errors.notFound("Budget không tồn tại");

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  const delta = b.delta;

  if (typeof delta !== "number" || !Number.isInteger(delta))
    return Errors.validation("delta phải là số nguyên");
  if (delta === 0) return Errors.validation("Delta phải khác 0");

  const newAmount = budget.amount + delta;
  if (newAmount <= 0)
    return Errors.validation(
      `Số tiền budget sau điều chỉnh phải lớn hơn 0. Hiện tại: ${budget.amount} ₫, delta: ${delta} ₫`,
    );

  const note = typeof b.note === "string" ? b.note.substring(0, 500) : null;

  await db.batch([
    db
      .prepare("UPDATE monthly_budget SET amount = amount + ? WHERE id = ? AND user_id = ?")
      .bind(delta, budgetId, userId),
    db
      .prepare(
        "INSERT INTO budget_adjustment (monthly_budget_id, delta, note) VALUES (?, ?, ?)",
      )
      .bind(budgetId, delta, note),
  ]);

  const updatedBudget = await db
    .prepare("SELECT id, month, amount, created_at FROM monthly_budget WHERE id = ?")
    .bind(budgetId)
    .first<{ id: number; month: string; amount: number; created_at: number }>();

  const { results: adjustments } = await db
    .prepare(
      "SELECT id, delta, note, created_at FROM budget_adjustment WHERE monthly_budget_id = ? ORDER BY created_at ASC",
    )
    .bind(budgetId)
    .all<{ id: number; delta: number; note: string | null; created_at: number }>();

  const latestAdj = adjustments[adjustments.length - 1];

  return Response.json({
    monthly_budget: { ...updatedBudget, adjustments },
    adjustment: latestAdj,
  });
}
