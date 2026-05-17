import type { Kysely } from "kysely";
import type { Database } from "@/lib/schema";
import { METRICS, type MetricName, type Breakdown } from "./metrics";

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
}

export function createAnalyticsService(db: Kysely<Database>): AnalyticsService {
  return new AnalyticsService(db);
}
