import { sql } from "kysely";
import { generateText, Output } from "ai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getKysely } from "@/lib/db";
import { getStatisticsModel } from "@/lib/llm";
import { startAITrace } from "@/lib/telemetry";
import { getBudgetPeriodInclusive, currentDate, getBudgetMonthForDate } from "@/lib/validators";
import { reportEndDate } from "@/lib/statistics-period";
import {
  addDays, daysBetween, buildStatisticsSnapshot, hydrateStatisticsInsights,
  narrativeSchema, STATISTICS_SYSTEM, REPORT_VERSION,
  type AgentEvent, type AnalysisTransaction, type StatisticsSnapshot,
} from "@/lib/statistics-report";
export type { InsightType, ChartType, ForecastMeta, ChartDatum, Insight, AgentEvent } from "@/lib/statistics-report";

function prevMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export async function loadStatisticsSnapshot(userId: string, periodKey: string, emit?: (event: AgentEvent) => void): Promise<{ snapshot: StatisticsSnapshot; revision: number }> {
  const step = (key: string, label: string, status: "running" | "completed") => emit?.({ type: "step", key, label, status });
  step("period", "Xác định kỳ ngân sách và phạm vi so sánh", "running");
  const db = await getKysely();
  const revisionRow = await db.selectFrom("statistics_revision").select("revision").where("user_id", "=", userId).executeTakeFirst();
  const revision = revisionRow?.revision ?? 0;
  const previousKey = prevMonthKey(periodKey);
  const budgets = await db.selectFrom("monthly_budget").select(["month", "amount", "start_date", "end_date", "objective"]).where("user_id", "=", userId).where("month", "in", [periodKey, previousKey]).execute();
  const resolve = (key: string) => {
    const budget = budgets.find(b => b.month === key);
    const computed = getBudgetPeriodInclusive(key);
    return { key, start: budget?.start_date || computed.start_date, end: budget?.end_date || computed.end_date, amount: budget?.amount ?? null, objective: budget?.objective ?? null };
  };
  const current = resolve(periodKey);
  const previous = resolve(previousKey);
  const through = reportEndDate(current.end, currentDate());
  const elapsed = daysBetween(current.start, through);
  const previousThrough = through < current.end
    ? reportEndDate(previous.end, addDays(previous.start, elapsed - 1))
    : previous.end;
  step("period", "Xác định kỳ ngân sách và phạm vi so sánh", "completed");
  step("spending", "Tổng hợp chi tiêu tiêu dùng và thu chi", "running");
  const rows = await db.selectFrom("transaction as t")
    .leftJoin("category as c", "c.id", "t.category_id")
    .leftJoin("category as p1", "p1.id", "c.parent_id")
    .leftJoin("category as p2", "p2.id", "p1.parent_id")
    .leftJoin("credit_card_group as g", join => join.onRef("g.id", "=", "t.credit_card_group_id").on("g.user_id", "=", userId))
    .select(["t.amount", "t.type", "t.date", "t.note", "c.budget_behavior", "g.name as card_group",
      sql<string>`CASE WHEN c.level = 1 THEN c.name WHEN c.level = 2 THEN COALESCE(p1.name, '') || ' > ' || c.name WHEN c.level = 3 THEN COALESCE(p2.name, '') || ' > ' || COALESCE(p1.name, '') || ' > ' || c.name ELSE 'Chưa phân loại' END`.as("category_path"),
      sql<number>`CASE WHEN t.credit_card_group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM credit_card_statement AS s WHERE s.user_id = ${userId} AND s.group_id = t.credit_card_group_id AND s.status = 'paid' AND t.date >= s.period_start AND t.date < s.period_end) THEN 1 ELSE 0 END`.as("is_unpaid"),
    ])
    .where("t.user_id", "=", userId)
    .where(eb => eb.or([
      eb.and([eb("t.date", ">=", current.start), eb("t.date", "<=", through)]),
      eb.and([eb("t.date", ">=", previous.start), eb("t.date", "<=", previousThrough)]),
    ]))
    .orderBy("t.date", "asc").orderBy("t.id", "asc").execute();
  step("spending", "Tổng hợp chi tiêu tiêu dùng và thu chi", "completed");
  step("cards", "Đối chiếu chi tiêu thẻ và trạng thái thanh toán", "running");
  const transactions: AnalysisTransaction[] = rows.map(r => ({ ...r, is_unpaid: r.is_unpaid === 1 }));
  const snapshot = buildStatisticsSnapshot({
    period: { key: periodKey, start: current.start, end: current.end, through },
    previousPeriod: { key: previousKey, start: previous.start, end: previous.end, through: previousThrough },
    transactions, budgetAmount: current.amount, previousBudgetAmount: previous.amount, objective: current.objective,
  });
  step("cards", "Đối chiếu chi tiêu thẻ và trạng thái thanh toán", "completed");
  step("comparison", "So sánh danh mục và kỳ trước", "running");
  step("comparison", "So sánh danh mục và kỳ trước", "completed");
  return { snapshot, revision };
}

export async function generateStatisticsReport(userId: string, periodType: "monthly", periodKey: string, emit?: (event: AgentEvent) => void): Promise<void> {
  const { snapshot, revision } = await loadStatisticsSnapshot(userId, periodKey, emit);
  const [{ model, modelId }, { env, ctx }] = await Promise.all([getStatisticsModel(), getCloudflareContext({ async: true })]);
  const trace = startAITrace(env as Cloudflare.Env, { name: "statistics-report", userId, metadata: { periodKey, modelId, reportVersion: REPORT_VERSION } });
  let insights: ReturnType<typeof hydrateStatisticsInsights> = [];
  try {
    if (snapshot.metrics.total_income !== 0 || snapshot.metrics.total_outflow !== 0) {
      emit?.({ type: "step", key: "narrative", label: "Diễn giải số liệu và đề xuất hành động", status: "running" });
      const result = await generateText({
        model,
        system: STATISTICS_SYSTEM,
        prompt: JSON.stringify(snapshot),
        output: Output.object({ schema: narrativeSchema }),
        maxOutputTokens: 6144,
        maxRetries: 0,
        providerOptions: { openai: { reasoningEffort: "low" } },
        experimental_telemetry: trace.telemetry,
      });
      emit?.({ type: "step", key: "narrative", label: "Diễn giải số liệu và đề xuất hành động", status: "completed" });
      emit?.({ type: "step", key: "validation", label: "Kiểm tra nhận xét và dữ liệu biểu đồ", status: "running" });
      insights = hydrateStatisticsInsights(result.output, snapshot);
      emit?.({ type: "step", key: "validation", label: "Kiểm tra nhận xét và dữ liệu biểu đồ", status: "completed" });
    }
    emit?.({ type: "step", key: "save", label: "Lưu bản phân tích", status: "running" });
    const db = await getKysely();
    const values = {
      insights: JSON.stringify(insights), snapshot: JSON.stringify(snapshot), model_id: modelId,
      report_version: REPORT_VERSION, source_revision: revision,
      is_dirty: sql<number>`CASE WHEN COALESCE((SELECT revision FROM statistics_revision WHERE user_id = ${userId}), 0) = ${revision} THEN 0 ELSE 1 END`,
      generated_at: Math.floor(Date.now() / 1000),
    };
    await db.insertInto("statistics_report").values({ user_id: userId, period_type: periodType, period_key: periodKey, ...values })
      .onConflict(oc => oc.columns(["user_id", "period_type", "period_key"]).doUpdateSet(values)).execute();
    emit?.({ type: "step", key: "save", label: "Lưu bản phân tích", status: "completed" });
  } finally {
    ctx.waitUntil(trace.flush());
  }
}

/** Mark any affected historical or current budget period for regeneration. */
export async function markStatsDirty(userId: string, txnDate: string): Promise<void> {
  const db = await getKysely();
  await db.updateTable("statistics_report").set({ is_dirty: 1 }).where("user_id", "=", userId)
    .where("period_type", "=", "monthly").where("period_key", "=", getBudgetMonthForDate(txnDate)).execute();
}
