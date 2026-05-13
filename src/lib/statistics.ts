import { z } from "zod";
import { sql } from "kysely";
import { tool } from "ai";
import { getKysely } from "@/lib/db";
import { getWorkersAIModel, generateText } from "@/lib/llm";
import { getBudgetPeriod, getBudgetMonthForDate, currentBudgetMonth, currentDate } from "@/lib/validators";

export type InsightType = "analysis" | "recommendation" | "alert";

export type Insight = {
  type?: InsightType;
  title: string;
  summary: string;
  chart_type?: "pie" | "bar" | "line";
  chart_data?: { name: string; value: number }[];
  evidence?: string;
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

  // ── Step 2: Single model call — model has all data, only needs to call submit_insights ──
  emit?.({ type: "tool_call", tool: "analyze", label: "AI đang phân tích và tổng hợp" });

  const objectiveLine = budget?.objective
    ? `\n\nUser's financial goal: "${budget.objective}" — frame recommendations around achieving this.`
    : "";

  const system = `You are a trusted personal finance manager — the user's financial butler. You have been given all the spending data for this period. Your job is to call submit_insights with 3–5 genuinely useful insights.${objectiveLine}

Insight types (mix them):
- "analysis": data-backed spending breakdown or trend — MUST include chart_type + chart_data
- "recommendation": specific action the user should take — chart optional
- "alert": overspending, anomaly, or behavior worth flagging — chart optional

Each insight must have:
- type: "analysis" | "recommendation" | "alert"
- title: concise Vietnamese title (max 40 chars)
- summary: 1–3 Vietnamese sentences, cite real ₫ amounts, be direct and specific
- evidence: one key data sentence
- chart_type (if "analysis"): "pie" = category breakdown, "bar" = comparison, "line" = daily trend
- chart_data (if chart_type set): [{name: string, value: number}] — use the exact numbers from the data

IMPORTANT: Call submit_insights exactly once. Do not output any text response.`;

  const chartDataSchema = z.array(z.object({ name: z.string(), value: z.number() }));
  let capturedInsights: Insight[] = [];

  const model = await getWorkersAIModel();
  await generateText({
    model,
    maxOutputTokens: 2048,
    system,
    prompt: JSON.stringify({
      period: { key: periodKey, start: periodStart, end: effectiveEnd },
      budget_status: budgetStatus,
      expense_by_category: expenseByCategory,
      notable_transactions: notableTransactions.slice(0, 15),
      daily_trend: dailyTrend,
      prior_periods: priorSummaries,
    }),
    tools: {
      submit_insights: tool({
        description: "Submit the final structured insights. Call this exactly once.",
        inputSchema: z.object({
          insights: z.array(
            z.object({
              type: z.enum(["analysis", "recommendation", "alert"]).default("analysis"),
              title: z.string(),
              summary: z.string(),
              chart_type: z.enum(["pie", "bar", "line"]).optional(),
              chart_data: chartDataSchema.optional(),
              evidence: z.string(),
            }),
          ).min(1).max(5),
        }),
        execute: async (input) => {
          capturedInsights = input.insights;
          emit?.({ type: "tool_result", tool: "analyze", rows: capturedInsights.length });
          return { ok: true };
        },
      }),
    },
  });

  if (capturedInsights.length === 0) throw new Error("Model did not call submit_insights — try regenerating");

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
