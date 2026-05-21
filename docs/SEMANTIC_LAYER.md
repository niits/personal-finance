# Semantic Layer

The analytics layer sits between raw D1/SQLite tables and the AI statistics agent. It follows the same principle as dbt Semantic Layer / MetricFlow: **the LLM names what it wants, the engine computes it deterministically**.

## Core principle

> **LLMs must never do arithmetic.** Any number the agent needs to report must come from a named metric computed server-side. The agent calls `query_metrics({metrics: ["budget_remaining"]})` and gets back `837772` — it never sees `18000000` and `17162228` separately and has to subtract.

## File structure

```
src/lib/analytics/
  metrics.ts   — metric catalog: names, expressions, dimensions, time grains
  service.ts   — AnalyticsService: executes queries, resolves periods
```

---

## Metric catalog (`metrics.ts`)

### Core metrics (Kysely SQL expressions over `transaction JOIN category`)

| Metric | Description | SQL |
|---|---|---|
| `total_expense` | Tổng chi tiêu | `SUM(amount) WHERE type='expense'` |
| `total_income` | Tổng thu nhập | `SUM(amount) WHERE type='income'` |
| `transaction_count` | Số giao dịch | `COUNT(id)` |
| `net` | Thu nhập trừ chi tiêu | `SUM(income - expense)` |

### Derived metrics (require `monthly_budget` — computed in service, not SQL expressions)

| Metric | Formula | Notes |
|---|---|---|
| `budget_remaining` | `budget.amount - total_expense` | Null if no budget set |
| `budget_used_pct` | `round(total_expense / budget.amount * 100)` | Integer percent |
| `daily_pace` | `round(total_expense / days_elapsed)` | Based on days elapsed in period |
| `projected_total` | `daily_pace * days_total` | Full-period projection |

### Dimensions

| Dimension name | Maps to | Notes |
|---|---|---|
| `metric_time` | `transaction.date` | Requires `grain` parameter |
| `category__path` | Full 3-level hierarchy | `"Ăn uống > Ăn ngoài"` — uses 2 SQL self-joins |
| `category__name` | `category.name` (leaf) | Shorter, no parent context |
| `transaction__type` | `transaction.type` | `"expense"` \| `"income"` |

### Time grains

| Grain | SQLite expression | Output format |
|---|---|---|
| `day` | `transaction.date` | `"2026-05-20"` |
| `week` | `strftime('%Y-W%W', date)` | `"2026-W20"` |
| `month` | `strftime('%Y-%m', date)` | `"2026-05"` |
| `day_of_week` | `strftime('%w', date)` mapped | `"CN"` .. `"T7"` |

---

## Query interface (`AnalyticsService`)

### `queryMetricsForPeriod(opts)` — primary method used by AI agent

Mirrors the dbt Semantic Layer `query_metrics` tool interface.

```ts
interface QueryMetricOpts {
  userId: string;
  periodKey: string;   // "YYYY-MM" — used for budget lookup and MoM compare
  from: string;        // resolved + clipped date range (caller's responsibility)
  to: string;
  metrics: AnyMetricName[];
  group_by?: { name: DimensionName; grain?: TimeGrain }[];
  where?: { dimension: DimensionName; operator: string; value: string | number }[];
  order_by?: { name: AnyMetricName; descending?: boolean }[];
  limit?: number;
  compare_previous_period?: boolean;
}

interface QueryResult {
  columns: string[];                  // e.g. ["metric_time__week", "total_expense"]
  rows: Record<string, unknown>[];
  meta?: { period: string; compare_period?: string };
}
```

Column naming follows `__` notation: `metric_time__week`, `category__path`.

### Existing methods (unchanged — backward compatible)

- `queryMetric(opts)` — single metric, raw date range
- `compareMetric(opts)` — two periods, single metric
- `getTimeSeries(opts)` — daily time series

---

## AI agent tools (`statistics.ts`)

The agent has 3 tools:

### `list_metrics`
Returns the full `METRIC_CATALOG`. Agent calls this to discover what's available. Mirrors `dbt sl list metrics`.

### `query_metrics`
Mirrors dbt SL `query_metrics` MCP tool. Input schema is **derived from catalog constants** — adding a new metric to `METRIC_CATALOG` automatically updates the tool schema.

```ts
{
  metrics: z.array(z.enum(METRIC_NAMES)),
  group_by: z.array({ name: z.enum(DIMENSION_NAMES), grain: z.enum(TIME_GRAINS).optional() }).optional(),
  where: z.array({ dimension, operator, value }).optional(),
  order_by: z.array({ name: z.enum(METRIC_NAMES), descending }).optional(),
  limit: z.number().optional(),
  compare_previous_period: z.boolean().optional(),
}
```

### `get_notable_transactions`
Top N transactions by amount with full category path (SQL join, not JS).

### `generate_insights`
Final structured output: 3–5 insights with optional Vega chart data.

---

## SQLite constraints

- No recursive CTEs — category path uses 2 explicit self-joins (`c → p1 → p2`)
- `GROUP BY` alias not supported — repeat the full `CASE` expression
- `COALESCE(p1.name, '')` guards against null parent names in concat

---

## Adding a new metric

1. Add to `DERIVED_METRICS` or create a new Kysely expression in `METRICS`
2. Add entry to `METRIC_CATALOG` with description, validBreakdowns, validTimeGrains, supportsMoM
3. If derived: handle computation in `AnalyticsService.queryMetricsForPeriod`
4. The AI agent tool schema and system prompt update automatically via `METRIC_NAMES`
