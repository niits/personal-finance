import { z } from "zod";
import { sql } from "kysely";
import { tool, stepCountIs } from "ai";
import { getKysely } from "@/lib/db";
import { getOpenAIModel, generateText } from "@/lib/llm";
import { getBudgetPeriod, currentDate } from "@/lib/validators";
import { createAnalyticsService } from "@/lib/analytics/service";
import { METRIC_NAMES, METRIC_CATALOG, DIMENSION_NAMES, TIME_GRAINS } from "@/lib/analytics/metrics";
import { getBudgetMonthForDate, currentBudgetMonth } from "@/lib/validators";

// Hoisted to module scope: Intl constructors allocate per-call, so reuse one instance.
const _vndFormat = new Intl.NumberFormat("vi-VN");

export type InsightType = "analysis" | "recommendation" | "alert";

export type ChartType = "pie" | "bar" | "line" | "bar_grouped" | "forecast_line";

export type ForecastMeta = {
  period_start: string;
  today: string;
  next_period_start: string;
};

export type ChartDatum = { name: string; value: number; series?: string };

export type Insight = {
  type?: InsightType;
  title: string;
  summary: string;
  chart_type?: ChartType;
  chart_data?: ChartDatum[];
  value_unit?: "currency" | "percent" | "count";
  forecast_meta?: ForecastMeta;
};

export type AgentEvent =
  | { type: "tool_call"; tool: string; label: string; callId: string; stepIndex: number }
  | { type: "tool_result"; tool: string; rows: number; callId: string; durationMs: number }
  | { type: "tool_error"; tool: string; message: string; callId: string }
  | { type: "done" }
  | { type: "error"; message: string };

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const pm = m - 1;
  return pm === 0
    ? `${y - 1}-12`
    : `${y}-${String(pm).padStart(2, "0")}`;
}

export async function generateStatisticsReport(
  userId: string,
  periodType: "monthly",
  periodKey: string,
  emit?: (event: AgentEvent) => void,
): Promise<void> {
  const db = await getKysely();
  const analyticsService = createAnalyticsService(db);

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

  const today = currentDate();
  const yesterday = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().substring(0, 10);
  })();
  const effectiveEnd = periodEnd < today ? periodEnd : yesterday;
  const now = Math.floor(Date.now() / 1000);

  if (effectiveEnd < periodStart) {
    await saveReport(db, userId, periodType, periodKey, [], now);
    return;
  }

  const txCount = await db
    .selectFrom("transaction")
    .select((eb) => eb.fn.countAll<number>().as("cnt"))
    .where("user_id", "=", userId)
    .where("date", ">=", periodStart)
    .where("date", "<=", effectiveEnd)
    .executeTakeFirst();

  if ((txCount?.cnt ?? 0) === 0) {
    await saveReport(db, userId, periodType, periodKey, [], now);
    return;
  }

  // ── Schemas ───────────────────────────────────────────────────────────────

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
    insights: z.array(insightItemSchema).min(3).max(5),
  });

  // Build catalog description dynamically from METRIC_CATALOG
  const catalogText = Object.entries(METRIC_CATALOG)
    .map(([name, m]) => {
      const parts = [`- **${name}**: ${m.description}`];
      if (m.validBreakdowns.length) parts.push(`breakdowns: ${m.validBreakdowns.join(", ")}`);
      if (m.validTimeGrains.length) parts.push(`grains: ${m.validTimeGrains.join(", ")}`);
      if (m.supportsMoM) parts.push("compare_previous_period=true available");
      return parts.join(" | ");
    })
    .join("\n");

  const objectiveLine = budget?.objective
    ? `\nUser's financial goal: "${budget.objective}" — frame recommendations around achieving this.`
    : "";

  const SYSTEM = `You are a trusted personal finance advisor.${objectiveLine}

## Available metrics
${catalogText}

## Instructions
Call query_metrics at least 3 times with DIFFERENT metrics or group_by to explore multiple angles.
Suggested sequence:
1. query_metrics(["budget_remaining", "budget_used_pct", "daily_pace", "projected_total"]) — budget overview
2. query_metrics(["total_expense"], group_by=[{name:"category__path"}], limit=8, compare_previous_period=true) — category breakdown with MoM
3. query_metrics(["total_expense"], group_by=[{name:"metric_time", grain:"week"}]) — weekly trend
Then call get_notable_transactions and generate_insights with 3–5 insights.

## Insight rules
- Title = THE TAKEAWAY (max 45 chars, Vietnamese). State what the data MEANS, not what it shows.
  ❌ "Chi tiêu theo danh mục" ✅ "Ăn uống chiếm 35% — tăng 12% so tháng trước"
- Summary = adds context the chart cannot show (max 160 chars, Vietnamese)
- Mix types: include at least 1 "analysis", 1 "recommendation", and 1 "alert" (if data warrants it)
- Never use pie charts — use bar (sorted desc) instead
- chart_data values MUST be EXACT integers copied from tool results. Never round, estimate, or recalculate.
- Cap bar charts at 5 rows, group tail as "Khác"
- For bar chart names: ≤ 12 chars, abbreviate if needed
- budget_remaining, budget_used_pct etc. come from query_metrics — NEVER compute them yourself

## Forecast insight chart rules
When reporting a forecast or spending trend over time, use chart_type="line" with:
- time series data: query_metrics(["total_expense"], group_by=[{name:"metric_time", grain:"day"}]) for each day
- chart_data rows: [{name: "2026-05-01", value: 500000, series: "Thực tế"}, ...]
- Add ONE extra row per day for the budget daily pace as series="Ngân sách":
  budget daily = round(budget_amount / days_total); get budget_amount from query_metrics(["budget_remaining"]) result
- Use bar_grouped or line chart, NOT a bar chart mixing different metric types (projected_total, budget_remaining, daily_pace in one chart is WRONG)`;

  // ── Tool schemas derived from catalog ─────────────────────────────────────

  const GroupBySchema = z.object({
    name: z.enum(DIMENSION_NAMES),
    grain: z.enum(TIME_GRAINS).optional()
      .describe("Required when name='metric_time'. Default: day"),
  });

  const WhereSchema = z.object({
    dimension: z.enum(DIMENSION_NAMES),
    operator: z.enum(["=", "!=", ">", ">=", "<", "<="]),
    value: z.union([z.string(), z.number()]),
  });

  const OrderBySchema = z.object({
    name: z.enum(METRIC_NAMES),
    descending: z.boolean().default(false),
  });

  // ── Agent loop ─────────────────────────────────────────────────────────────

  let capturedInsights: Insight[] | null = null as Insight[] | null;
  let stepIndex = 0;
  const model = await getOpenAIModel();

  try {
    await generateText({
      model,
      system: SYSTEM,
      stopWhen: stepCountIs(10),
      maxOutputTokens: 4096,
      prompt: `Analyze spending for period ${periodKey} (${periodStart} to ${effectiveEnd}). Prior months: ${prevMonthKey(periodKey)}, ${prevMonthKey(prevMonthKey(periodKey))}.`,
      tools: {
        list_metrics: tool({
          description: "List all available metrics with their valid dimensions and time grains. Call this first to discover what you can query.",
          inputSchema: z.object({}),
          execute: async () => {
            const callId = Math.random().toString(36).slice(2, 10);
            emit?.({ type: "tool_call", tool: "list_metrics", label: "Danh sách metrics", callId, stepIndex });
            emit?.({ type: "tool_result", tool: "list_metrics", rows: Object.keys(METRIC_CATALOG).length, callId, durationMs: 0 });
            return METRIC_CATALOG;
          },
        }),

        query_metrics: tool({
          description: `Query financial metrics with optional grouping, filtering, and ordering.
Use list_metrics first to discover valid dimensions per metric.
For budget metrics (budget_remaining, budget_used_pct, daily_pace, projected_total): no group_by allowed.`,
          inputSchema: z.object({
            metrics: z.array(z.enum(METRIC_NAMES)).min(1).max(4),
            group_by: z.array(GroupBySchema).optional(),
            where: z.array(WhereSchema).optional(),
            order_by: z.array(OrderBySchema).optional(),
            limit: z.number().int().min(1).max(20).optional(),
            compare_previous_period: z.boolean().optional()
              .describe("Adds prior period values. Only for metrics with supportsMoM=true"),
          }),
          execute: async (args) => {
            const callId = Math.random().toString(36).slice(2, 10);
            const label = args.group_by?.length
              ? `${args.metrics.join("+")} by ${args.group_by.map((g) => g.grain ? `${g.name}(${g.grain})` : g.name).join(",")}`
              : args.metrics.join("+");
            const startMs = Date.now();
            emit?.({ type: "tool_call", tool: "query_metrics", label, callId, stepIndex });
            try {
              const result = await analyticsService.queryMetricsForPeriod({
                userId,
                periodKey,
                ...args,
              });
              emit?.({ type: "tool_result", tool: "query_metrics", rows: result.rows.length, callId, durationMs: Date.now() - startMs });
              return result;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              emit?.({ type: "tool_error", tool: "query_metrics", message: msg, callId });
              throw err;
            }
          },
        }),

        get_notable_transactions: tool({
          description: "Get top N transactions by amount for the period with full category path",
          inputSchema: z.object({
            limit: z.number().int().min(1).max(20).default(10),
          }),
          execute: async (args) => {
            const callId = Math.random().toString(36).slice(2, 10);
            const startMs = Date.now();
            emit?.({ type: "tool_call", tool: "get_notable_transactions", label: "Giao dịch đáng chú ý", callId, stepIndex });
            const rows = await db
              .selectFrom("transaction as t")
              .innerJoin("category as c", "c.id", "t.category_id")
              .leftJoin("category as p1", "p1.id", "c.parent_id" as any)
              .leftJoin("category as p2", "p2.id", "p1.parent_id" as any)
              .select([
                "t.amount",
                "t.type",
                "t.date",
                "t.note",
                sql<string>`CASE
                  WHEN c.level = 1 THEN c.name
                  WHEN c.level = 2 THEN (COALESCE(p1.name, '') || ' > ' || c.name)
                  ELSE (COALESCE(p2.name, '') || ' > ' || COALESCE(p1.name, '') || ' > ' || c.name)
                END`.as("category_path"),
              ])
              .where("t.user_id", "=", userId)
              .where("t.date", ">=", periodStart)
              .where("t.date", "<=", effectiveEnd)
              .orderBy("t.amount", "desc")
              .limit(args.limit)
              .execute();
            emit?.({ type: "tool_result", tool: "get_notable_transactions", rows: rows.length, callId, durationMs: Date.now() - startMs });
            return rows;
          },
        }),

        generate_insights: tool({
          description: "Generate the final structured finance report with 3–5 insights. Call this LAST after querying data.",
          inputSchema: insightSchema,
          outputSchema: z.object({ status: z.string(), count: z.number() }),
          execute: async (args) => {
            capturedInsights = (args as z.infer<typeof insightSchema>).insights as Insight[];
            const callId = Math.random().toString(36).slice(2, 10);
            emit?.({ type: "tool_call", tool: "generate_insights", label: "Tổng hợp nhận xét", callId, stepIndex });
            emit?.({ type: "tool_result", tool: "generate_insights", rows: capturedInsights.length, callId, durationMs: 0 });
            return { status: "saved", count: capturedInsights.length };
          },
        }),
      },
      onStepFinish({ stepNumber, toolCalls, finishReason, text }) {
        stepIndex = stepNumber;
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
  }

  if (!capturedInsights || capturedInsights.length === 0) {
    throw new Error("AI không tạo được nhận xét — thử lại sau");
  }

  // Pre-build the forecast line chart so it always uses accurate cumsum data,
  // not the AI's approximation (which caused NaN y-axis labels).
  const nextPeriodStart = (() => {
    const d = new Date(periodEnd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().substring(0, 10);
  })();
  const periodLengthDays =
    Math.round(
      (new Date(periodEnd + "T00:00:00Z").getTime() -
        new Date(periodStart + "T00:00:00Z").getTime()) /
        86400000,
    ) + 1;

  let forecastInsight: Insight | null = null;
  if (budget?.amount) {
    const dailyExpenses = await db
      .selectFrom("transaction")
      .select(["date", sql<number>`COALESCE(SUM(amount), 0)`.as("expense")])
      .where("user_id", "=", userId)
      .where("type", "=", "expense")
      .where("date", ">=", periodStart)
      .where("date", "<=", effectiveEnd)
      .groupBy("date")
      .execute();

    const byDate = new Map<string, number>(dailyExpenses.map((r) => [r.date, r.expense as number]));

    const actualCumData: ChartDatum[] = [];
    let cumsum = 0;
    for (let i = 0; i < periodLengthDays; i++) {
      const d = new Date(periodStart + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().substring(0, 10);
      if (dateStr > effectiveEnd) break;
      cumsum += byDate.get(dateStr) ?? 0;
      actualCumData.push({ name: dateStr, value: cumsum, series: "Thực tế" });
    }

    const budgetCumData: ChartDatum[] = [];
    for (let i = 0; i < periodLengthDays; i++) {
      const d = new Date(periodStart + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().substring(0, 10);
      budgetCumData.push({
        name: dateStr,
        value: Math.round((budget.amount / periodLengthDays) * (i + 1)),
        series: "Ngân sách",
      });
    }

    const daysElapsed = actualCumData.length;
    const projTotal = daysElapsed > 0 ? Math.round(cumsum * (periodLengthDays / daysElapsed)) : 0;
    const isOver = projTotal > budget.amount;
    const diff = Math.abs(projTotal - budget.amount);
    const compactVND = (n: number) =>
      n >= 1_000_000
        ? `${Math.round(n / 1_000_000)}tr`
        : `${Math.round(n / 1_000)}k`;

    forecastInsight = {
      type: isOver ? "alert" : "analysis",
      title: isOver
        ? `Dự báo vượt ${compactVND(diff)}`
        : `Dự báo tiết kiệm ${compactVND(diff)}`,
      summary: isOver
        ? `Nếu duy trì tốc độ hiện tại, bạn sẽ vượt quá ngân sách với chi tiêu dự kiến đạt ${_vndFormat.format(projTotal)} VND. Cân đối chi tiêu để tránh thiếu hụt.`
        : `Chi tiêu đang trong ngân sách. Dự kiến tiết kiệm được ${_vndFormat.format(budget.amount - projTotal)} VND cuối tháng.`,
      chart_type: "forecast_line",
      chart_data: [...actualCumData, ...budgetCumData],
      value_unit: "currency",
      forecast_meta: { period_start: periodStart, today, next_period_start: nextPeriodStart },
    };
  }

  // Prepend forecast insight; drop any AI-generated insight that has both
  // "Ngân sách" + "Thực tế" series (those are duplicate budget-pace charts).
  const aiInsights = capturedInsights.filter((ins) => {
    const seriesNames = new Set(ins.chart_data?.flatMap((d) => d.series ? [d.series] : []));
    return !(seriesNames.has("Ngân sách") && seriesNames.has("Thực tế"));
  });
  const finalInsights: Insight[] = forecastInsight
    ? [forecastInsight, ...aiInsights]
    : capturedInsights;

  await saveReport(db, userId, periodType, periodKey, finalInsights, now);
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

// Called after any transaction mutation for the current month.
// Marks the report dirty so the next time the user opens the stats page,
// the frontend triggers a fresh generation via POST /api/statistics.
export async function markStatsDirty(userId: string, txnDate: string): Promise<void> {
  const affectedMonth = getBudgetMonthForDate(txnDate);
  if (affectedMonth !== currentBudgetMonth()) return;
  const db = await getKysely();
  await db
    .updateTable("statistics_report")
    .set({ is_dirty: 1 })
    .where("user_id", "=", userId)
    .where("period_type", "=", "monthly")
    .where("period_key", "=", affectedMonth)
    .execute();
}
