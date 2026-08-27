# Intent - Transaction, Debt, Savings, and Credit-Card Behavior

> Source: confirmed behavior interview (2026-08-25). This document supersedes
> the earlier six-type append-only ledger intent. It depends on
> `budget-behavior.md` and `credit-card-behavior.md`.

## 1. Transaction model

- Every transaction is either **income** or **expense**.
- Transactions use ordinary CRUD: users can create, edit, and delete them
  directly. There are no reversal events or append-only audit records.
- Amount is a required positive VND integer; date is required and cannot be in
  the future; note is optional.
- Consumption income and expenses require a matching leaf category.

## 2. Consumption expenses

- A consumption expense requires its working-day budget period to already exist.
- It may link to multiple active custom budgets in full.
- Its payment method is cash or a selected credit-card group.
- It counts once toward monthly spending, budget remaining, and pace on its
  transaction date.

## 3. Debts and savings

- Lending, borrowing, debt repayment, savings deposits, and savings withdrawals
  are income or expense transactions linked to a specific debt or savings account.
- They use fixed system non-budget categories and do not affect monthly or custom
  budgets. Users cannot edit, delete, or repurpose these categories.
- The transaction form lets the user select an existing debt or savings account,
  or create one inline. A debt identifies its party; a savings account identifies
  the term deposit.
- The Nợ & Tiết kiệm screen is read-only for transaction entry: it shows each
  debt or savings account's computed balance and history. It does not create
  transactions.

## 4. Credit cards

- A credit-card group has a monthly statement-close day.
- Group purchases remain ordinary consumption expenses.
- Statements group purchases linked to the group for a close period.
- A statement is unpaid or paid in full. Paying it records payment metadata only;
  it does not create another expense or change the original month's budget.
- Dashboard copy shows the total monthly spend and its unpaid-credit-card subset.

## 5. Transaction feed and logging

- The feed is reverse chronological, grouped by date, with month navigation.
- It supports filtering by month, category, custom budget, and note search.
- New transactions default to an expense, today's date, and a focused amount
  input. The form remembers the last category, custom budgets, and payment
  method.

## 6. Out of scope

- Partial credit-card statement payments, interest, fees, installments, and
  reminders.
- Splitting one transaction between cash and a card.
- Append-only ledgers, reversal events, and refund workflows.
