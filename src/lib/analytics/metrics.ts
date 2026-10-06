import { sql } from "kysely";
import type { ExpressionBuilder } from "kysely";
import type { Database } from "@/lib/schema";

// Metrics are always evaluated in a query that joins transaction + category.
// All column refs must be table-qualified to avoid ambiguity (both tables have `type`).
type JoinedEB = ExpressionBuilder<Database, "transaction" | "category">;

export const METRICS = {
  consumption_expense: () => sql<number>`COALESCE(SUM(CASE WHEN "transaction".type = 'expense' AND category.budget_behavior = 'consumption' THEN "transaction".amount ELSE 0 END), 0)`,
  consumption_count: () => sql<number>`COALESCE(SUM(CASE WHEN "transaction".type = 'expense' AND category.budget_behavior = 'consumption' THEN 1 ELSE 0 END), 0)`,
  card_spend: () => sql<number>`COALESCE(SUM(CASE WHEN "transaction".type = 'expense' AND category.budget_behavior = 'consumption' AND "transaction".credit_card_group_id IS NOT NULL THEN "transaction".amount ELSE 0 END), 0)`,
  cash_spend: () => sql<number>`COALESCE(SUM(CASE WHEN "transaction".type = 'expense' AND category.budget_behavior = 'consumption' AND "transaction".credit_card_group_id IS NULL THEN "transaction".amount ELSE 0 END), 0)`,
  unpaid_card_spend: () => sql<number>`COALESCE(SUM(CASE WHEN "transaction".type = 'expense' AND category.budget_behavior = 'consumption' AND "transaction".credit_card_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM credit_card_statement AS s WHERE s.user_id = "transaction".user_id
      AND s.group_id = "transaction".credit_card_group_id AND s.status = 'paid'
      AND "transaction".date >= s.period_start AND "transaction".date < s.period_end
  ) THEN "transaction".amount ELSE 0 END), 0)`,

  total_expense: (eb: JoinedEB) =>
    eb.fn.sum(
      eb.case()
        .when("transaction.type", "=", "expense")
        .then(eb.ref("transaction.amount"))
        .else(sql<number>`0`)
        .end()
    ),

  total_income: (eb: JoinedEB) =>
    eb.fn.sum(
      eb.case()
        .when("transaction.type", "=", "income")
        .then(eb.ref("transaction.amount"))
        .else(sql<number>`0`)
        .end()
    ),

  transaction_count: (eb: JoinedEB) =>
    eb.fn.count<number>("transaction.id"),

  net: (eb: JoinedEB) =>
    eb.fn.sum(
      eb.case()
        .when("transaction.type", "=", "income")
        .then(eb.ref("transaction.amount"))
        .when("transaction.type", "=", "expense")
        .then(sql<number>`-${eb.ref("transaction.amount")}`)
        .else(sql<number>`0`)
        .end()
    ),
} satisfies Record<string, (eb: JoinedEB) => unknown>;

export type MetricName = keyof typeof METRICS;
export type Breakdown = "category" | "date" | "type";

// ── Semantic layer additions ───────────────────────────────────────────────

export type TimeGrain = "day" | "week" | "month" | "day_of_week";

export const DERIVED_METRICS = [
  "budget_remaining",
  "budget_used_pct",
  "daily_pace",
  "projected_total",
] as const;
export type DerivedMetricName = (typeof DERIVED_METRICS)[number];
export type AnyMetricName = MetricName | DerivedMetricName;

export const DIMENSION_NAMES = [
  "metric_time",
  "category__path",
  "category__name",
  "transaction__type",
  "payment_method",
  "card_group",
] as const;
export type DimensionName = (typeof DIMENSION_NAMES)[number];

export const TIME_GRAINS = ["day", "week", "month", "day_of_week"] as const;

export const METRIC_CATALOG: Record<
  AnyMetricName,
  {
    description: string;
    validBreakdowns: DimensionName[];
    validTimeGrains: TimeGrain[];
    supportsMoM: boolean;
  }
> = {
  consumption_expense: {
    description: "Chi tiêu tiêu dùng",
    validBreakdowns: ["category__path", "category__name", "metric_time", "payment_method", "card_group"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  consumption_count: {
    description: "Số giao dịch chi tiêu tiêu dùng",
    validBreakdowns: ["category__path", "category__name", "metric_time", "payment_method", "card_group"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  card_spend: {
    description: "Chi tiêu tiêu dùng bằng thẻ tín dụng",
    validBreakdowns: ["category__path", "category__name", "metric_time", "payment_method", "card_group"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  cash_spend: {
    description: "Chi tiêu tiêu dùng bằng tiền mặt",
    validBreakdowns: ["category__path", "category__name", "metric_time", "payment_method", "card_group"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  unpaid_card_spend: {
    description: "Chi tiêu thẻ trong kỳ chưa thanh toán, thuộc chi tiêu tiêu dùng; trạng thái tại thời điểm phân tích",
    validBreakdowns: ["category__path", "category__name", "metric_time", "payment_method", "card_group"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  total_expense: {
    description: "Tổng dòng tiền chi, bao gồm các vận động tài chính ngoài ngân sách",
    validBreakdowns: ["category__path", "category__name", "metric_time", "transaction__type"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  total_income: {
    description: "Tổng dòng tiền thu, bao gồm các vận động tài chính",
    validBreakdowns: ["category__path", "category__name", "metric_time", "transaction__type"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  transaction_count: {
    description: "Số giao dịch",
    validBreakdowns: ["category__path", "category__name", "metric_time", "transaction__type"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  net: {
    description: "Thu nhập trừ chi tiêu",
    validBreakdowns: ["metric_time"],
    validTimeGrains: ["day", "week", "month"],
    supportsMoM: true,
  },
  budget_remaining: {
    description: "Ngân sách còn lại (server-computed: budget.amount - consumption_expense)",
    validBreakdowns: [],
    validTimeGrains: [],
    supportsMoM: false,
  },
  budget_used_pct: {
    description: "% ngân sách đã dùng",
    validBreakdowns: [],
    validTimeGrains: [],
    supportsMoM: false,
  },
  daily_pace: {
    description: "Chi tiêu trung bình mỗi ngày đã trôi qua trong kỳ",
    validBreakdowns: [],
    validTimeGrains: [],
    supportsMoM: false,
  },
  projected_total: {
    description: "Dự báo tổng chi tiêu cuối kỳ (daily_pace × days_total)",
    validBreakdowns: [],
    validTimeGrains: [],
    supportsMoM: false,
  },
};

// Tuple constants for z.enum() derivation — adding a metric to METRIC_CATALOG
// automatically updates tool input schemas without any manual changes.
export const METRIC_NAMES = Object.keys(METRIC_CATALOG) as [AnyMetricName, ...AnyMetricName[]];
