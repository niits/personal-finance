# Finance Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

How much do I owe, have saved, and have not yet paid by card?

## Composition

The canonical Finance route is `/finance`. A content selector switches between Nợ,
Tiền gửi, and Chi thẻ; it is not a second global navigation bar. Each mode leads with
one truthful total, then the relevant account or group list.

Finance-account detail uses `/finance/accounts/:id` and shows the computed outcome,
status, and complete movement ledger. Reverse balances use explicit language such as
overpaid, over-received, or over-withdrawn.

Card mode shows groups, statement periods, unpaid totals, and payment state. It states
that unpaid card spending is already included in consumption expense.

## Interaction Boundary

Finance manages account/group metadata and statement payment. Expanding a debt or
savings account exposes its reduction action and complete movement history. The action
is received repayment for lending, repayment for borrowing, and withdrawal for savings.
The shared transaction form asks only for an amount, initially the remaining balance.
It records today and the appropriate protected category automatically. Saving refreshes
the balance and ledger. Settled and reverse balances do not offer another reduction.
Users correct existing movements through transaction editing, which shows related
transactions and projected balances for the original and selected accounts.

## States

Cover loading, partial account/card failure, unused account, zero and reverse balance,
overdue or settled debt, paid/unpaid/open statement period, blocked deletion,
destructive confirmation, and unavailable network.
