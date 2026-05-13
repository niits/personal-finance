import { z } from "zod";
import { sql } from "kysely";
import { tool, stepCountIs } from "ai";
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

  const objectiveLine = budget?.objective
    ? `\n\nUser's financial goal this period: "${budget.objective}" — frame recommendations around achieving it.`
    : "";

  const system = `You are a trusted personal finance manager — the user's financial butler. You know their spending intimately and give honest, specific advice.${objectiveLine}

Use the tools to gather data, then call submit_insights with 3–5 insights. Mix insight types:
- "analysis": spending breakdown or trend, always include chart_type + chart_data
- "recommendation": a specific action the user should take (chart optional)
- "alert": anomaly, overspend, or pattern worth flagging (chart optional)

Each insight must have:
- type: "analysis" | "recommendation" | "alert"
- title: concise Vietnamese title
- summary: 1–3 sentences in Vietnamese, cite real numbers and ₫, be direct and specific
- chart_type + chart_data: required for "analysis", optional for others
- evidence: one sentence with the key data point

Chart types: pie = category breakdown, bar = comparison/ranking, line = daily trend

Workflow:
1. Call get_expense_by_category (always)
2. Call get_budget_status if there's a budget set
3. Call get_notable_transactions to find spending with context (notes, large items)
4. Call other tools if needed
5. Call submit_insights — do NOT generate any text response, only call tools`;

  const chartDataSchema = z.array(z.object({ name: z.string(), value: z.number() }));
  let capturedInsights: Insight[] = [];

  const model = await getWorkersAIModel();
  await generateText({
    onStepFinish({ finishReason }) {
      // If the model returns text instead of a tool call, log for debugging
      if (finishReason === "stop" && capturedInsights.length === 0) {
        console.warn("[stats] model stopped without calling submit_insights");
      }
    },
    model,
    stopWhen: stepCountIs(5),
    maxOutputTokens: 2048,
    system,
    prompt: JSON.stringify({
      period: { key: periodKey, start: periodStart, end: effectiveEnd, budget_amount: budget?.amount ?? null },
      prior_periods: priorSummaries,
    }),
    tools: {
      get_expense_by_category: tool({
        description: "Aggregate expenses by category for the period. Returns [{category, total, pct}] sorted by total desc.",
        inputSchema: z.object({}),
        execute: async (_input) => {
          emit?.({ type: "tool_call", tool: "get_expense_by_category", label: "Tổng hợp theo danh mục" });
          const rows = await db
            .selectFrom("transaction")
            .select(["amount", "category_id"])
            .where("user_id", "=", userId)
            .where("date", ">=", periodStart)
            .where("date", "<=", effectiveEnd)
            .where("type", "=", "expense")
            .execute();
          const totals = new Map<string, number>();
          for (const r of rows) {
            const cat = resolveCategoryPath(r.category_id, catMap);
            totals.set(cat, (totals.get(cat) ?? 0) + r.amount);
          }
          const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
          const result = [...totals.entries()]
            .map(([category, total]) => ({ category, total, pct: Math.round((total / grandTotal) * 100) }))
            .sort((a, b) => b.total - a.total);
          emit?.({ type: "tool_result", tool: "get_expense_by_category", rows: result.length });
          return result;
        },
      }),
      get_daily_totals: tool({
        description: "Get daily expense and income totals for the period. Returns [{date, expense, income}].",
        inputSchema: z.object({}),
        execute: async (_input) => {
          emit?.({ type: "tool_call", tool: "get_daily_totals", label: "Xu hướng theo ngày" });
          const rows = await db
            .selectFrom("transaction")
            .select(["date", "amount", "type"])
            .where("user_id", "=", userId)
            .where("date", ">=", periodStart)
            .where("date", "<=", effectiveEnd)
            .orderBy("date", "asc")
            .execute();
          const byDate = new Map<string, { expense: number; income: number }>();
          for (const r of rows) {
            const d = byDate.get(r.date) ?? { expense: 0, income: 0 };
            if (r.type === "expense") d.expense += r.amount;
            else d.income += r.amount;
            byDate.set(r.date, d);
          }
          const result = [...byDate.entries()].map(([date, v]) => ({ date, ...v }));
          emit?.({ type: "tool_result", tool: "get_daily_totals", rows: result.length });
          return result;
        },
      }),
      get_notable_transactions: tool({
        description: "Get transactions with notes or large individual amounts. Useful for citing specific purchases and understanding context behind spending. Returns [{date, amount, category, note, type}].",
        inputSchema: z.object({
          filter: z.enum(["has_note", "large", "all"]).describe("has_note: only with notes, large: top 10 by amount, all: both"),
          limit: z.number().int().min(1).max(30).default(15),
        }),
        execute: async (input) => {
          const { filter, limit } = input;
          emit?.({ type: "tool_call", tool: "get_notable_transactions", label: `Giao dịch đáng chú ý (${filter})` });
          let query = db
            .selectFrom("transaction")
            .select(["date", "amount", "category_id", "note", "type"])
            .where("user_id", "=", userId)
            .where("date", ">=", periodStart)
            .where("date", "<=", effectiveEnd);
          if (filter === "has_note") query = query.where("note", "is not", null);
          const rows = await query.orderBy("amount", "desc").limit(limit).execute();
          const result = rows.map((r) => ({
            date: r.date,
            amount: r.amount,
            category: resolveCategoryPath(r.category_id, catMap),
            note: r.note ?? null,
            type: r.type,
          }));
          emit?.({ type: "tool_result", tool: "get_notable_transactions", rows: result.length });
          return result;
        },
      }),
      get_budget_status: tool({
        description: "Get current budget usage: total expense, total income, budget amount, days elapsed vs total, and daily pace.",
        inputSchema: z.object({}),
        execute: async (_input) => {
          emit?.({ type: "tool_call", tool: "get_budget_status", label: "Trạng thái ngân sách" });
          const agg = await db
            .selectFrom("transaction")
            .select([
              sql<number>`COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0)`.as("total_expense"),
              sql<number>`COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0)`.as("total_income"),
              sql<number>`COUNT(*)`.as("tx_count"),
            ])
            .where("user_id", "=", userId)
            .where("date", ">=", periodStart)
            .where("date", "<=", effectiveEnd)
            .executeTakeFirst();
          const start = new Date(periodStart + "T00:00:00Z");
          const end = new Date(effectiveEnd + "T00:00:00Z");
          const today = new Date(currentDate() + "T00:00:00Z");
          const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
          const elapsedDays = Math.min(totalDays, Math.round((today.getTime() - start.getTime()) / 86400000) + 1);
          const totalExpense = agg?.total_expense ?? 0;
          const dailyPace = elapsedDays > 0 ? Math.round(totalExpense / elapsedDays) : 0;
          const projectedTotal = dailyPace * totalDays;
          const result = {
            total_expense: totalExpense,
            total_income: agg?.total_income ?? 0,
            tx_count: agg?.tx_count ?? 0,
            budget_amount: budget?.amount ?? null,
            budget_used_pct: budget?.amount ? Math.round((totalExpense / budget.amount) * 100) : null,
            days_elapsed: elapsedDays,
            days_total: totalDays,
            daily_pace: dailyPace,
            projected_total: projectedTotal,
          };
          emit?.({ type: "tool_result", tool: "get_budget_status", rows: 1 });
          return result;
        },
      }),
      submit_insights: tool({
        description: "Submit the final insights. Call exactly once. Do NOT output any text — only call this tool.",
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
          emit?.({ type: "tool_call", tool: "submit_insights", label: `Tổng hợp ${input.insights.length} nhận xét` });
          capturedInsights = input.insights;
          emit?.({ type: "tool_result", tool: "submit_insights", rows: capturedInsights.length });
          return { ok: true };
        },
      }),
    },
  });

  if (capturedInsights.length === 0) throw new Error("Agent did not call submit_insights");

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
