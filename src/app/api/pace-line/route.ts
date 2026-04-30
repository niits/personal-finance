import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, getBudgetPeriod } from "@/lib/validators";
import { buildIdealLine, buildActualLine } from "@/lib/pace-line";
import { sql } from "kysely";

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const monthParam = request.nextUrl.searchParams.get("month");
  const month = parseMonth(monthParam);
  if (!month) return Errors.validation("Thiếu hoặc sai định dạng tham số month (YYYY-MM)");

  const db = await getKysely();
  const userId = session.user.id;

  const budget = await db
    .selectFrom("monthly_budget")
    .select(["id", "amount"])
    .where("user_id", "=", userId)
    .where("month", "=", month)
    .executeTakeFirst();

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

  const expenses = await db
    .selectFrom("transaction")
    .select([
      sql<number>`CAST(julianday(date) - julianday(${periodStart}) + 1 AS INTEGER)`.as("day"),
      sql<number>`SUM(amount)`.as("total"),
    ])
    .where("user_id", "=", userId)
    .where("type", "=", "expense")
    .where("date", ">=", periodStart)
    .where("date", "<", periodEnd)
    .groupBy(sql`CAST(julianday(date) - julianday(${periodStart}) + 1 AS INTEGER)`)
    .execute();

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
