# Budget Behavior

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Monthly Period

- A user has at most one monthly budget for a month label.
- Its range starts on the previous month's last Vietnamese working day, inclusive,
  and ends on the current month's last working day, exclusive.
- Weekends and configured Vietnamese public holidays are non-working days.
- Calculated boundaries are stored when the budget is created and do not drift when
  holiday logic changes later.
- A consumption expense requires the monthly budget covering its transaction date.

## Effective Limit And Adjustments

- `monthly_budget.amount` is the current effective limit, not the original amount.
- Adjusting a budget atomically updates `amount` and appends an immutable audit row
  containing the signed delta, reason, and timestamp.
- Adjustment rows are never summed into `amount` again when calculating the limit.
- The resulting limit must remain positive.
- Budget configuration supplies a default for newly created periods and never changes
  an existing period retroactively.

## Objective

A monthly budget may have one optional plain-language objective of at most 500
characters. It gives the period context but never changes the effective limit,
consumption classification, or pace calculation. Creating or editing an objective
trims surrounding whitespace; an empty value removes it.

## Consumption Spending

Monthly spending includes only consumption expenses in the stored period. It includes
cash and card purchases exactly once and excludes income, lending, borrowing,
repayment, savings movement, and statement-payment metadata.

Formulas and query semantics are owned by
[`architecture/semantic-layer.md`](../../architecture/semantic-layer.md).

## Pace Line

The Dashboard pace line compares cumulative consumption with an ideal cumulative
path over the stored working-day period. It uses the current effective limit and must
be recomputed when historical transactions or the limit change.

## Custom Budgets

- A custom budget is open-ended across months and has a positive target amount.
- The same expense may count fully toward multiple custom budgets.
- Exceeding the target informs the user but does not block transactions.
- Active budgets may be selected by new transactions; inactive budgets retain history.
- Target changes retain an audit history of previous and new amounts.
- A custom budget with linked transactions cannot be deleted.

## Required States

Missing, unused, exactly exhausted, exceeded, inactive, historical, adjusted, and
partially unavailable budgets must remain distinguishable.
