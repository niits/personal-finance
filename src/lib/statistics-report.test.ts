import { describe, expect, it } from "vitest";
import { buildStatisticsSnapshot, hydrateStatisticsInsights, type AnalysisTransaction, type StatisticsNarrative } from "./statistics-report";

const row = (amount: number, overrides: Partial<AnalysisTransaction> = {}): AnalysisTransaction => ({ amount, date: "2026-05-02", type: "expense", note: null, category_path: "Ăn uống", budget_behavior: "consumption", card_group: null, is_unpaid: false, ...overrides });
function snapshot(rows: AnalysisTransaction[], budgetAmount: number | null = 1_000_000) {
  return buildStatisticsSnapshot({ period: { key: "2026-05", start: "2026-04-30", end: "2026-05-28", through: "2026-05-14" }, previousPeriod: { key: "2026-04", start: "2026-03-31", end: "2026-04-29", through: "2026-04-14" }, transactions: rows, budgetAmount, previousBudgetAmount: budgetAmount, objective: null });
}
function narrative(chart_id: string | null = "payment_methods", highlight_name: string | null = "Thẻ tín dụng"): StatisticsNarrative {
  return { insights: [
    { type: "analysis", topic: "cards", title: "Chi thẻ thuộc tổng chi tiêu.", summary: "Phần chưa thanh toán được theo dõi riêng.", chart_id, chart_type: chart_id ? "horizontal_bar" : null, highlight_ids: highlight_name ? [JSON.stringify([highlight_name, ""])] : [] },
    { type: "recommendation", topic: "budget", title: "Theo dõi chi tiêu còn lại.", summary: "Đối chiếu hạn mức trước khi chi thêm.", chart_id: null, chart_type: null, highlight_ids: [] },
  ] };
}
describe("statistics evidence", () => {
  it("separates consumption, cashflow, card spending and unpaid subsets", () => {
    const result = snapshot([row(400_000, { card_group: "Thẻ A", is_unpaid: true }), row(100_000, { card_group: "Thẻ A" }), row(200_000), row(2_000_000, { budget_behavior: "non_budget", category_path: "Tiết kiệm" }), row(3_000_000, { type: "income" })]);
    expect(result.metrics).toMatchObject({ consumption_expense: 700_000, consumption_count: 3, total_outflow: 2_700_000, total_income: 3_000_000, net_cashflow: 300_000, card_spend: 500_000, cash_spend: 200_000, unpaid_card_spend: 400_000, budget_remaining: 300_000, budget_used_pct: 70, card_share_pct: 71 });
    expect(result.card_groups).toEqual([{ name: "Thẻ A", spend: 500_000, unpaid: 400_000, share_pct: 100 }]);
  });
  it("keeps prior-only categories and compares corresponding elapsed portions", () => {
    const result = snapshot([row(100_000), row(500_000, { date: "2026-04-10", category_path: "Di chuyển" }), row(9_000_000, { date: "2026-04-20" })]);
    expect(result.previous_metrics.consumption_expense).toBe(500_000);
    expect(result.categories).toContainEqual({ name: "Di chuyển", current: 0, previous: 500_000, share_pct: 0, change_pct: -100 });
    expect(result.comparison_basis).toBe("equal_elapsed_days");
  });
  it("preserves missing budgets and unavailable percentage changes", () => {
    const result = snapshot([row(100_000)], null);
    expect(result.metrics.budget_remaining).toBeNull();
    expect(result.metrics.budget_used_pct).toBeNull();
    expect(result.consumption_change_pct).toBeNull();
  });
  it("allows a budget usage percentage above 100", () => {
    expect(snapshot([row(2_000_000)]).metrics).toMatchObject({ budget_used_pct: 200, budget_overrun_pct: 100, budget_overrun: 1_000_000 });
  });
  it("fills zero-spend days and excludes an incomplete current day from the trend", () => {
    const result = snapshot([row(100_000), row(900_000, { date: "2026-05-14" })]);
    const data = result.charts.find(c => c.id === "daily_consumption")!.data;
    expect(data[0]).toEqual({ id: JSON.stringify(["2026-04-30", ""]), name: "2026-04-30", value: 0 });
    expect(data.at(-1)?.name).toBe("2026-05-13");
    expect(data.reduce((sum, d) => sum + d.value, 0)).toBe(100_000);
    expect(result.metrics.consumption_expense).toBe(1_000_000);
  });
  it("hydrates chart values exclusively from server evidence", () => {
    const result = snapshot([row(400_000, { card_group: "Thẻ A", is_unpaid: true }), row(200_000)]);
    const insights = hydrateStatisticsInsights(narrative(), result);
    expect(insights[0].chart_data).toEqual([{ id: JSON.stringify(["Thẻ tín dụng", ""]), name: "Thẻ tín dụng", value: 400_000, highlight: true }, { id: JSON.stringify(["Tiền mặt", ""]), name: "Tiền mặt", value: 200_000 }]);
    expect(insights[0].value_unit).toBe("currency");
  });
  it("rejects nonexistent chart references and fabricated highlights", () => {
    const result = snapshot([row(400_000, { card_group: "Thẻ A" })]);
    expect(() => hydrateStatisticsInsights(narrative("invented"), result)).toThrow();
    expect(() => hydrateStatisticsInsights(narrative("payment_methods", "Không tồn tại"), result)).toThrow();
  });
  it("does not force an uninformative card insight", () => {
    const data = narrative(null, null);
    data.insights[0].topic = "spending";
    expect(hydrateStatisticsInsights(data, snapshot([row(400_000, { card_group: "Thẻ A" })]))).toHaveLength(2);
  });
  it("rejects fabricated amounts and distinguishes usage from excess", () => {
    const data = narrative(null, null);
    data.insights[0].summary = "Khoản chi là 999.999 ₫.";
    expect(() => hydrateStatisticsInsights(data, snapshot([row(2_000_000, { card_group: "Thẻ A" })]))).toThrow(/Số tiền/);
    data.insights[0].summary = "Khoản chi là 2.000.000 ₫.";
    data.insights[0].title = "Chi tiêu vượt ngân sách 200%.";
    expect(() => hydrateStatisticsInsights(data, snapshot([row(2_000_000, { card_group: "Thẻ A" })]))).toThrow(/vượt ngân sách/);
  });
  it("rejects duplicate chart selections", () => {
    const data = narrative();
    data.insights[1].chart_id = "payment_methods";
    expect(() => hydrateStatisticsInsights(data, snapshot([row(400_000, { card_group: "Thẻ A" })]))).toThrow();
  });
});

describe("AI chart template selections", () => {
  const evidence = () => snapshot([row(400_000, { card_group: "Thẻ A" }), row(200_000, { category_path: "Mua sắm" })]);
  it("allows the model to choose a donut without supplying values", () => {
    const data = narrative();
    data.insights[0].chart_type = "donut";
    const result = hydrateStatisticsInsights(data, evidence());
    expect(result[0].chart_type).toBe("donut");
    expect(result[0].chart_data?.reduce((sum, d) => sum + d.value, 0)).toBe(600_000);
  });
  it("rejects a time-series template on categorical evidence", () => {
    const data = narrative();
    data.insights[0].chart_type = "line";
    expect(() => hydrateStatisticsInsights(data, evidence())).toThrow(/Kiểu biểu đồ/);
  });
  it("rejects values injected into model output", () => {
    const data = narrative();
    Object.assign(data.insights[0], { chart_data: [{ name: "Invented", value: 10 }] });
    expect(() => hydrateStatisticsInsights(data, evidence())).toThrow();
  });
  it("rejects absent highlights and orphan chart settings", () => {
    const data = narrative();
    data.insights[0].highlight_ids = ["invented"];
    expect(() => hydrateStatisticsInsights(data, evidence())).toThrow(/Điểm nhấn/);
    data.insights[0].chart_id = null;
    expect(() => hydrateStatisticsInsights(data, evidence())).toThrow(/không có biểu đồ/);
  });
  it("rejects duplicate datasets even when their templates differ", () => {
    const data = narrative();
    data.insights[1] = { ...data.insights[0], chart_type: "donut" };
    expect(() => hydrateStatisticsInsights(data, evidence())).toThrow(/Biểu đồ/);
  });
  it("omits zero-only comparisons and exposes complete composition choices", () => {
    const result = snapshot([row(100_000, { card_group: "Thẻ A", is_unpaid: true })]);
    expect(result.charts.map(c => c.id)).not.toContain("card_payment_status");
    expect(result.charts.map(c => c.id)).not.toContain("payment_methods");
    expect(result.charts.map(c => c.id)).not.toContain("category_comparison");
    expect(evidence().charts.find(c => c.id === "categories")?.allowed_types).toContain("donut");
  });
  it("only allows stacking mutually exclusive payment parts", () => {
    const result = evidence();
    expect(result.charts.find(c => c.id === "category_payment_mix")?.allowed_types).toContain("stacked_bar");
    expect(result.charts.find(c => c.id === "categories")?.allowed_types).not.toContain("stacked_bar");
  });
  it("computes concentration without including loans or other financial movements", () => {
    const result = snapshot([row(2_400_000), row(2_000_000), row(100_000), row(8_000_000, { budget_behavior: "non_budget" })]);
    expect(result.concentration).toEqual({ top_two_amount: 4_400_000, top_two_share_pct: 98, remaining_amount: 100_000 });
  });
  it("accepts one useful no-chart insight for sparse evidence", () => {
    const data = narrative(null, null);
    data.insights = data.insights.slice(0, 1);
    expect(hydrateStatisticsInsights(data, evidence())).toHaveLength(1);
  });
});
