# Intent - Credit Card Spending and Statements

> Source: behavior interview (2026-08-25). This document refines the dashboard
> rules in `budget-behavior.md` §7 and the payment-method rule in
> `transactions-behavior.md` §3. Where they differ, this document is authoritative
> for credit-card behavior.

## 1. Goal

The primary goal is to track **how much was spent in each working-day budget
period**.
Credit-card billing cycles must not shift a purchase into the month when its bill
is paid.

## 2. Transaction logging

- The existing transaction flow remains unchanged.
- A consumption expense has a payment-method choice: **cash** or a selected
  **credit-card group**.
- A credit-card group has one monthly statement-close day.
- A credit-card-group purchase is an ordinary categorized expense and can be linked to active
  custom budgets exactly as a cash purchase can.

## 3. Monthly budget and dashboard

- Monthly spending and budget usage are based on the **transaction date**.
- Both cash purchases and credit-card purchases count in that month's total
  spending exactly once.
- The primary dashboard number is the month's total spending, for example:
  `Tổng chi 15.000.000đ`.
- A supporting line exposes the unpaid subset, for example:
  `Trong đó 3.000.000đ dùng thẻ chưa thanh toán`.
- The unpaid-card amount is part of total spending, never an additional expense.
- Paying a statement never changes a past month's total spending, monthly budget,
  pace, or custom-budget spending.

## 4. Statements and payment

- A statement belongs to a credit-card group, not to an individual card.
- Its period is determined by the group's close day; purchases linked to the
  group during that period belong to the same statement.
- A statement can only be **unpaid** or **paid in full**. Partial payment,
  installments, interest, and fees are out of scope.
- Marking a statement paid records the payment date and marks all of its included
  group purchases as no longer unpaid.
- There is no separate expense transaction for a statement payment. It is payment
  metadata, preventing the purchase from being counted a second time.
- The dashboard's unpaid-card amount is the sum of group purchases in every unpaid
  statement, including the current open statement period.

## 5. Credit-card screen

- Shows credit-card groups and their aggregate unpaid totals.
- Opening a group shows its statements, status, amount, and included purchases.
- The user can mark an entire unpaid statement as paid and supply its payment
  date.
- Groups support create, edit, and delete from the same screen.

## 6. Out of scope

- Partial statement payments.
- Interest, late fees, installments, card limits, or due-date reminders.
- Splitting one transaction across cash and card.
- Treating statement payments as a new monthly expense.
