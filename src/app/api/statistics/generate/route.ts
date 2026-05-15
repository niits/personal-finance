import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { generateStatisticsReport } from "@/lib/statistics";
import { currentBudgetMonth } from "@/lib/validators";

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// Called by the scheduler worker after each day ends.
// Generates monthly stats for the previous budget month for all eligible users.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Not configured" }, { status: 500 });

  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetMonth = prevMonthKey(currentBudgetMonth());
  const db = await getKysely();

  // Find all users who have a monthly_budget for the target month but no clean report yet
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
