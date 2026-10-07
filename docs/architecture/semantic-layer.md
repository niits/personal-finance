# Semantic Layer

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Principle

Financial arithmetic is deterministic server-side code. LLMs receive computed metrics
and may explain them; they never calculate balances, percentages, rankings, or trends.

## Core Measures

| Metric | Definition |
|---|---|
| `consumption_expense` | Sum of expense transactions whose category budget behavior is `consumption`. |
| `total_income` | Sum of income transactions in the selected grain. |
| `net_cashflow` | Income minus all cash outflow for a cashflow view; never used as budget remaining. |
| `transaction_count` | Count of transactions in the selected grain and classification. |
| `unpaid_card_spend` | Consumption purchases assigned to unpaid statements or the current open card period. |

`unpaid_card_spend` is a subset of `consumption_expense`. Income and cashflow
measures describe money movement only; they are reported separately and never feed
budget metrics. `transaction_count` always names its classification (for example,
consumption transaction count) and never mixes classifications in one count.

## Budget Metrics

```text
effective_limit = monthly_budget.amount
budget_remaining = effective_limit - consumption_expense
budget_used_ratio = consumption_expense / effective_limit
```

Adjustment rows are audit history and are never added to `effective_limit`. Budget
metrics exclude finance movements and statement-payment metadata. The stored budget
period, not a reconstructed calendar month, defines the grain.

## Pace Line

For each elapsed working day in the stored period:

```text
ideal_cumulative(day) = effective_limit * elapsed_working_days / total_working_days
actual_cumulative(day) = cumulative consumption_expense through that day
```

The series includes zero-spend working days, handles an unstarted or completed period,
and recomputes after transaction or limit changes. The Dashboard owns presentation.

## Other Domain Metrics

- A custom budget sums the full amount of each associated consumption expense.
- Debt and savings balances derive from direction-aware associated transactions and may
  cross zero.
- Card statement totals derive from group purchases inside the statement's stored
  range.
- Statistics dimensions may include time, category, payment method, custom budget, and
  finance kind only when the underlying measure is explicit.

## Historical Mutation

Creating, editing, moving, recategorizing, or deleting a historical transaction marks
every affected report grain dirty and changes validators for all dependent metrics.
Moving a transaction touches both its previous and new periods.

## Query Interface

The analytics service accepts an authenticated user ID, explicit period/grain, metric
identifier, and validated dimensions. Queries always scope by user before aggregation.
Metric metadata records label, unit, valid dimensions, empty behavior, and whether
higher values are positive, negative, or contextual.

## SQLite And D1 Constraints

Use SQLite-compatible expressions and explicit date boundaries. Avoid unsupported
database functions and driver transactions. When one logical operation requires
atomic writes, use a D1-supported batch or equivalent atomic mechanism.

## Adding A Metric

Define the business meaning and grain, implement deterministic tests, expose it through
the analytics service, and only then make it available to AI tools or charts. A new
metric must not silently reuse `total_expense` when the intended domain is consumption.

## Statistics Evidence Model

Statistics persist a versioned server-computed snapshot with each report. Version 3
records inclusive period boundaries, the last included date, the previous comparison
range, the comparison basis, current and previous metrics, category and card-group
breakdowns, notable consumption transactions, and chart datasets. `model_id`,
`report_version`, and `source_revision` record generation provenance.

`card_spend` is consumption paid through a card group; `cash_spend` is the remaining
consumption. `unpaid_card_spend` counts purchases in the selected period that are not
covered by a paid statement, including open-period purchases. Payment status is read
at generation time; this measure is not the outstanding balance across all periods.
Statement payment changes status without creating additional expense.

Budget usage and percentage exceeded are distinct: `budget_used_pct` measures the
percentage used; `budget_overrun_pct` measures the positive percentage above the
limit. Missing limits and undefined changes remain null. Calendar-day `daily_pace`
and `projected_total` are explicitly labeled pace extrapolations; they are separate
from the working-day Dashboard pace line.

An active period compares the same elapsed number of calendar days in the previous
stored period, capped at that period's end. If the previous period is shorter, the
comparison basis explicitly states that the durations differ. Completed periods
compare full ranges. Trend charts include zero-spend dates and omit an incomplete
current day.

The snapshot also includes deterministic top-two transaction concentration (amount,
integer percentage of consumption, and remaining consumption). This excludes financial
movements. Dataset row IDs are deterministic tuples of the category/date and series.
The model selects a server-provided dataset ID, an allowed chart template, and zero or
more row IDs for emphasis. It cannot supply chart values, chart code, or styling.
Dataset IDs must be unique across insights; type and highlight membership are validated.
The model may choose no chart. Sparse reports may contain one insight. Card insights
are optional and retain the unpaid-subset explanation when relevant. The server verifies chart references, literal currency amounts,
percentages, and sentence endings before saving. These checks establish numerical
provenance; they do not prove that every interpretation or causal statement is correct.

A user-scoped revision increments on transaction, category, monthly-budget, card-group,
and statement mutations. Triggers conservatively mark the user's reports dirty,
including historical reports and reports comparing with changed periods. Saving a
report checks the captured revision atomically; data changed during generation leave
the saved report dirty.
