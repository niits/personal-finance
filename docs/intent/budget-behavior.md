# Intent — Monthly & Custom Budget Behavior

> Source: behavior interview (interview-me). This intent was explicitly confirmed by the
> user and is the basis for downstream spec/plan. No code or tests have changed from this
> intent. Written in English for clarity.

## 1. Scope & direction

- Remove the entire **legacy finance system**. Drop tables: `monthly_budget`,
  `custom_budget`, `transaction`, `budget_adjustment`, `budget_config`,
  `transaction_custom_budget`.
- **Fresh start, no migration.** The user will delete all existing data themselves.
- Only the **ledger system** remains (append-only).
- Schema implications:
  - `budget_period` loses `planned_income` and `savings_target` — a period has only a
    spending limit.
  - Remove the **partial allocation** model
    (`financial_event_custom_budget_allocation` with `allocated_expense_delta`). Custom
    budgets link to **whole transactions** instead.
  - Drop `series_key` from custom budgets.
  - Replace the "envelope closure" concept (`ledger_custom_budget_closure` and reversal)
    with an `is_active` toggle.

## 2. Monthly budget = one auto-created period per calendar month

- Exactly **one budget period per calendar month** (like legacy). Periods never overlap.
- Created **lazily** via a dedicated step: when the user opens the budget page for a
  month that has no period yet. No manual creation UI and no concurrent creation during
  writes.
- **Transaction logging is gated on the period**: if no budget period exists, the
  "log transaction" button is **disabled** until the user creates the period (by opening
  the budget page).
- A period has only a **spending limit** (plus label/month, start/end dates, and an
  optional `objective`).
- Default spending limit for a new period comes from
  `budget_config.default_monthly_amount` (default 10,000,000 VND). A UI is required to
  edit this config value.
- `objective`: optional text per month, **length-limited** to keep it short.
- Changing the spending limit mid-month is an **append-only adjustment** (delta +
  mandatory reason/note). The base value is never mutated.
- Remaining = effective spending limit − spent.

## 3. What counts as "spent" for the monthly period

The monthly "spent" counts every **cash outflow that leaves the pocket**, recorded once:

- Consumption expenses (paid by cash or credit card)
- Loans given (`personal_receivable` position grows)
- Savings deposits (`term_deposit` position grows)

It **does not** count:

- Credit card bill payments (the purchase was already counted when made)
- Repaying loans (`personal_payable`)
- Internal transfers

Each outflow is counted exactly **once** — no double counting.

**Implementation note:** "spent" and "income" are **computed metrics**, not stored
columns. Ledger events are unchanged (`cash_to_position` keeps `expense_delta = 0`,
`position_to_cash` keeps `income_delta = 0`). "Spent" = `expense_delta` from expense
events + transfer amounts into receivable/term-deposit positions; "income" =
`income_delta` + transfer amounts out of those positions. The spec defines these metrics
precisely, with reconciliation tests.

## 4. Money coming back

Two distinct rules:

- **Refund of a consumption expense** (returned purchase): reduces the **original
  month's** "spent" (reverses consumption), and reduces **each linked custom budget by
  the exact refund amount**. This is a correction, not income.
- **Loan repayment received / savings withdrawal**: counted as **income in the receiving
  month**. The original month's "spent" stays as-is forever — **no backdating**.

## 5. Custom budget = standalone cross-month tracker

- Purpose: track "how much have I spent on thing X".
- `amount` is a **comparison target only** — never blocks or caps; exceeding it shows a
  warning state, not a block.
- Tracks **consumption only** — loans given and savings deposits are never linkable.
- Operations:
  - **Rename** — allowed anytime.
  - **Toggle `is_active`** — inactive budgets are hidden from the link picker but history
    is kept.
  - **Change amount** — append-only: must log a **delta + mandatory note**.
  - **Delete** — only allowed if the budget has **no current transaction links** (links
    removed via Edit count as gone); blocked otherwise.
- Linking:
  - A transaction links to custom budgets **in whole** (no partial allocation).
  - One transaction can link to **multiple** budgets — budgets are **custom views, not
    mutually exclusive**; each linked budget counts the full transaction amount.
  - Spent = sum of linked transaction amounts, minus refunds (each linked budget reduces
    by the exact refund amount).
  - Links are made at the expense recording screen and **can be changed later**.
  - The picker lists **active** budgets only.

## 6. Lending / savings semantics (user workflow patterns)

- **Paying on behalf of someone**: record **one loan receivable** entry only (no separate
  expense) — each cash outflow is counted exactly once.
- **Directly lending money / depositing into savings**: recorded as a **spend** (counts
  toward the monthly limit), **not** linkable to custom budgets.
- **Borrowing money / paying off credit card bills / internal transfers**: handled on the
  **positions screen**, entirely **outside the budget**.

## 7. Dashboard

- Reads the **active ledger period** (current month) instead of legacy tables.
- Highlights **four numbers**: **cash spent** (actual outflows from cash in the period,
  including credit card bill payments), **cash available**, **amount payable** (credit
  card debt + payables), **budget remaining** (effective limit − budget spent).
- Keeps the pace concept: consumption spent so far vs. the ideal spend up to today.
  **Pace is based on consumption only** — loans given and savings deposits do not move
  the pace line.
- Note: **cash spent (actual) ≠ budget spent** (consumption + lending + savings). They
  diverge when credit card bills are paid.
- Income (incl. loan repayments received and savings withdrawals) affects cash/positions
  and shows in the feed; it does **not** surface on the dashboard.

## 8. Out of scope

- AI and statistics features (to be reworked later).
- Migrating legacy data (fresh start).
- Detailed interest-rate handling and depreciation.