# Intent - Monthly and Custom Budget Behavior

> Source: confirmed behavior interview (2026-08-25). This document supersedes
> the earlier ledger-based budget intent. Transactions use simple CRUD; budgets
> use the established working-day budget periods.

## 1. Monthly budget

- A budget applies from the previous month's last working day (inclusive) to the
  current month's last working day (exclusive).
- A user must create the budget period that contains a transaction before
  recording it.
- A budget has a spending limit, optional short objective, and adjustment history.
- The default limit comes from the user's budget configuration.
- Changing the limit records a signed adjustment with a required reason and time.
- Remaining budget = current limit plus all adjustments minus monthly spending.

## 2. What counts as monthly spending

- Spending is calculated by transaction date within the selected working-day
  budget period.
- It includes only consumption expenses, paid by cash or credit card.
- It excludes lending, borrowing and debt repayment, savings deposits and
  withdrawals, and credit-card statement payments.
- System debt and savings categories identify non-consumption expenses and therefore
  exclude them from the monthly budget. Transaction direction alone is not
  sufficient; users cannot change or delete these system categories.

## 3. Custom budgets

- A custom budget tracks consumption spending across months.
- Its target is informational: exceeding it warns but never blocks a transaction.
- Only active custom budgets appear in the transaction form.
- One consumption transaction may link to multiple custom budgets; each linked
  budget receives the transaction's full amount.
- Debt and savings transactions cannot link to a custom budget.
- A custom budget can be renamed, activated or deactivated, and have its target
  changed. Target changes retain adjustment history.
- It can be deleted only when it has no linked transactions.

## 4. Dashboard

- The primary number is total consumption spending for the selected budget
  period.
- Budget remaining and pace use the same consumption amount.
- Credit-card spending is included on its transaction date. The unpaid-card
  amount is shown as a subset of total spending, never as an additional expense.

## 5. Out of scope

- Custom date ranges for monthly budgets beyond the established working-day rule.
- Partial custom-budget allocation.
- Append-only ledger accounting and transaction reversals.
