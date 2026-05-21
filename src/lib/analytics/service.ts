import { sql } from "kysely";
import type { Kysely, RawBuilder } from "kysely";
import type { Database } from "@/lib/schema";
import { METRICS, DERIVED_METRICS, METRIC_CATALOG, type MetricName, type Breakdown, type AnyMetricName, type DimensionName, type TimeGrain } from "./metrics";
import { getBudgetPeriod } from "@/lib/validators";

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  meta?: { period: string; compare_period?: string };
};

export type MetricRow = { value: number };
export type BreakdownRow = { dimension: string; value: number };
export type CompareRow = {
  dimension: string;
  current: number;
  previous: number;
  change_abs: number;
  change_pct: number | null;
};

export class AnalyticsService {
  constructor(private db: Kysely<Database>) {}

  async queryMetric(opts: {
    userId: string;
    metric: MetricName;
    from: string;
    to: string;
    breakdown?: Breakdown;
    topN?: number;
  }): Promise<MetricRow | BreakdownRow[]> {
    const metricExpr = METRICS[opts.metric];

    if (!opts.breakdown) {
      const row = await this.db
        .selectFrom("transaction")
        .innerJoin("category", "category.id", "transaction.category_id")
        .select((eb) => [(metricExpr(eb as any) as any).as("value")])
        .where("transaction.user_id", "=", opts.userId)
        .where("transaction.date", ">=", opts.from)
        .where("transaction.date", "<=", opts.to)
        .executeTakeFirst();
      return { value: Number(row?.value ?? 0) };
    }

    const dimMap: Record<Breakdown, "category.name" | "transaction.date" | "transaction.type"> = {
      category: "category.name",
      date: "transaction.date",
      type: "transaction.type",
    };
    const dimCol = dimMap[opts.breakdown];

    let q = this.db
      .selectFrom("transaction")
      .innerJoin("category", "category.id", "transaction.category_id")
      .select((eb) => [
        eb.ref(dimCol).as("dimension"),
        (metricExpr(eb as any) as any).as("value"),
      ])
      .where("transaction.user_id", "=", opts.userId)
      .where("transaction.date", ">=", opts.from)
      .where("transaction.date", "<=", opts.to)
      .groupBy(dimCol)
      .orderBy("value", "desc");

    if (opts.topN) q = q.limit(opts.topN);

    const rows = await q.execute();
    return rows.map((r) => ({ dimension: String(r.dimension), value: Number(r.value) }));
  }

  async compareMetric(opts: {
    userId: string;
    metric: MetricName;
    currentFrom: string;
    currentTo: string;
    previousFrom: string;
    previousTo: string;
    breakdown?: Breakdown;
  }): Promise<CompareRow[]> {
    const [currentResult, previousResult] = await Promise.all([
      this.queryMetric({ userId: opts.userId, metric: opts.metric, from: opts.currentFrom, to: opts.currentTo, breakdown: opts.breakdown }),
      this.queryMetric({ userId: opts.userId, metric: opts.metric, from: opts.previousFrom, to: opts.previousTo, breakdown: opts.breakdown }),
    ]);

    if (!opts.breakdown) {
      const cur = (currentResult as MetricRow).value;
      const prev = (previousResult as MetricRow).value;
      return [{
        dimension: "_total",
        current: cur,
        previous: prev,
        change_abs: cur - prev,
        change_pct: prev !== 0 ? Math.round(((cur - prev) / prev) * 100) : null,
      }];
    }

    const prevMap = new Map((previousResult as BreakdownRow[]).map((r) => [r.dimension, r.value]));
    return (currentResult as BreakdownRow[]).map((r) => {
      const prev = prevMap.get(r.dimension) ?? 0;
      return {
        dimension: r.dimension,
        current: r.value,
        previous: prev,
        change_abs: r.value - prev,
        change_pct: prev !== 0 ? Math.round(((r.value - prev) / prev) * 100) : null,
      };
    });
  }

  async getTimeSeries(opts: {
    userId: string;
    metric: MetricName;
    from: string;
    to: string;
    granularity: "daily";
  }): Promise<{ date: string; value: number }[]> {
    const rows = await this.queryMetric({
      userId: opts.userId,
      metric: opts.metric,
      from: opts.from,
      to: opts.to,
      breakdown: "date",
    });
    return (rows as BreakdownRow[]).map((r) => ({ date: r.dimension, value: r.value }));
  }

  // ── Semantic layer query interface ──────────────────────────────────────────

  async queryMetricsForPeriod(opts: {
    userId: string;
    periodKey: string;
    metrics: AnyMetricName[];
    group_by?: { name: DimensionName; grain?: TimeGrain }[];
    where?: { dimension: DimensionName; operator: string; value: string | number }[];
    order_by?: { name: AnyMetricName; descending?: boolean }[];
    limit?: number;
    compare_previous_period?: boolean;
  }): Promise<QueryResult> {
    const { userId, periodKey, metrics, group_by, where, order_by, limit, compare_previous_period } = opts;
    const { from, to, budgetAmount, daysElapsed, daysTotal } = await this._resolvePeriod(userId, periodKey);

    // Separate core metrics from derived ones
    const coreMetrics = metrics.filter((m): m is MetricName => !(DERIVED_METRICS as readonly string[]).includes(m));
    const derivedMetricNames = metrics.filter((m): m is (typeof DERIVED_METRICS)[number] => (DERIVED_METRICS as readonly string[]).includes(m));

    // Validate: derived metrics don't support compare or group_by
    if (derivedMetricNames.length > 0 && compare_previous_period) {
      throw new Error(`Derived metrics (${derivedMetricNames.join(", ")}) do not support compare_previous_period`);
    }
    if (derivedMetricNames.length > 0 && group_by?.length) {
      throw new Error(`Derived metrics (${derivedMetricNames.join(", ")}) do not support group_by`);
    }

    const columns: string[] = [];
    const rows: Record<string, unknown>[] = [];

    // Compute derived metrics (scalar, no group_by)
    if (derivedMetricNames.length > 0) {
      const totalExpenseRow = await this.queryMetric({ userId, metric: "total_expense", from, to });
      const totalExpense = (totalExpenseRow as MetricRow).value;

      const scalarRow: Record<string, unknown> = {};
      for (const m of derivedMetricNames) {
        columns.push(m);
        if (m === "budget_remaining") {
          scalarRow[m] = budgetAmount !== null ? budgetAmount - totalExpense : null;
        } else if (m === "budget_used_pct") {
          scalarRow[m] = budgetAmount ? Math.round((totalExpense / budgetAmount) * 100) : null;
        } else if (m === "daily_pace") {
          scalarRow[m] = daysElapsed > 0 ? Math.round(totalExpense / daysElapsed) : 0;
        } else if (m === "projected_total") {
          const pace = daysElapsed > 0 ? Math.round(totalExpense / daysElapsed) : 0;
          scalarRow[m] = pace * daysTotal;
        }
      }
      rows.push(scalarRow);
    }

    // Compute core metrics with optional group_by
    if (coreMetrics.length > 0) {
      const hasGroupBy = (group_by?.length ?? 0) > 0;

      if (!hasGroupBy) {
        // Scalar queries — one row per metric
        const scalarRow: Record<string, unknown> = {};
        for (const m of coreMetrics) {
          columns.push(m);
          const r = await this.queryMetric({ userId, metric: m, from, to });
          scalarRow[m] = (r as MetricRow).value;
        }
        // Merge with existing rows if derived metrics also ran
        if (rows.length > 0) {
          Object.assign(rows[0], scalarRow);
        } else {
          rows.push(scalarRow);
        }
      } else {
        // Grouped query — build a single Kysely query with all core metrics and all dimensions
        const dimExprs = (group_by ?? []).map((g) => ({
          colName: g.grain ? `${g.name}__${g.grain}` : g.name,
          expr: this._dimensionExpr(g.name, g.grain),
        }));

        for (const colName of dimExprs.map((d) => d.colName)) {
          if (!columns.includes(colName)) columns.push(colName);
        }
        for (const m of coreMetrics) {
          if (!columns.includes(m)) columns.push(m);
        }

        const hasCategoryPath = group_by?.some((g) => g.name === "category__path" || g.name === "category__name");

        let q = (hasCategoryPath
          ? this.db
              .selectFrom("transaction")
              .innerJoin("category as c", "c.id", "transaction.category_id")
              .leftJoin("category as p1", "p1.id", "c.parent_id" as any)
              .leftJoin("category as p2", "p2.id", "p1.parent_id" as any)
          : this.db
              .selectFrom("transaction")
              .innerJoin("category as c", "c.id", "transaction.category_id")
        ) as any;

        q = q
          .select((eb: any) => [
            ...dimExprs.map((d) => (d.expr as any).as(d.colName)),
            ...coreMetrics.map((m) => (METRICS[m](eb) as any).as(m)),
          ])
          .where("transaction.user_id", "=", userId)
          .where("transaction.date", ">=", from)
          .where("transaction.date", "<=", to);

        // Apply where filters
        for (const w of (where ?? [])) {
          const dimExpr = this._dimensionExpr(w.dimension);
          q = q.where(dimExpr, w.operator as any, w.value);
        }

        // GROUP BY — must repeat full expression (SQLite rejects alias in GROUP BY)
        for (const d of dimExprs) {
          q = q.groupBy(d.expr);
        }

        // ORDER BY
        if (order_by?.length) {
          for (const ob of order_by) {
            q = q.orderBy(ob.name as any, ob.descending ? "desc" : "asc");
          }
        } else {
          // Default: order by first metric desc
          q = q.orderBy(coreMetrics[0] as any, "desc");
        }

        if (limit) q = q.limit(limit);

        const dbRows = await q.execute() as Record<string, unknown>[];
        const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

        // Map day_of_week index to label
        const dowCols = dimExprs
          .filter((d) => d.colName === "metric_time__day_of_week")
          .map((d) => d.colName);

        for (const dbRow of dbRows) {
          const mapped: Record<string, unknown> = {};
          for (const col of columns) {
            let val = dbRow[col];
            if (dowCols.includes(col) && typeof val === "string") {
              val = DOW_LABELS[Number(val)] ?? val;
            }
            mapped[col] = typeof val === "bigint" ? Number(val) : val;
          }
          rows.push(mapped);
        }
      }
    }

    const result: QueryResult = { columns, rows, meta: { period: periodKey } };

    // MoM comparison: run same query for prior period and merge _prev columns
    if (compare_previous_period && coreMetrics.length > 0) {
      const [y, m] = periodKey.split("-").map(Number);
      const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      const prevResult = await this.queryMetricsForPeriod({
        userId,
        periodKey: prevKey,
        metrics: coreMetrics,
        group_by,
        where,
        order_by,
        limit,
      });

      // Add _prev columns
      for (const m of coreMetrics) {
        result.columns.push(`${m}_prev`);
      }
      if (result.meta) result.meta.compare_period = prevKey;

      // Match rows by dimension values; fall back to positional for scalar
      const dimCols = (group_by ?? []).map((g) => g.grain ? `${g.name}__${g.grain}` : g.name);
      for (const row of result.rows) {
        let prevRow: Record<string, unknown> | undefined;
        if (dimCols.length > 0) {
          prevRow = prevResult.rows.find((pr) =>
            dimCols.every((dc) => pr[dc] === row[dc])
          );
        } else {
          prevRow = prevResult.rows[0];
        }
        for (const m of coreMetrics) {
          row[`${m}_prev`] = prevRow?.[m] ?? 0;
        }
      }
    }

    return result;
  }

  private async _resolvePeriod(userId: string, periodKey: string): Promise<{
    from: string;
    to: string;
    budgetAmount: number | null;
    daysElapsed: number;
    daysTotal: number;
  }> {
    const budget = await this.db
      .selectFrom("monthly_budget")
      .select(["amount", "start_date", "end_date"])
      .where("user_id", "=", userId)
      .where("month", "=", periodKey)
      .executeTakeFirst();

    const computed = getBudgetPeriod(periodKey);
    const from = budget?.start_date ?? computed.start;
    const to = budget?.end_date ?? (() => {
      const d = new Date(computed.end + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().substring(0, 10);
    })();

    const today = new Date().toISOString().substring(0, 10);
    const startD = new Date(from + "T00:00:00Z");
    const endD = new Date(to + "T00:00:00Z");
    const todayD = new Date(today + "T00:00:00Z");
    const daysTotal = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
    const daysElapsed = Math.min(
      daysTotal,
      Math.max(0, Math.round((todayD.getTime() - startD.getTime()) / 86400000) + 1)
    );

    return { from, to, budgetAmount: budget?.amount ?? null, daysElapsed, daysTotal };
  }

  private _dimensionExpr(name: DimensionName, grain?: TimeGrain): RawBuilder<unknown> {
    if (name === "metric_time") return this._timeDimExpr(grain ?? "day");
    if (name === "category__path") return sql`CASE
      WHEN c.level = 1 THEN c.name
      WHEN c.level = 2 THEN (COALESCE(p1.name, '') || ' > ' || c.name)
      ELSE (COALESCE(p2.name, '') || ' > ' || COALESCE(p1.name, '') || ' > ' || c.name)
    END`;
    if (name === "category__name") return sql`c.name`;
    if (name === "transaction__type") return sql`"transaction".type`;
    return sql`NULL`;
  }

  private _timeDimExpr(grain: TimeGrain): RawBuilder<string> {
    if (grain === "week") return sql<string>`strftime('%Y-W%W', "transaction".date)`;
    if (grain === "month") return sql<string>`strftime('%Y-%m', "transaction".date)`;
    if (grain === "day_of_week") return sql<string>`strftime('%w', "transaction".date)`;
    return sql<string>`"transaction".date`;
  }
}

export function createAnalyticsService(db: Kysely<Database>): AnalyticsService {
  return new AnalyticsService(db);
}
