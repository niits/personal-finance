import { z } from "zod";
import { sql } from "kysely";
import { getKysely } from "@/lib/db";
import { runAIObject } from "@/lib/llm";
import { getBudgetPeriod, getBudgetMonthForDate, currentBudgetMonth, currentDate } from "@/lib/validators";

export type InsightType = "analysis" | "recommendation" | "alert";

export type ChartType = "pie" | "bar" | "line" | "bar_grouped";

export type ChartDatum = { name: string; value: number; series?: string };

export type Insight = {
  type?: InsightType;
  title: string;
  summary: string;
  chart_type?: ChartType;
  chart_data?: ChartDatum[];
  value_unit?: "currency" | "percent" | "count";
};

export type AgentEvent =
  | { type: "tool_call"; tool: string; label: string }
  | { type: "tool_result"; tool: string; rows: number }
  | { type: "done" }
  | { type: "error"; message: string };

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
  emit?: (event: AgentEvent) => void,
): Promise<void> {
  const db = await getKysely();

  const budget = await db
    .selectFrom("monthly_budget")
    .select(["amount", "start_date", "end_date", "objective"])
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

  // ── Step 1: Pre-fetch all data (emit live events so UI shows progress) ──────
  emit?.({ type: "tool_call", tool: "get_expense_by_category", label: "Tổng hợp chi tiêu theo danh mục" });
  const allTxRows = await db
    .selectFrom("transaction")
    .select(["amount", "category_id", "type", "date", "note"])
    .where("user_id", "=", userId)
    .where("date", ">=", periodStart)
    .where("date", "<=", effectiveEnd)
    .orderBy("date", "asc")
    .execute();

  const expenseTotals = new Map<string, number>();
  const byDate = new Map<string, { expense: number; income: number }>();
  let grandExpense = 0;
  let grandIncome = 0;
  for (const r of allTxRows) {
    const d = byDate.get(r.date) ?? { expense: 0, income: 0 };
    if (r.type === "expense") {
      d.expense += r.amount;
      grandExpense += r.amount;
      const cat = resolveCategoryPath(r.category_id, catMap);
      expenseTotals.set(cat, (expenseTotals.get(cat) ?? 0) + r.amount);
    } else {
      d.income += r.amount;
      grandIncome += r.amount;
    }
    byDate.set(r.date, d);
  }

  const grandTotal = grandExpense || 1;
  const expenseByCategory = [...expenseTotals.entries()]
    .map(([category, total]) => ({ category, total, pct: Math.round((total / grandTotal) * 100) }))
    .sort((a, b) => b.total - a.total);
  emit?.({ type: "tool_result", tool: "get_expense_by_category", rows: expenseByCategory.length });

  emit?.({ type: "tool_call", tool: "get_notable_transactions", label: "Giao dịch đáng chú ý" });
  const notableTransactions = allTxRows
    .filter((r) => r.note || r.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20)
    .map((r) => ({
      date: r.date,
      amount: r.amount,
      type: r.type,
      category: resolveCategoryPath(r.category_id, catMap),
      note: r.note ?? null,
    }));
  emit?.({ type: "tool_result", tool: "get_notable_transactions", rows: notableTransactions.length });

  // Budget status
  const startD = new Date(periodStart + "T00:00:00Z");
  const endD = new Date(effectiveEnd + "T00:00:00Z");
  const todayD = new Date(currentDate() + "T00:00:00Z");
  const totalDays = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
  const elapsedDays = Math.min(totalDays, Math.round((todayD.getTime() - startD.getTime()) / 86400000) + 1);
  const dailyPace = elapsedDays > 0 ? Math.round(grandExpense / elapsedDays) : 0;
  const budgetStatus = {
    total_expense: grandExpense,
    total_income: grandIncome,
    tx_count: allTxRows.length,
    budget_amount: budget?.amount ?? null,
    budget_used_pct: budget?.amount ? Math.round((grandExpense / budget.amount) * 100) : null,
    days_elapsed: elapsedDays,
    days_total: totalDays,
    daily_pace: dailyPace,
    projected_total: dailyPace * totalDays,
  };

  const dailyTrend = [...byDate.entries()].map(([date, v]) => ({ date, ...v }));

  // ── Step 2: Single model call using structured output (no tool calling needed) ──
  emit?.({ type: "tool_call", tool: "analyze", label: "AI đang phân tích và tổng hợp" });

  const objectiveLine = budget?.objective
    ? `\n\nUser's financial goal: "${budget.objective}" — frame recommendations around achieving this.`
    : "";

  const system = `You are a trusted personal finance advisor. You have full spending data for one period. Your job is to tell a clear, honest story about the user's money — not just list facts.${objectiveLine}

## Your output: 3–5 insights that form a story arc

Structure the insights as a narrative:
1. **Setup** — What happened overall? (total spend, pace vs budget, vs prior months)
2. **Finding(s)** — What is the most important pattern, surprise, or concentration? (1–2 insights)
3. **Alert** — Is anything over budget or accelerating dangerously? (only if true, do not fabricate)
4. **Action** — One concrete recommendation the user can act on this week

Do not produce generic or obvious observations ("you spent money on food"). Every insight must be specific to the numbers in the data.

## Insight types

- "analysis" — data-backed breakdown or trend → chart REQUIRED
- "alert" — overspending, anomaly, threshold breach → chart REQUIRED if numeric
- "recommendation" — one concrete next action → chart only if it strengthens the point

## Title rule: THE TITLE IS THE TAKEAWAY, NOT A DESCRIPTION

The title must state the insight — what the data means, not what it shows.

❌ Bad (describes the chart): "Chi tiêu theo danh mục tháng 5"
❌ Bad (obvious): "Ăn uống là khoản chi lớn"
✅ Good (states the finding): "Ăn uống chiếm 35% — tăng 12% so với tháng trước"
✅ Good (adds significance): "Đã dùng 83% ngân sách — còn 14 ngày"
✅ Good (actionable alert): "Mua sắm tăng gấp đôi — vượt ngân sách 1,2 triệu ₫"

Max 45 characters.

## Summary rule: add what the chart cannot show

The chart carries the numbers. The summary adds context the chart cannot: comparison to prior period, reason, implication, or urgency.

❌ Bad (repeats chart): "Ăn uống là khoản lớn nhất, kế đến là Cho tặng."
✅ Good (adds context): "Tăng 12% so với tháng 4, chủ yếu do ăn ngoài cuối tuần."
✅ Good (adds implication): "Với đà này, tổng chi sẽ vượt ngân sách khoảng 2,1 triệu ₫."

Max 160 characters. Format numbers as Vietnamese: thousand separator "." decimal "," (e.g. "3.016.320 ₫", "23,45%").

## Chart selection

**Never use pie.** A horizontal bar sorted by value is always clearer. Pie charts make angle comparisons impossible; bars make size comparisons instant.

| Situation | Use | Notes |
|---|---|---|
| Category breakdown (any N categories) | "bar" — sorted descending | Largest category = top bar; horizontal layout, one color |
| Forecast / projection over time (daily pace, future estimate) | "line" — name = ISO date "YYYY-MM-DD" | Use "line" for anything that shows change over time or a predicted trajectory |
| Historical trend over time | "line" — name = ISO date "YYYY-MM-DD" | Fill missing days with 0 |
| Period-over-period change (month vs month, same category across months) | "bar_grouped" — name = period label, series = category | Multiple months as rows, each category as a series |
| Actual vs single limit / budget / average | "bar_grouped" — series "Thực tế" for actual, series **exactly** "Ngân sách", "Giới hạn", or "Trung bình" for the reference | Renderer draws actual as bar + reference as a vertical rule line — Apple-style threshold marker |

For "bar": sort chart_data by value descending. Cap at 5 rows; group the tail as "Khác".
For "bar_grouped" with a reference series: include exactly ONE entry with the reference series — the renderer converts it to a vertical threshold rule, not a second bar.
For "bar_grouped" multi-period: include data for every period even if zero, so the axis is evenly spaced.

## Data rules

- chart_data values are RAW integers from the input (no formatting, no units)
- Each row: { "name": string, "value": number, "series"?: string } — never use "category" as a key
- value_unit: "currency" for ₫, "percent" for 0–100 values, "count" for counts
- Use exact numbers from the input — never round aggressively, never fabricate
- Cap at 5 entries; group the tail as "Khác" with the summed remainder
- For bar charts: keep each "name" ≤ 12 characters — abbreviate long Vietnamese labels so they fit on a 375 px phone screen (e.g. "Hoá đơn & dịch vụ" → "Hoá đơn", "Mua sắm & tiêu dùng" → "Mua sắm")
- For line charts: use every date in the range; fill missing days with 0

## Examples of well-formed insights

Example 1 — category breakdown (bar, sorted descending, title = takeaway):
{
  "type": "analysis",
  "title": "Ăn uống chiếm 35% — tăng 12% so tháng 4",
  "summary": "Tăng chủ yếu từ ăn ngoài cuối tuần — 8 giao dịch nhà hàng trên 200.000 ₫.",
  "chart_type": "bar",
  "chart_data": [
    { "name": "Ăn uống", "value": 3016320 },
    { "name": "Cho tặng", "value": 2250000 },
    { "name": "Hoá đơn & dịch vụ", "value": 1751000 },
    { "name": "Khác", "value": 1321328 }
  ],
  "value_unit": "currency"
}

Example 2 — budget alert with projection:
{
  "type": "alert",
  "title": "Đã dùng 83% ngân sách — còn 14 ngày",
  "summary": "Với tốc độ 412.000 ₫/ngày, tổng chi dự kiến vượt ngân sách 1,8 triệu ₫.",
  "chart_type": "bar_grouped",
  "chart_data": [
    { "name": "Đã chi", "value": 12413228, "series": "Thực tế" },
    { "name": "Ngân sách", "value": 15000000, "series": "Ngân sách" }
  ],
  "value_unit": "currency"
}

Example 3 — line trend:
{
  "type": "analysis",
  "title": "Chi tiêu tăng mạnh từ tuần thứ 3",
  "summary": "3 ngày cuối tháng chiếm 28% tổng chi — chủ yếu mua sắm và giải trí.",
  "chart_type": "line",
  "chart_data": [
    { "name": "2026-05-01", "value": 150000 },
    { "name": "2026-05-02", "value": 0 },
    { "name": "2026-05-03", "value": 320000 }
  ],
  "value_unit": "currency"
}

Example 4 — month-over-month comparison (Trend Alert template):
{
  "type": "alert",
  "title": "Mua sắm tăng gấp đôi — xu hướng 3 tháng liên tiếp",
  "summary": "Nếu tiếp tục, mua sắm sẽ chiếm 40% ngân sách vào tháng 7. Cân nhắc đặt hạn mức danh mục.",
  "chart_type": "bar_grouped",
  "chart_data": [
    { "name": "Tháng 3", "value": 800000, "series": "Mua sắm" },
    { "name": "Tháng 4", "value": 1200000, "series": "Mua sắm" },
    { "name": "Tháng 5", "value": 1900000, "series": "Mua sắm" }
  ],
  "value_unit": "currency"
}`;

  const chartDatumSchema = z.object({
    name: z.string().describe("Category label or ISO date — never the key 'category'"),
    value: z.number().describe("Raw numeric amount (no formatting, no units)"),
    series: z.string().optional().describe("Group label, only for bar_grouped"),
  });

  const insightSchema = z.object({
    insights: z.array(
      z.object({
        type: z.enum(["analysis", "recommendation", "alert"]),
        title: z.string().max(60).describe("Specific Vietnamese headline, max 40 chars"),
        summary: z.string().max(220).describe("One-sentence Vietnamese caption, ≤220 chars"),
        chart_type: z.enum(["pie", "bar", "bar_grouped", "line"]).optional()
          .describe("Required for 'analysis' and numeric 'alert'. Omit only if chart truly does not apply."),
        chart_data: z.array(chartDatumSchema).optional()
          .describe("Structured rows for the chart. Required whenever chart_type is set."),
        value_unit: z.enum(["currency", "percent", "count"]).optional(),
      }),
    ).min(1).max(5),
  });

  const result = await runAIObject({
    schema: insightSchema,
    schemaName: "FinanceInsightsReport",
    schemaDescription: "A structured personal finance report with 3–5 insights, each pairing a Vietnamese caption with a chart spec.",
    system,
    traceName: "statistics-insights",
    userId,
    maxOutputTokens: 16000,
    prompt: JSON.stringify({
      period: { key: periodKey, start: periodStart, end: effectiveEnd },
      budget_status: budgetStatus,
      expense_by_category: expenseByCategory.slice(0, 12),
      notable_transactions: notableTransactions.slice(0, 12),
      daily_trend: dailyTrend.slice(-20),
      prior_periods: priorSummaries,
    }),
  });

  const capturedInsights: Insight[] = result.insights;
  emit?.({ type: "tool_result", tool: "analyze", rows: capturedInsights.length });

  if (capturedInsights.length === 0) throw new Error("AI không tạo được nhận xét — thử lại sau");

  await saveReport(db, userId, periodType, periodKey, capturedInsights, now);
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
