# Reserve Budget Idea

Recorded: 2026-10-09.

Status: Deferred product idea. Implementation is not authorized by this note.
This note is not an approved product behavior contract. Complete the existing work
before planning or implementing this feature.

## Confirmed Intent

Reserve budget behaves like a deposit fund whose balance persists across budget
periods. Depositing into the fund immediately reduces the budget available to spend
in the deposit period.

## Proposed Initial Behavior

- Deposits increase the fund balance and reduce the originating period's available
  budget.
- Withdrawals reduce the fund balance and increase the receiving period's available
  budget.
- Deposits and withdrawals are internal transfers, not consumption expenses or
  actual income.
- The fund balance carries forward across periods without another deduction.
- The initial version provides deposits and withdrawals. Spending uses the normal
  transaction flow after withdrawing to a budget.
- The fund balance must not become negative.
- Editing or deleting a transfer recomputes the fund balance and the affected
  period's available budget.

## Proposed Measures

```text
fund_balance = total_deposits - total_withdrawals
available_budget = effective_limit - consumption_expense
                   - period_deposits + period_withdrawals
```

Example: A VND 20,000,000 limit, VND 8,000,000 consumption, and a VND 5,000,000
deposit leave VND 7,000,000 available and VND 5,000,000 in the fund. Withdrawing
VND 2,000,000 in the following period increases that period's available budget by
VND 2,000,000 and leaves VND 3,000,000 in the fund.

## Decisions Required Before Implementation

- Whether this extends existing savings accounts or introduces a separate fund type.
- Whether multiple funds are supported.
- Deposit behavior when the period has insufficient available budget.
- Rules for historical transfer edits that would make a subsequent balance negative.
- How available budget is presented alongside existing budget remaining, pace,
  statistics, and adjustment history.

Existing savings movements do not consume monthly budget. The deposit effect above
requires an explicit new product contract before implementation.
