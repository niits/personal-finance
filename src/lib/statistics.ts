import { z } from "zod";
import { sql } from "kysely";
import { tool, stepCountIs } from "ai";
import { getKysely } from "@/lib/db";
import { runAIObject, getWorkersAIModel, generateText } from "@/lib/llm";
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

  // ── Pre-compute data that tools will serve on demand ──────────────────────
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

  // ── Schemas ────────────────────────────────────────────────────────────────
  const chartDatumSchema = z.object({
    name: z.string().describe("Category label or ISO date — never the key 'category'"),
    value: z.number().describe("Raw numeric amount (no formatting, no units)"),
    series: z.string().optional().describe("Group label, only for bar_grouped"),
  });

  const insightItemSchema = z.object({
    type: z.enum(["analysis", "recommendation", "alert"]),
    title: z.string().max(60).describe("Specific Vietnamese headline, max 45 chars"),
    summary: z.string().max(220).describe("One-sentence Vietnamese caption, ≤160 chars"),
    chart_type: z.enum(["pie", "bar", "bar_grouped", "line"]).optional()
      .describe("Required for 'analysis' and numeric 'alert'."),
    chart_data: z.array(chartDatumSchema).optional()
      .describe("Structured rows for the chart. Required whenever chart_type is set."),
    value_unit: z.enum(["currency", "percent", "count"]).optional(),
  });

  const insightSchema = z.object({
    insights: z.array(insightItemSchema).min(1).max(5),
  });

  const objectiveLine = budget?.objective
    ? `\nUser's financial goal: "${budget.objective}" — frame recommendations around achieving this.`
    : "";

  const SYSTEM = `You are a trusted personal finance advisor.${objectiveLine}

You have tools to fetch spending data. Use them to explore the data, then call generate_insights with your findings.

IMPORTANT: You MUST call tools first before generate_insights. Call at least:
- get_budget_status
- get_expense_by_category
Then call generate_insights with 3–5 insights based on what you found.

## Insight rules
- Title = THE TAKEAWAY (max 45 chars, Vietnamese). State what the data MEANS, not what it shows.
  ❌ "Chi tiêu theo danh mục" ✅ "Ăn uống chiếm 35% — tăng 12% so tháng trước"
- Summary = adds context the chart cannot show (max 160 chars, Vietnamese)
- Never use pie charts — use bar (sorted desc) instead
- chart_data values are raw integers, no formatting
- Cap bar charts at 5 rows, group tail as "Khác"
- For bar chart names: ≤ 12 chars, abbreviate if needed`;

  // ── Real tool-calling loop ─────────────────────────────────────────────────
  let capturedInsights: Insight[] | null = null as Insight[] | null;
  const model = await getWorkersAIModel();

  try {
    await generateText({
      model,
      system: SYSTEM,
      stopWhen: stepCountIs(8),
      maxOutputTokens: 16000,
      prompt: `Analyze spending for period ${periodKey} (${periodStart} to ${effectiveEnd}). Prior months for context: ${JSON.stringify(priorSummaries)}`,
      tools: {
        get_budget_status: tool({
          description: "Get budget and overall spending summary for the period",
          inputSchema: z.object({}),
          outputSchema: z.unknown(),
          execute: async () => {
            emit?.({ type: "tool_call", tool: "get_budget_status", label: "Tổng quan ngân sách" });
            emit?.({ type: "tool_result", tool: "get_budget_status", rows: 1 });
            return { period: { key: periodKey, start: periodStart, end: effectiveEnd }, ...budgetStatus };
          },
        }),
        get_expense_by_category: tool({
          description: "Get expense totals grouped by category, sorted by amount descending",
          inputSchema: z.object({}),
          outputSchema: z.unknown(),
          execute: async () => {
            emit?.({ type: "tool_call", tool: "get_expense_by_category", label: "Chi tiêu theo danh mục" });
            const result = expenseByCategory.slice(0, 12);
            emit?.({ type: "tool_result", tool: "get_expense_by_category", rows: result.length });
            return result;
          },
        }),
        get_notable_transactions: tool({
          description: "Get top transactions by amount for the period",
          inputSchema: z.object({}),
          outputSchema: z.unknown(),
          execute: async () => {
            emit?.({ type: "tool_call", tool: "get_notable_transactions", label: "Giao dịch đáng chú ý" });
            const result = notableTransactions.slice(0, 12);
            emit?.({ type: "tool_result", tool: "get_notable_transactions", rows: result.length });
            return result;
          },
        }),
        get_daily_trend: tool({
          description: "Get daily expense and income totals for the period",
          inputSchema: z.object({}),
          outputSchema: z.unknown(),
          execute: async () => {
            emit?.({ type: "tool_call", tool: "get_daily_trend", label: "Xu hướng chi tiêu theo ngày" });
            const result = dailyTrend.slice(-20);
            emit?.({ type: "tool_result", tool: "get_daily_trend", rows: result.length });
            return result;
          },
        }),
        generate_insights: tool({
          description: "Generate the final structured finance report with 3-5 insights. Call this LAST after fetching data.",
          inputSchema: insightSchema,
          outputSchema: z.object({ status: z.string(), count: z.number() }),
          execute: async (args) => {
            capturedInsights = (args as z.infer<typeof insightSchema>).insights as Insight[];
            emit?.({ type: "tool_call", tool: "generate_insights", label: "Tổng hợp nhận xét" });
            emit?.({ type: "tool_result", tool: "generate_insights", rows: capturedInsights.length });
            return { status: "saved", count: capturedInsights.length };
          },
        }),
      },
      onStepFinish({ stepNumber, toolCalls, finishReason, text }) {
        // Debug: log each step to diagnose if the model skips tool calling
        console.log("[stats-agent] step", {
          stepNumber,
          finishReason,
          toolCalls: toolCalls.map((tc) => tc.toolName),
          hasText: !!text?.trim(),
        });
      },
    });
  } catch (agentErr) {
    console.error("[stats-agent] generateText error:", agentErr);
    // Fall through to fallback below — don't rethrow yet
  }

  // ── Fallback: if agent didn't call generate_insights, use pre-fetched data ─
  // This handles "lazy" Llama behavior where it answers in text instead of tools.
  if (!capturedInsights || capturedInsights.length === 0) {
    console.warn("[stats-agent] no insights from tool-calling — falling back to generateObject");
    emit?.({ type: "tool_call", tool: "analyze", label: "AI đang phân tích (fallback)" });

    const fallbackResult = await runAIObject({
      schema: insightSchema,
      schemaName: "FinanceInsightsReport",
      schemaDescription: "A structured personal finance report with 3–5 insights.",
      system: SYSTEM,
      traceName: "statistics-insights-fallback",
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

    capturedInsights = fallbackResult.insights;
    emit?.({ type: "tool_result", tool: "analyze", rows: capturedInsights.length });
  }

  if (!capturedInsights || capturedInsights.length === 0) {
    throw new Error("AI không tạo được nhận xét — thử lại sau");
  }

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
