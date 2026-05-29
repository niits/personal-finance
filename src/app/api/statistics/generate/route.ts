import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { generateStatisticsReport } from "@/lib/statistics";
import { currentBudgetMonth } from "@/lib/validators";

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// Two callers are supported:
//   1. Scheduler worker — Bearer CRON_SECRET — generates stats for all eligible users.
//   2. Authenticated user — session cookie — generates stats only for themselves.
export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && auth === `Bearer ${secret}`) {
    // Scheduler path: generate for all users missing a clean report last month.
    const targetMonth = prevMonthKey(currentBudgetMonth());
    const db = await getKysely();

    const targets = await db
      .selectFrom("monthly_budget as mb")
      .select("mb.user_id")
      .where("mb.month", "=", targetMonth)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("statistics_report as sr")
              .select("sr.id")
              .whereRef("sr.user_id", "=", "mb.user_id")
              .where("sr.period_type", "=", "monthly")
              .where("sr.period_key", "=", targetMonth)
              .where("sr.is_dirty", "=", 0),
          ),
        ),
      )
      .execute();

    const results = await Promise.allSettled(
      targets.map((t) => generateStatisticsReport(t.user_id, "monthly", targetMonth)),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return Response.json({ target_month: targetMonth, succeeded, failed });
  }

  // User path: require a valid session and generate only for the current user.
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const targetMonth = prevMonthKey(currentBudgetMonth());
  await generateStatisticsReport(session.user.id, "monthly", targetMonth);

  return Response.json({ target_month: targetMonth, succeeded: 1, failed: 0 });
}
