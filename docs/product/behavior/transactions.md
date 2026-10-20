# Transaction Behavior

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Transaction Model

- A transaction has a positive integer VND amount, `income` or `expense` direction,
  date, and the context required by its kind.
- Future dates are rejected relative to the user's device time zone. Current and historical transactions may be created,
  edited, moved between periods, or deleted directly.
- The feed loads the full selected month, groups entries by date, and orders them
  newest first. An optional category filter shows transactions matching any selected
  category within that month after confirmation with “OK”. Clearing the selection
  and confirming restores the full feed; changing
  the month resets the selection. Filtering changes visible rows and date subtotals,
  while monthly financial summaries retain their full-period scope.

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
  Lending and received repayments require a lending account; borrowing and outgoing
  repayments require a borrowing account; deposits and withdrawals require a savings
  account. The selector and inline creation use that account family. Changing the
  category or direction clears incompatible account choices. Create and edit APIs
  enforce the same compatibility rule.
- Account association may only be created or changed by creating or editing the
  transaction. There is no separate link/unlink workflow or endpoint.
- Selecting an account in Finance exposes a reduction action: received repayment for
  lending, repayment for borrowing, and withdrawal for savings. The shared form asks
  only for the amount, defaults to the remaining balance, and records today's date
  and the appropriate protected category automatically. Saving preserves all previous
  transactions and associates the new transaction with the same account. Settled or
  reverse balances do not offer an additional reduction.
- Editing an account-associated transaction shows other transactions in the original
  and selected account, including the projected balance after the edit. Changing the
  amount, direction, category, or account recomputes affected balances while retaining
  other transactions unchanged. Edits, reassignment, direction/category changes, and
  deletion must not leave repayments or withdrawals exceeding their account's funding.
- A repayment, received repayment, or withdrawal cannot exceed the remaining amount
  across all transactions in its own account or tracked person. Editing a reduction
  excludes that transaction before calculating its ceiling. Other accounts, even those
  with the same display name, do not supply funds for it. Exact settlement is allowed.
- The form displays the ceiling and blocks saving an excessive amount. The database
  enforces the same rule atomically for concurrent writes; rejected mutations leave
  all related data unchanged and return `422` with `FINANCE_BALANCE_EXCEEDED`.
- Existing reverse balances remain visible and may be corrected without becoming
  more negative. New mutations cannot create a reverse balance.

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
- Transaction search or pagination within a selected month.
- Split payments.
