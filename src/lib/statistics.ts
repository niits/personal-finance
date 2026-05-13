import { z } from "zod";
import { sql } from "kysely";
import { getKysely } from "@/lib/db";
import { runAIObject } from "@/lib/llm";
import { getBudgetPeriod, getBudgetMonthForDate, currentBudgetMonth, currentDate } from "@/lib/validators";

export type Insight = {
  title: string;
  summary: string;
  option: Record<string, unknown>;
};

const InsightSchema = z.object({
  title: z.string(),
  summary: z.string(),
  // z.any() → JSON Schema {} (unconstrained) — required for Llama-4-scout
  // constrained-generation to emit arbitrary ECharts option objects.
  // z.record(z.string(), z.unknown()) incorrectly produces additionalProperties:false.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  option: z.any() as z.ZodType<Record<string, unknown>>,
});

const ReportSchema = z.object({
  insights: z.array(InsightSchema).min(1).max(5),
});

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const pm = m - 1;
  return pm === 0
    ? `${y - 1}-12`
    : `${y}-${String(pm).padStart(2, "0")}`;
}

function resolveCategoryPath(
  catId: number,
  catMap: Map<number, { name: string; level: number; parent_id: number | null }>,
): string {
  const c = catMap.get(catId);
  if (!c) return "Unknown";
  if (c.level === 1) return c.name;
  const p1 = c.parent_id ? catMap.get(c.parent_id) : null;
  if (c.level === 2) return p1 ? `${p1.name} > ${c.name}` : c.name;
  const p2 = p1?.parent_id ? catMap.get(p1.parent_id) : null;
  return [p2?.name, p1?.name, c.name].filter(Boolean).join(" > ");
}

export async function generateStatisticsReport(
  userId: string,
  periodType: "monthly",
  periodKey: string,
): Promise<void> {
  const db = await getKysely();

  const budget = await db
    .selectFrom("monthly_budget")
    .select(["amount", "start_date", "end_date"])
    .where("user_id", "=", userId)
    .where("month", "=", periodKey)
    .executeTakeFirst();

  const computed = getBudgetPeriod(periodKey);
  const periodStart = budget?.start_date ?? computed.start;
  const periodEnd = budget?.end_date ?? (() => {
    const d = new Date(computed.end + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().substring(0, 10);
  })();

  // Clip to yesterday for any period whose window includes today — reports
  // describe completed days only, so the in-progress day is never analysed.
  const today = currentDate();
  const yesterday = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().substring(0, 10);
  })();
  const effectiveEnd = periodEnd < today ? periodEnd : yesterday;
  const now = Math.floor(Date.now() / 1000);

  // Period hasn't started yet (e.g. viewing this month on its first day) — store
  // an empty report so the UI can render an empty state without re-triggering AI.
  if (effectiveEnd < periodStart) {
    await saveReport(db, userId, periodType, periodKey, [], now);
    return;
  }

  const txns = await db
    .selectFrom("transaction")
    .select(["amount", "type", "category_id", "note", "date"])
    .where("user_id", "=", userId)
    .where("date", ">=", periodStart)
    .where("date", "<=", effectiveEnd)
    .orderBy("date", "asc")
    .execute();

  // No data to analyse — skip the LLM call entirely and persist an empty report.
  if (txns.length === 0) {
    await saveReport(db, userId, periodType, periodKey, [], now);
    return;
  }

  const rawCats = await db
    .selectFrom("category")
    .select(["id", "name", "level", "parent_id", "type"])
    .where("user_id", "=", userId)
    .execute();

  const catMap = new Map(rawCats.map((c) => [c.id, c]));

  const priorSummaries = await Promise.all(
    [prevMonthKey(periodKey), prevMonthKey(prevMonthKey(periodKey))].map(async (priorKey) => {
      const pp = getBudgetPeriod(priorKey);
      const pb = await db
        .selectFrom("monthly_budget")
        .select(["start_date", "end_date"])
        .where("user_id", "=", userId)
        .where("month", "=", priorKey)
        .executeTakeFirst();
      const ps = pb?.start_date ?? pp.start;
      const pe = pb?.end_date ?? (() => {
        const d = new Date(pp.end + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().substring(0, 10);
      })();
      const s = await db
        .selectFrom("transaction")
        .select([
          sql<number>`COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0)`.as("total_expense"),
          sql<number>`COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0)`.as("total_income"),
        ])
        .where("user_id", "=", userId)
        .where("date", ">=", ps)
        .where("date", "<=", pe)
        .executeTakeFirst();
      return { key: priorKey, total_expense: s?.total_expense ?? 0, total_income: s?.total_income ?? 0 };
    }),
  );

  const input = {
    period: {
      type: periodType,
      key: periodKey,
      start: periodStart,
      end: effectiveEnd,
      budget_amount: budget?.amount ?? null,
    },
    transactions: txns.map((t) => ({
      date: t.date,
      amount: t.amount,
      type: t.type,
      category: resolveCategoryPath(t.category_id, catMap),
      note: t.note,
    })),
    prior_periods: priorSummaries,
  };

  const system = `Bạn là chuyên gia phân tích tài chính cá nhân. Phân tích dữ liệu chi tiêu và tạo 2–4 insights quan trọng nhất.

Với mỗi insight:
- title: tiêu đề ngắn gọn bằng tiếng Việt
- summary: nhận xét 1–2 câu thực tế bằng tiếng Việt, có con số cụ thể
- option: Apache ECharts 5 option object hoàn chỉnh

Quy tắc ECharts option:
- Chọn chart type tốt nhất cho insight: "pie" (phân bổ danh mục), "bar" (so sánh, ranking), "line" (trend theo ngày/tháng)
- Màu: ["#0066cc","#30d158","#ff453a","#ff9f0a","#bf5af2","#32ade6","#ac8e68"]
- Không set title bên trong option (đã có ở field title bên ngoài)
- Không set width/height cố định
- tooltip.formatter nên hiển thị số tiền kèm ký hiệu ₫ và dùng Intl.NumberFormat vi-VN
- Với pie chart: dùng radius ["35%","65%"] để tạo donut, label.formatter hiển thị tên + %
- Số tiền đơn vị VND (đồng Việt Nam), thường hàng trăm nghìn đến hàng triệu

Chỉ sinh insight có giá trị thực. Nếu data ít (<5 giao dịch), sinh 1–2 insight.`;

  const result = await runAIObject({
    schema: ReportSchema,
    system,
    prompt: JSON.stringify(input),
  });

  await saveReport(db, userId, periodType, periodKey, result.insights, now);
}

async function saveReport(
  db: Awaited<ReturnType<typeof getKysely>>,
  userId: string,
  periodType: "monthly",
  periodKey: string,
  insights: Insight[],
  now: number,
): Promise<void> {
  const payload = JSON.stringify(insights);
  await db
    .insertInto("statistics_report")
    .values({
      user_id: userId,
      period_type: periodType,
      period_key: periodKey,
      insights: payload,
      is_dirty: 0,
      generated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["user_id", "period_type", "period_key"]).doUpdateSet({
        insights: payload,
        is_dirty: 0,
        generated_at: now,
      }),
    )
    .execute();
}

// Called from transaction mutation routes via ctx.waitUntil().
// Only triggers regeneration for completed periods (not current month).
export async function scheduleStatsRegeneration(userId: string, txnDate: string): Promise<void> {
  const affectedMonth = getBudgetMonthForDate(txnDate);
  if (affectedMonth >= currentBudgetMonth()) return;
  await generateStatisticsReport(userId, "monthly", affectedMonth).catch(() => {
    // Silent fail — cron will retry, and mutation response must not be blocked
  });
}
