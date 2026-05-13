import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, currentBudgetMonth } from "@/lib/validators";
import { generateStatisticsReport } from "@/lib/statistics";
import type { Insight } from "@/lib/statistics";

export async function GET(request: NextRequest) {
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

  if (!row) return Response.json({ found: false, period_key: periodKey }, { status: 404 });

  let insights: Insight[] = [];
  try { insights = JSON.parse(row.insights) as Insight[]; } catch { return Errors.internal(); }

  return Response.json(
    { found: true, period_key: periodKey, period_type: "monthly", insights, is_dirty: row.is_dirty === 1, generated_at: row.generated_at },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}

// User-triggered generation — blocks until AI finishes (~3-6s).
// Only allowed for periods that have already ended.
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const periodKey = parseMonth(request.nextUrl.searchParams.get("period_key"));
  if (!periodKey) return Errors.validation("period_key phải có dạng YYYY-MM");

  if (periodKey >= currentBudgetMonth()) {
    return Errors.validation("Chỉ tạo thống kê cho tháng đã kết thúc");
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

  if (!row) return Errors.internal();

  let insights: Insight[] = [];
  try { insights = JSON.parse(row.insights) as Insight[]; } catch { return Errors.internal(); }

  return Response.json({ found: true, period_key: periodKey, period_type: "monthly", insights, is_dirty: false, generated_at: row.generated_at });
}
