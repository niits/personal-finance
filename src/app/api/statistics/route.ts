import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, currentBudgetMonth } from "@/lib/validators";
import { generateStatisticsReport } from "@/lib/statistics";
import type { Insight } from "@/lib/statistics";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (!session) return Errors.unauthorized();

    const periodKey = parseMonth(request.nextUrl.searchParams.get("period_key"));
    if (!periodKey) return Errors.validation("period_key phải có dạng YYYY-MM");

    const db = await getKysely();
    const row = await db
      .selectFrom("statistics_report")
      .select(["insights", "is_dirty", "generated_at"])
      .where("user_id", "=", session.user.id)
      .where("period_type", "=", "monthly")
      .where("period_key", "=", periodKey)
      .executeTakeFirst();

    const isCurrentPeriod = periodKey === currentBudgetMonth();

    if (!row) return Response.json({ found: false, period_key: periodKey, is_current_period: isCurrentPeriod }, { status: 404 });

    const insights = JSON.parse(row.insights) as Insight[];

    return Response.json(
      {
        found: true,
        period_key: periodKey,
        period_type: "monthly",
        insights,
        is_dirty: row.is_dirty === 1,
        is_current_period: isCurrentPeriod,
        generated_at: row.generated_at,
      },
      // Cache headers stay short for current-period reports; the client also forces
      // a daily refresh via POST when generated_at falls on a previous day.
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (e) {
    return Errors.internal(e);
  }
}

// User-triggered generation — blocks until AI finishes (~3-6s), or returns instantly
// when there are no transactions to analyse. Current period allowed (data is clipped
// to yesterday inside generateStatisticsReport); only future periods are rejected.
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (!session) return Errors.unauthorized();

    const periodKey = parseMonth(request.nextUrl.searchParams.get("period_key"));
    if (!periodKey) return Errors.validation("period_key phải có dạng YYYY-MM");

    if (periodKey > currentBudgetMonth()) {
      return Errors.validation("Không thể tạo thống kê cho tháng tương lai");
    }

    await generateStatisticsReport(session.user.id, "monthly", periodKey);

    const db = await getKysely();
    const row = await db
      .selectFrom("statistics_report")
      .select(["insights", "generated_at"])
      .where("user_id", "=", session.user.id)
      .where("period_type", "=", "monthly")
      .where("period_key", "=", periodKey)
      .executeTakeFirst();

    if (!row) throw new Error("Statistics report missing after generation");

    const insights = JSON.parse(row.insights) as Insight[];

    return Response.json({
      found: true,
      period_key: periodKey,
      period_type: "monthly",
      insights,
      is_dirty: false,
      is_current_period: periodKey === currentBudgetMonth(),
      generated_at: row.generated_at,
    });
  } catch (e) {
    return Errors.internal(e);
  }
}
