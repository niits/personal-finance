import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, currentBudgetMonth, getBudgetPeriod } from "@/lib/validators";
import { idealBudgetAtDay } from "@/lib/pace-line";
import { sql } from "kysely";

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const month = parseMonth(request.nextUrl.searchParams.get("month")) ?? currentBudgetMonth();
  const db = await getKysely();
  const userId = session.user.id;

  const { start: periodStart, end: periodEnd } = getBudgetPeriod(month);
  const periodDays = Math.round(
    (new Date(periodEnd + "T00:00:00Z").getTime() - new Date(periodStart + "T00:00:00Z").getTime()) / 86400000,
  );

  const isCurrentBudgetMonth = month === currentBudgetMonth();
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const daysElapsed = isCurrentBudgetMonth
    ? Math.min(
        Math.round((new Date(todayStr + "T00:00:00Z").getTime() - new Date(periodStart + "T00:00:00Z").getTime()) / 86400000) + 1,
        periodDays,
      )
    : periodDays;
  const daysRemaining = periodDays - daysElapsed;

  const summary = await db
    .selectFrom("transaction")
    .select([
      sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`.as("total_expense"),
      sql<number>`COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0)`.as("total_income"),
    ])
    .where("user_id", "=", userId)
    .where("date", ">=", periodStart)
    .where("date", "<", periodEnd)
    .executeTakeFirst();

  const totalExpense = summary?.total_expense ?? 0;
  const totalIncome = summary?.total_income ?? 0;

  const budget = await db
    .selectFrom("monthly_budget")
    .select(["id", "amount"])
    .where("user_id", "=", userId)
    .where("month", "=", month)
    .executeTakeFirst();

  let paceStatus: "under" | "over" | "no_budget" = "no_budget";
  let monthlyBudget: { id: number; amount: number; remaining: number } | null = null;

  if (budget) {
    const remaining = budget.amount - totalExpense;
    monthlyBudget = { id: budget.id, amount: budget.amount, remaining };
    const ideal = idealBudgetAtDay({
      budget: budget.amount,
      daysInMonth: periodDays,
      day: daysElapsed,
    });
    paceStatus = totalExpense > ideal ? "over" : "under";
  }

  const cacheHeader = isCurrentBudgetMonth
    ? "private, max-age=60, stale-while-revalidate=300"
    : "private, max-age=86400";

  return Response.json({
    month,
    period_start: periodStart,
    period_end: periodEnd,
    total_expense: totalExpense,
    total_income: totalIncome,
    savings: totalIncome - totalExpense,
    monthly_budget: monthlyBudget,
    days_in_period: periodDays,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    pace_status: paceStatus,
  }, { headers: { "Cache-Control": cacheHeader } });
}
