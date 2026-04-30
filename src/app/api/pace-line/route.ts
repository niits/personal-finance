import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth } from "@/lib/validators";
import { getDaysInMonth, buildIdealLine, buildActualLine } from "@/lib/pace-line";

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

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = getDaysInMonth(year, monthNum);
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === monthNum;
  const todayDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const { results: expenses } = await db
    .prepare(
      `SELECT CAST(substr(date, 9, 2) AS INTEGER) as day, SUM(amount) as total
       FROM "transaction"
       WHERE user_id = ? AND type = 'expense' AND date LIKE ?
       GROUP BY day`,
    )
    .bind(userId, `${month}-%`)
    .all<{ day: number; total: number }>();

  const dailyMap = new Map(expenses.map((e) => [e.day, e.total]));

  return Response.json({
    month,
    budget_amount: budget.amount,
    days_in_month: daysInMonth,
    today_day: todayDay,
    ideal_line: buildIdealLine(budget.amount, daysInMonth),
    actual_line: buildActualLine(dailyMap, todayDay),
  });
}
