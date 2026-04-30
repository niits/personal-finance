import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, currentMonth } from "@/lib/validators";
import { getDaysInMonth, idealBudgetAtDay } from "@/lib/pace-line";

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const month = parseMonth(request.nextUrl.searchParams.get("month")) ?? currentMonth();
  const db = await getDB();
  const userId = session.user.id;

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = getDaysInMonth(year, monthNum);
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === monthNum;
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const daysRemaining = daysInMonth - daysElapsed;

  const summary = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) as total_income
      FROM "transaction"
      WHERE user_id = ? AND date LIKE ?`,
    )
    .bind(userId, `${month}-%`)
    .first<{ total_expense: number; total_income: number }>();

  const totalExpense = summary?.total_expense ?? 0;
  const totalIncome = summary?.total_income ?? 0;

  const budget = await db
    .prepare("SELECT id, amount FROM monthly_budget WHERE user_id = ? AND month = ?")
    .bind(userId, month)
    .first<{ id: number; amount: number }>();

  let paceStatus: "under" | "over" | "no_budget" = "no_budget";
  let monthlyBudget: { id: number; amount: number; remaining: number } | null = null;

  if (budget) {
    const remaining = budget.amount - totalExpense;
    monthlyBudget = { id: budget.id, amount: budget.amount, remaining };
    const ideal = idealBudgetAtDay({
      budget: budget.amount,
      daysInMonth,
      day: daysElapsed,
    });
    paceStatus = totalExpense > ideal ? "over" : "under";
  }

  const cacheHeader = isCurrentMonth
    ? "private, max-age=60, stale-while-revalidate=300"
    : "private, max-age=86400";

  return Response.json({
    month,
    total_expense: totalExpense,
    total_income: totalIncome,
    savings: totalIncome - totalExpense,
    monthly_budget: monthlyBudget,
    days_in_month: daysInMonth,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    pace_status: paceStatus,
  }, { headers: { "Cache-Control": cacheHeader } });
}
