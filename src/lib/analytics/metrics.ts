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
