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
