# Credit Card Behavior

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |
| Decision | [`ADR 004`](../../decisions/004-credit-card-statements-separate-from-budgets.md) |

## Card Groups And Purchases

- A card group has a user-visible name and monthly statement-close day.
- A card purchase remains an ordinary categorized consumption expense. Its transaction
  date determines monthly-budget inclusion.
- A purchase belongs to at most one card group. Cash and card payment are mutually
  exclusive.

## Statements

- A statement belongs to one group and stores an immutable date range once created.
- Statements are created lazily when the card surface needs the period.
- Changing a group's close day affects newly created statements only.
- Persisted status is `unpaid` or `paid`; the current open period is a period kind,
  not a third payment status.

## Payment

- Statements are paid in full and require a non-future payment date.
- Payment updates statement metadata and does not create another expense transaction.
- Partial payments, interest, fees, and installments are out of scope.

## Financial Meaning

Unpaid card spending includes unpaid closed statements and the current open period.
It is a subset of total consumption spending, never an amount added on top of total
expense. Dashboard presentation must state this relationship explicitly.

Historical transaction create, edit, or delete operations must update the affected
statement assignment and unpaid totals without changing the immutable range of an
already persisted statement.

## Integrity

A group with associated purchases or statements cannot be deleted silently. The UI
must explain the blocking relationship and preserve all transaction history.
