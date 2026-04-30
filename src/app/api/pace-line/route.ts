import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, getBudgetPeriod } from "@/lib/validators";
import { buildIdealLine, buildActualLine } from "@/lib/pace-line";

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const monthParam = request.nextUrl.searchParams.get("month");
  const month = parseMonth(monthParam);
  if (!month) return Errors.validation("Thiếu hoặc sai định dạng tham số month (YYYY-MM)");

  const db = await getDB();
  const userId = session.user.id;

  const budget = await db
    .prepare("SELECT id, amount FROM monthly_budget WHERE user_id = ? AND month = ?")
    .bind(userId, month)
    .first<{ id: number; amount: number }>();

  if (!budget) {
    return Response.json({ month, monthly_budget: null, ideal_line: [], actual_line: [] });
  }

  const { start: periodStart, end: periodEnd } = getBudgetPeriod(month);
  const periodDays = Math.round(
    (new Date(periodEnd + "T00:00:00Z").getTime() - new Date(periodStart + "T00:00:00Z").getTime()) / 86400000,
  );

  const todayStr = new Date().toISOString().substring(0, 10);
  const isCurrentBudgetPeriod = todayStr >= periodStart && todayStr < periodEnd;
  const todayDay = isCurrentBudgetPeriod
    ? Math.min(
        Math.round((new Date(todayStr + "T00:00:00Z").getTime() - new Date(periodStart + "T00:00:00Z").getTime()) / 86400000) + 1,
        periodDays,
      )
    : periodDays;

  const { results: expenses } = await db
    .prepare(
      `SELECT CAST(julianday(date) - julianday(?) + 1 AS INTEGER) as day, SUM(amount) as total
       FROM "transaction"
       WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ?
       GROUP BY day`,
    )
    .bind(periodStart, userId, periodStart, periodEnd)
    .all<{ day: number; total: number }>();

  const dailyMap = new Map(expenses.map((e) => [e.day, e.total]));

  return Response.json({
    month,
    period_start: periodStart,
    period_end: periodEnd,
    budget_amount: budget.amount,
    days_in_period: periodDays,
    today_day: todayDay,
    ideal_line: buildIdealLine(budget.amount, periodDays),
    actual_line: buildActualLine(dailyMap, todayDay),
  });
}
