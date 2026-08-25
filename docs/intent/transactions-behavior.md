# Intent — Transaction CRUD & Logging Flow

> Source: behavior interview (interview-me). This intent was explicitly confirmed by the
> user and is the basis for downstream spec/plan. No code or tests have changed from this
> intent. Written in English for clarity.
>
> Depends on `docs/intent/budget-behavior.md` (removal of legacy, monthly period rules,
> "what counts as spent", and custom-budget linking rules).

## 1. Transaction types

The ledger entry form supports **six types**:

| Type | What it records | Budget impact |
|---|---|---|
| **Income** | Money earned (salary, etc.) | income |
| **Expense** | Consumption spending | reduces monthly spending limit |
| **Loan Given** | Lending money to someone (`personal_receivable`) | reduces monthly spending limit; not linkable to custom budgets |
| **Savings Deposit** | Depositing into a term deposit | reduces monthly spending limit; not linkable to custom budgets |
| **Loan Repayment Received** | Getting repaid on a loan | income; reduces the receivable position |
| **Savings Withdrawal** | Withdrawing from a term deposit | income; reduces the term-deposit position |

Rules carried over from budget intent:

- Loans given and savings deposits count toward the monthly limit (money out of pocket);
  repayment/withdrawal counts as income in the receiving month (**no backdating**).
- Refunds of consumption reduce the original month's spend and each linked custom budget.
- Borrowing (`personal_payable`), credit-card bill payments, and internal transfers are
  handled on the **positions screen**, entirely outside the budget.

## 2. Common fields & constraints

- **Amount**: required, positive integer.
- **Date**: required; not in the future; not before the ledger start date.
- **Note**: optional.
- **Category**: mandatory **leaf** category for Income and Expense (type must match:
  income vs. expense). Loan/savings types do not use categories.

## 3. Per-type fields

- **Income**: amount · category (leaf, income) · date · note.
- **Expense**: amount · category (leaf, expense) · date · note · payment method
  (cash / credit card) · custom-budget links (optional, multiple, active only, whole
  amount).
- **Loan Given**: a button → confirm form → amount · receivable position
  (pick existing or create inline, with counterparty) · date · note. No category, no
  budget link.
- **Savings Deposit**: a button → confirm form → amount · term-deposit position (pick or
  create) · date · note. No category, no budget link.
- **Loan Repayment Received**: a button → confirm form → actual amount
  (**must not exceed the position balance**) · position · date · note.
- **Savings Withdrawal**: a button → confirm form → actual amount
  (**must not exceed the position balance**) · position · date · note.

For the four position-related types there is **no complex picker**: one button on the
position (or quick action) opens a confirm form showing the current balance; the user
enters the actual amount and confirms. The position updates automatically.

## 4. Operations

### Edit
- User taps **Edit** on a transaction → prefilled form → save.
- Internally it is one **atomic, idempotent batch**: reverse the original event + record
  a new event with the edited values (links, category, amount, date, payment method,
  note).
- The user sees a single step; the audit trail (original + reversal + new event) remains
  in the append-only ledger.
- **Blocked when the transaction has refunds** — the user must handle the refunds first.
- **Changing the date across months is allowed**: the old month's spend decreases, the new
  month's spend increases (treated as a legitimate correction).
- **Type cannot be changed** (income ↔ expense is a fundamental accounting change).
- Edit applies to **all six types, including the four position-based types** (amount
  changes included). Position balances are recomputed from the remaining events
  (append-only, no stored balance).

### Delete
- A dedicated **Delete** button; internally a reversal of the event.
- **Blocked when the transaction has refunds** — handle refunds first.

### Refund (consumption expenses only)
- Partial refunds allowed, up to the remaining refundable amount.
- Reduces the original month's "spent".
- Reduces **each linked custom budget by the exact refund amount**.
- A dedicated **delete-refund** action reverses a refund (restores the original month's
  spent and the linked custom budgets). After deleting the refunds, Edit/Delete on the
  transaction are unblocked. Deleting a refund is blocked if later events depend on it.

### Borrow / repay loans, pay credit-card bills, internal transfers
- Positions screen, outside the budget (see budget intent).

## 5. Transaction list / feed

- Reverse-chronological feed, **grouped by day**.
- Filters: **month, category, custom budget**; plus **search by note**.
- Month navigation to browse past months.

## 6. Minimal-interaction logging flow

Goal: record a transaction with the fewest possible taps while keeping all functionality.

- **Gate: if no budget period exists, the "log transaction" button is disabled** (see
  budget intent §2). The period is created via the budget page first.

- Tap **"+"** → the entry sheet opens ready to log:
  - Type defaults to **Expense** (the most common).
  - Date defaults to **today**; date shortcuts: **Today · Yesterday · Nearest past
    weekend** (the most recent Saturday or Sunday strictly before today).
  - **Remembers the last entry**: category, linked custom budgets, payment method (or
    position for the position-based types) are prefilled.
- The **amount field is pre-focused with the numeric keypad** — type the number, then
  tap **Save** → **3 taps total** (open → type amount → save).
- Prefilled fields render as **small chips**; tap only to change. Untouched fields are
  never visited.
- Switching the type collapses the sheet to only that type's fields (no category/budget/
  payment fields for loan/savings types). For repayment/withdrawal the position balance is
  shown; enter actual ≤ balance and confirm.
- A **"Repeat"** button next to recent transactions opens the sheet prefilled identically —
  only the amount is changed (handy for recurring spending like lunch, fuel).

## 7. Out of scope

- Detailed interest-rate handling, depreciation, and AI (reworked later).