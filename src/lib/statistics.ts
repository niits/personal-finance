import { z } from "zod";
import { sql } from "kysely";
import { tool, stepCountIs } from "ai";
import { getKysely } from "@/lib/db";
import { getWorkersAIModel, generateText } from "@/lib/llm";
import { getBudgetPeriod, getBudgetMonthForDate, currentBudgetMonth, currentDate } from "@/lib/validators";

export type Insight = {
  title: string;
  summary: string;
  chart_type: "pie" | "bar" | "line";
  chart_data: { name: string; value: number }[];
  evidence?: string;
};

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
    ? `\nUser's financial objective: "${budget.objective}" — align insights to help achieve this.`
    : "";

  const system = `You are a personal finance analyst. Use the tools to query spending data, then call submit_insights with 2–4 of the most valuable insights.${objectiveLine}

Each insight must have:
- title: short Vietnamese title
- summary: 1–2 sentences in Vietnamese with specific numbers and ₫
- chart_type: "pie" (category breakdown) | "bar" (comparison/ranking) | "line" (daily trend)
- chart_data: [{name, value}] — the actual data points
- evidence: one sentence citing the key numbers behind this insight

Workflow: call get_expense_by_category first, then other tools if useful, then call submit_insights once.`;

  const chartDataSchema = z.array(z.object({ name: z.string(), value: z.number() }));
  let capturedInsights: Insight[] = [];

  const model = await getWorkersAIModel();
  await generateText({
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
          return [...totals.entries()]
            .map(([category, total]) => ({ category, total, pct: Math.round((total / grandTotal) * 100) }))
            .sort((a, b) => b.total - a.total);
        },
      }),
      get_daily_totals: tool({
        description: "Get daily expense and income totals for the period. Returns [{date, expense, income}].",
        inputSchema: z.object({}),
        execute: async (_input) => {
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
          return [...byDate.entries()].map(([date, v]) => ({ date, ...v }));
        },
      }),
      get_top_expenses: tool({
        description: "Get top N individual expense transactions by amount.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(20) }),
        execute: async (input) => {
          const { limit } = input;
          const rows = await db
            .selectFrom("transaction")
            .select(["date", "amount", "category_id", "note"])
            .where("user_id", "=", userId)
            .where("date", ">=", periodStart)
            .where("date", "<=", effectiveEnd)
            .where("type", "=", "expense")
            .orderBy("amount", "desc")
            .limit(limit)
            .execute();
          return rows.map((r) => ({
            date: r.date,
            amount: r.amount,
            category: resolveCategoryPath(r.category_id, catMap),
            note: r.note,
          }));
        },
      }),
      submit_insights: tool({
        description: "Submit the final insights. Call exactly once when you have enough data.",
        inputSchema: z.object({
          insights: z.array(
            z.object({
              title: z.string(),
              summary: z.string(),
              chart_type: z.enum(["pie", "bar", "line"]),
              chart_data: chartDataSchema,
              evidence: z.string(),
            }),
          ).min(1).max(4),
        }),
        execute: async (input) => {
          const { insights } = input;
          capturedInsights = insights;
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
