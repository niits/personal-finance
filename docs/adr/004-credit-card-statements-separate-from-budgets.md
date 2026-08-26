# ADR 004: Model Credit Cards as Group Statements Separate From Budgets

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-08-25 |
| Author | niits |
| Related | `docs/intent/credit-card-behavior.md` |

## Context

Credit-card statement periods can cross working-day budget boundaries. Making
the statement payment an expense would double-count a purchase; assigning the
purchase to its later payment month would make monthly spending inaccurate.

The product also needs to support multiple cards sharing one statement cycle.

## Decision

Keep a card purchase as the existing categorized expense transaction, with an
optional selected card. Model credit-card structure separately:

- `credit_card_group`: name and monthly statement-close day.
- `credit_card`: belongs to one group and is selectable on an expense.
- `credit_card_statement`: one immutable date range per group and close date,
  with `unpaid` or `paid` status and an optional payment date.

A statement contains the group cards' purchases whose transaction dates fall in
its saved period. Statement records are created lazily when the card screen needs
them, then their date range is not recalculated if group configuration changes.

The monthly budget always sums ordinary expense transactions by their transaction
date. A statement payment is state on `credit_card_statement`, not a second
transaction.

## Alternatives Considered

### Store paid status on every card transaction

Rejected because a payment is made for an entire statement. Updating many rows
duplicates one business fact and makes it difficult to preserve the exact billed
period.

### Record statement payment as an expense transaction

Rejected because the original card purchase already used the budget. It would
double-count monthly spending.

### Align budget periods to statement cycles

Rejected because the core user goal is spending by the established working-day
budget period, while statement
cycles differ across groups.

## Consequences

- Dashboard total spending remains stable after a statement is paid.
- The unpaid-card figure is a derived subset of total spending, not a new expense.
- Changing a group's close day affects newly created statements only.
- No support for partial payments, interest, fees, or installments in this model.
