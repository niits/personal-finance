import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount, parseMonth, currentBudgetMonth, getBudgetPeriod } from "@/lib/validators";

async function getBudgetWithAdjustments(db: D1Database, budgetId: number) {
  const budget = await db
    .prepare("SELECT id, user_id, month, amount, created_at FROM monthly_budget WHERE id = ?")
    .bind(budgetId)
    .first<{ id: number; user_id: string; month: string; amount: number; created_at: number }>();

  if (!budget) return null;

  const { results: adjustments } = await db
    .prepare(
      "SELECT id, delta, note, created_at FROM budget_adjustment WHERE monthly_budget_id = ? ORDER BY created_at ASC",
    )
    .bind(budgetId)
    .all<{ id: number; delta: number; note: string | null; created_at: number }>();

  return { ...budget, adjustments };
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const month = parseMonth(request.nextUrl.searchParams.get("month")) ?? currentBudgetMonth();
  const db = await getDB();

  const row = await db
    .prepare("SELECT id FROM monthly_budget WHERE user_id = ? AND month = ?")
    .bind(session.user.id, month)
    .first<{ id: number }>();

  const period = getBudgetPeriod(month);
  if (!row) return Response.json({ month, monthly_budget: null, ...period });

  const budget = await getBudgetWithAdjustments(db, row.id);
  return Response.json({ month, monthly_budget: budget, ...period });
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  const month = parseMonth(b.month);
  if (!month) return Errors.validation("Tháng không hợp lệ. Dùng định dạng YYYY-MM");

  const amount = parseAmount(b.amount);
  if (!amount) return Errors.validation("Số tiền phải là số nguyên lớn hơn 0");

  const db = await getDB();
  const userId = session.user.id;

  const existing = await db
    .prepare("SELECT id FROM monthly_budget WHERE user_id = ? AND month = ?")
    .bind(userId, month)
    .first<{ id: number }>();

  if (existing)
    return Errors.conflict(`Budget tháng ${month} đã tồn tại`, "CONFLICT");

  const result = await db
    .prepare(
      "INSERT INTO monthly_budget (user_id, month, amount) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(userId, month, amount)
    .first<{ id: number }>();

  const budget = await getBudgetWithAdjustments(db, result!.id);
  const period = getBudgetPeriod(month);
  return Response.json({ monthly_budget: budget, ...period }, { status: 201 });
}
