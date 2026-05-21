import { sql } from "kysely";
import type { ExpressionBuilder } from "kysely";
import type { Database } from "@/lib/schema";

// Metrics are always evaluated in a query that joins transaction + category.
// All column refs must be table-qualified to avoid ambiguity (both tables have `type`).
type JoinedEB = ExpressionBuilder<Database, "transaction" | "category">;

export const METRICS = {
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
  total_expense: {
    description: "Tổng chi tiêu",
    validBreakdowns: ["category__path", "category__name", "metric_time", "transaction__type"],
    validTimeGrains: ["day", "week", "month", "day_of_week"],
    supportsMoM: true,
  },
  total_income: {
    description: "Tổng thu nhập",
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
    description: "Ngân sách còn lại (server-computed: budget.amount - total_expense)",
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
