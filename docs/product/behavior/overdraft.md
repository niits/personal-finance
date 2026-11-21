# Overdraft Behavior

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-11-21 |

## Model

- An overdraft account (`tài khoản thấu chi`) is a bank borrowing account: a finance
  account of type `debt`, direction `borrow`, marked as overdraft. A user may have
  several, each with a name (for example `Thấu chi VCB`). No credit limit is stored and
  spending is never blocked by a limit.
- Paying from an overdraft account is a payment method, like cash or a card group. An
  expense uses cash, one card group, or one overdraft account; these are mutually
  exclusive. Only consumption expenses can be paid by overdraft.
- An overdraft purchase remains an ordinary categorized consumption expense: it counts
  in the monthly budget and in any selected custom budgets exactly as a cash purchase.

## Amount Owed

- The amount owed to the bank is derived, never edited directly:
  `owed = overdraft purchases − repayments + borrowing movements` on that account.
- A repayment is an ordinary repayment transaction (protected `debt_repayment`
  category) associated with the overdraft account, recorded through the Finance
  reduction action or the transaction form. It reduces the amount owed and cannot
  exceed it; exact settlement is allowed.
- Editing or deleting an overdraft purchase must not leave repayments exceeding the
  amount owed. The database enforces this atomically with the same
  `FINANCE_BALANCE_EXCEEDED` rule as other finance accounts.
- Interest, fees, and limits are out of scope.

## Presentation

- Transaction rows paid by overdraft carry a `Thấu chi` marker with the account name.
- Dashboard states the total currently owed across overdraft accounts as
  `Nợ thấu chi ngân hàng` when it is greater than zero. It is a current balance, not a
  period amount, and overdraft purchases are already included in consumption expense.
- Finance lists overdraft accounts with the debts, labeled `Thấu chi`, with the amount
  owed and the repayment action.

## Integrity

An overdraft account with purchases or repayments cannot be deleted. Deleting a
transaction never deletes its overdraft account.
