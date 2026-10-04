# Transaction Behavior

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Transaction Model

- A transaction has a positive integer VND amount, `income` or `expense` direction,
  date, and the context required by its kind.
- Future dates are rejected. Current and historical transactions may be created,
  edited, moved between periods, or deleted directly.
- The feed loads the full selected month, groups entries by date, and orders them
  newest first. It has no filter or search contract.

## Consumption

- A consumption transaction uses an assignable leaf category whose budget behavior
  is `consumption`.
- An expense uses cash or one card group. Split payment is not supported.
- An expense may count in multiple active custom budgets; its full amount counts in
  each selected budget.
- Income does not consume a monthly budget.

Budget inclusion is defined in [`budgets.md`](./budgets.md). Card assignment is
defined in [`credit-cards.md`](./credit-cards.md).

## Debt And Savings Movements

- Lending, borrowing, repayment, deposit, and withdrawal are ordinary transactions
  associated with exactly one finance account and a protected non-budget category.
- Debt and savings balances are derived from associated transactions; they are not
  independently editable balances.
- The user selects or creates the finance account inside the shared transaction form.
- Account association may only be created or changed by creating or editing the
  transaction. There is no separate link/unlink workflow or endpoint.
- Reverse balances remain visible and are described truthfully rather than hidden
  with an absolute value.

## Mutation Effects

A transaction mutation must recompute or invalidate every affected projection,
including both old and new periods when its date or kind changes: Dashboard,
monthly/custom budgets, pace line, finance balances, card statements, and statistics
freshness. The cache contract is defined by
[`decisions/006-http-revalidation-for-editable-history.md`](../../decisions/006-http-revalidation-for-editable-history.md).

Deleting a transaction removes its contribution but does not delete its category,
budget, card group, or finance account.

## Form Defaults

The form defaults to expense, today, and focused amount entry. Remembered category,
custom budgets, payment method, or finance account are conveniences only and must be
cleared when incompatible with the selected transaction kind.

## Non-Goals

- Append-only accounting and reversal entries.
- Standalone account-link management.
- Transaction filters, search, or pagination within a selected month.
- Split payments.
