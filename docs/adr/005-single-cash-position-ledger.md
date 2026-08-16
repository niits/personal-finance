# ADR 005: Use a Single-Cash Position Ledger

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-08-16 |
| Author | niits |
| Related | BRD.md, TECHNICAL_DESIGN.md, SEMANTIC_LAYER.md |

## Context

The product must answer two questions quickly:

1. How much am I spending, and where is it going?
2. How much can I safely spend while maximizing savings?

The current `income | expense` transaction model cannot answer both correctly. Credit-card purchases are expenses while card payments are principal transfers. Term deposits and personal lending exchange liquid cash for receivables. Borrowed principal and principal repayments are not income or expenses. Flags such as `is_credit_card` cannot model balances or cross-period payments.

A full multi-account ledger would be correct but unnecessarily complex for this user. The product will not distinguish checking accounts, wallets, or physical cash. It will track one aggregate liquid-cash balance and named financial positions.

A position is a principal-only claim:

- Positive balance: money owed to the user, such as a term deposit or personal loan.
- Negative balance: money the user owes, such as a credit card or personal borrowing.

Interest, investments, multi-currency, bank sync, and split payments are outside this decision.

## Decision

Use a simplified balanced ledger based on:

```text
cash + net positions = opening equity + income - expenses
```

Every event must satisfy:

```text
cash_delta + position_delta
  = equity_delta + income_delta - expense_delta
```

The client sends semantic commands only. It never sends ledger deltas. The server maps each command to one exhaustive event shape, and SQLite checks both arithmetic balance and the allowed shape for that event kind.

Budgets remain planning data and never change ledger balances.

## Ledger Profile

One profile establishes the ledger boundary and safe-to-spend reserve:

```sql
CREATE TABLE financial_profile (
  user_id               TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  ledger_start_date     TEXT NOT NULL,
  minimum_cash_reserve  INTEGER NOT NULL DEFAULT 0
                          CHECK (minimum_cash_reserve >= 0),
  initialized_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (
    length(ledger_start_date) = 10 AND
    ledger_start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  )
);

CREATE TABLE financial_profile_adjustment (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  target      TEXT NOT NULL CHECK (target = 'minimum_cash_reserve'),
  delta       INTEGER NOT NULL CHECK (delta != 0),
  note        TEXT NOT NULL CHECK (length(trim(note)) > 0),
  write_key   TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);
```

The profile stores immutable opening policy. Reserve changes append `financial_profile_adjustment`; effective reserve is the initial value plus adjustment deltas and cannot become negative. The API additionally validates that dates are real calendar dates. Actual events before `ledger_start_date` or after the current Vietnam date are rejected. Future intentions belong to schedules, not the actual ledger.

## Financial Position

```sql
CREATE TABLE financial_position (
  id                    TEXT NOT NULL,
  user_id               TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN (
                          'term_deposit',
                          'personal_receivable',
                          'credit_card',
                          'personal_payable'
                        )),
  counterparty          TEXT,
  due_date              TEXT,
  reserve_against_cash  INTEGER NOT NULL
                          CHECK (reserve_against_cash IN (0, 1)),
  note                  TEXT,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (id),
  UNIQUE (id, user_id)
);

CREATE INDEX idx_financial_position_user_kind
  ON financial_position(user_id, kind);
```

Server defaults are exhaustive and tested:

| Kind | Expected balance | Reserve against cash |
|------|------------------|----------------------|
| `term_deposit` | Positive | No |
| `personal_receivable` | Positive | No |
| `credit_card` | Negative | Yes |
| `personal_payable` | Negative | No |

Expected signs are warnings, not constraints, because refunds and overpayments may cross zero. Settlement is derived from a zero balance. There is no independently mutable settled status. Financial position kind and monetary history are immutable; descriptive metadata (`name`, `counterparty`, `due_date`, `note`) may be corrected.

Closing is recorded append-only rather than updating the position row:

```sql
CREATE TABLE financial_position_closure (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL,
  position_id          TEXT NOT NULL,
  settlement_event_id  TEXT,
  write_key            TEXT NOT NULL,
  date                 TEXT NOT NULL,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (position_id, user_id)
    REFERENCES financial_position(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (settlement_event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);

CREATE TABLE financial_position_closure_reversal (
  closure_id          TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  reversal_event_id   TEXT,
  write_key           TEXT NOT NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (closure_id, user_id)
    REFERENCES financial_position_closure(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (reversal_event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);
```

At most one closure may be effective for a position; an aborting trigger enforces this instead of `UNIQUE(position_id)`, so a reversed mistaken closure may be followed by a corrected closure. A mistaken nonzero Close is corrected append-only by appending an uncommitted settlement-reversal event, appending `financial_position_closure_reversal` referencing it, and finally appending the event commit marker. Commit validation permits that position-linked reversal only when the matching lifecycle reversal already exists. A mistaken zero-balance Close has no settlement event, so correction appends a lifecycle-only closure reversal with `reversal_event_id = NULL`. A replacement settlement/closure may then be appended. Position rows and lifecycle rows with history are never deleted.

Derived UI status is:

```text
closed   = a closure exists with no closure-reversal row
overdue  = no closure AND balance != 0 AND due_date < today
settled  = no closure AND balance = 0
open     = no closure AND balance != 0
```

## Financial Event

Before creating this table, add composite ownership keys to referenced tables:

```sql
CREATE UNIQUE INDEX ux_category_id_user ON category(id, user_id);
CREATE UNIQUE INDEX ux_budget_period_id_user ON budget_period(id, user_id);
```

All mutating APIs use a user-scoped operation record rather than event-only idempotency:

```sql
CREATE TABLE financial_write_request (
  user_id             TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  idempotency_key     TEXT NOT NULL,
  operation           TEXT NOT NULL,
  request_hash        TEXT NOT NULL,
  result_resource_id  TEXT,
  response_json       TEXT NOT NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, idempotency_key)
);
```

Reusing a key with the same operation and request hash replays `response_json`. Reusing it with a different operation or hash returns `409 IDEMPOTENCY_KEY_REUSED`. Resource IDs are generated by the Worker before the batch, so the idempotency row and conditional resource write can contain the same known ID.

Every handler first looks up the idempotency key before performing state-dependent validation. A matching operation/hash immediately replays its response; a mismatch returns conflict. If no record exists, the first statement of the write batch is a plain `INSERT` into `financial_write_request` with no conflict handler. A concurrent uniqueness violation aborts the entire D1 batch, after which the handler performs the same replay lookup. This prevents retries of full refunds or Close from failing validation against state created by their own first request.

The event schema is:

```sql
CREATE TABLE financial_event (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  write_key         TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN (
                      'opening_cash',
                      'opening_position',
                      'income_cash',
                      'expense_cash',
                      'expense_position',
                      'refund_cash',
                      'refund_position',
                      'cash_to_position',
                      'position_to_cash',
                      'cash_adjustment',
                      'position_adjustment',
                      'reversal'
                    )),
  amount            INTEGER NOT NULL CHECK (amount > 0),
  cash_delta        INTEGER NOT NULL DEFAULT 0,
  position_id       TEXT,
  position_delta    INTEGER NOT NULL DEFAULT 0,
  income_delta      INTEGER NOT NULL DEFAULT 0,
  expense_delta     INTEGER NOT NULL DEFAULT 0,
  equity_delta      INTEGER NOT NULL DEFAULT 0,
  category_id       INTEGER,
  budget_period_id  INTEGER,
  related_event_id  TEXT,
  reversal_of_event_id TEXT,
  note              TEXT,
  date              TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),

  UNIQUE (id, user_id),
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT,
  FOREIGN KEY (position_id, user_id)
    REFERENCES financial_position(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id, user_id)
    REFERENCES category(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (budget_period_id, user_id)
    REFERENCES budget_period(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (related_event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (reversal_of_event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE RESTRICT,

  CHECK (
    length(date) = 10 AND
    date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  CHECK (cash_delta IN (-amount, 0, amount)),
  CHECK (position_delta IN (-amount, 0, amount)),
  CHECK (income_delta IN (-amount, 0, amount)),
  CHECK (expense_delta IN (-amount, 0, amount)),
  CHECK (equity_delta IN (-amount, 0, amount)),
  CHECK (
    cash_delta + position_delta
      = equity_delta + income_delta - expense_delta
  ),
  CHECK (
    (position_delta = 0 AND position_id IS NULL) OR
    (position_delta != 0 AND position_id IS NOT NULL)
  ),
  CHECK (
    (kind = 'opening_cash' AND cash_delta = amount AND position_delta = 0
      AND income_delta = 0 AND expense_delta = 0 AND equity_delta = amount) OR
    (kind = 'opening_position' AND cash_delta = 0 AND position_delta IN (-amount, amount)
      AND income_delta = 0 AND expense_delta = 0 AND equity_delta = position_delta) OR
    (kind = 'income_cash' AND cash_delta = amount AND position_delta = 0
      AND income_delta = amount AND expense_delta = 0 AND equity_delta = 0) OR
    (kind = 'expense_cash' AND cash_delta = -amount AND position_delta = 0
      AND income_delta = 0 AND expense_delta = amount AND equity_delta = 0) OR
    (kind = 'expense_position' AND cash_delta = 0 AND position_delta = -amount
      AND income_delta = 0 AND expense_delta = amount AND equity_delta = 0) OR
    (kind = 'refund_cash' AND cash_delta = amount AND position_delta = 0
      AND income_delta = 0 AND expense_delta = -amount AND equity_delta = 0) OR
    (kind = 'refund_position' AND cash_delta = 0 AND position_delta = amount
      AND income_delta = 0 AND expense_delta = -amount AND equity_delta = 0) OR
    (kind = 'cash_to_position' AND cash_delta = -amount AND position_delta = amount
      AND income_delta = 0 AND expense_delta = 0 AND equity_delta = 0) OR
    (kind = 'position_to_cash' AND cash_delta = amount AND position_delta = -amount
      AND income_delta = 0 AND expense_delta = 0 AND equity_delta = 0) OR
    (kind = 'cash_adjustment' AND cash_delta IN (-amount, amount) AND position_delta = 0
      AND income_delta = 0 AND expense_delta = 0 AND equity_delta = cash_delta) OR
    (kind = 'position_adjustment' AND cash_delta = 0 AND position_delta IN (-amount, amount)
      AND income_delta = 0 AND expense_delta = 0 AND equity_delta = position_delta) OR
    (kind = 'reversal')
  ),
  CHECK (
    (kind IN ('income_cash', 'expense_cash', 'expense_position',
      'refund_cash', 'refund_position') AND category_id IS NOT NULL) OR
    (kind IN ('opening_cash', 'opening_position', 'cash_to_position',
      'position_to_cash', 'cash_adjustment', 'position_adjustment')
      AND category_id IS NULL) OR
    (kind = 'reversal')
  ),
  CHECK (
    (kind IN ('expense_cash', 'expense_position', 'refund_cash', 'refund_position')
      AND budget_period_id IS NOT NULL) OR
    (kind IN ('opening_cash', 'opening_position', 'income_cash',
      'cash_to_position', 'position_to_cash', 'cash_adjustment',
      'position_adjustment') AND budget_period_id IS NULL) OR
    (kind = 'reversal')
  ),
  CHECK (
    (kind IN ('refund_cash', 'refund_position') AND related_event_id IS NOT NULL) OR
    (kind NOT IN ('refund_cash', 'refund_position') AND related_event_id IS NULL)
  ),
  CHECK (
    kind NOT IN ('cash_adjustment', 'position_adjustment') OR
    (note IS NOT NULL AND length(trim(note)) > 0)
  ),
  CHECK (
    (kind = 'reversal' AND reversal_of_event_id IS NOT NULL) OR
    (kind != 'reversal' AND reversal_of_event_id IS NULL)
  )
);

CREATE UNIQUE INDEX ux_financial_event_opening_cash
  ON financial_event(user_id) WHERE kind = 'opening_cash';

CREATE UNIQUE INDEX ux_financial_event_opening_position
  ON financial_event(position_id) WHERE kind = 'opening_position';

CREATE UNIQUE INDEX ux_financial_event_reversal
  ON financial_event(reversal_of_event_id)
  WHERE reversal_of_event_id IS NOT NULL;

CREATE INDEX idx_financial_event_user_date
  ON financial_event(user_id, date);

CREATE INDEX idx_financial_event_position_date
  ON financial_event(position_id, date);

CREATE TABLE financial_event_commit (
  event_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  write_key    TEXT NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (event_id),
  FOREIGN KEY (event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);
```

An opening cash balance of zero creates no event. Onboarding may create one opening event per existing position, allowing initial card debt or an existing deposit without fabricating cash movement.

Financial events are append-only. `BEFORE UPDATE` and `BEFORE DELETE` triggers always raise. Every write batch inserts the event, all allocation rows, then `financial_event_commit` last. A commit trigger validates the complete cross-row bundle; every reader joins the commit table, so an event is never visible before validation. Allocation insert triggers reject rows after a commit marker exists, and allocation update/delete triggers always raise. Commit-marker update/delete triggers also always raise. D1 batch atomicity ensures failed or incomplete bundles leave no rows.

Corrections create one `reversal` event with exact opposite deltas and copied position/category/period attribution, followed by an optional replacement semantic event in the same idempotent batch. A reversal uses the original event's economic `date`; `created_at` records when the correction was actually made. This restates historical as-of reports while preserving the audit timeline. Reversal allocation rows exactly negate the original allocation set and are verified when the reversal commit marker is inserted. A trigger verifies exact negation, same user, same amount and references, that the target is not an opening or reversal, and that it has not already been reversed. `related_event_id` is not copied: a refund reversal points to the refund through `reversal_of_event_id`, while category, period, position, and allocations mirror the refund. Reports sum committed originals and reversals, preserving history while netting corrections to zero.

Opening events are created only by initialization, must use `ledger_start_date`, and can never be reversed. An expense with dependent refunds can be reversed only after every dependent refund has been reversed, in any order, in the same or earlier batches. Refunds can reference only a committed, unreversed expense. Position-linked events cannot be committed while an effective closure exists; closure correction is the sole exception and follows the ordering defined above.

## Event Mapping

| Action | Kind | Cash | Position | Income | Expense | Equity |
|--------|------|------|----------|--------|---------|--------|
| Initial liquid cash | `opening_cash` | `+A` | `0` | `0` | `0` | `+A` |
| Initial receivable/payable | `opening_position` | `0` | `+/-A` | `0` | `0` | `+/-A` |
| Income | `income_cash` | `+A` | `0` | `+A` | `0` | `0` |
| Cash/debit expense | `expense_cash` | `-A` | `0` | `0` | `+A` | `0` |
| Credit-card expense | `expense_position` | `0` | `-A` | `0` | `+A` | `0` |
| Cash refund | `refund_cash` | `+A` | `0` | `0` | `-A` | `0` |
| Card refund | `refund_position` | `0` | `+A` | `0` | `-A` | `0` |
| Place deposit/lend/pay principal | `cash_to_position` | `-A` | `+A` | `0` | `0` | `0` |
| Mature deposit/receive principal/borrow | `position_to_cash` | `+A` | `-A` | `0` | `0` | `0` |
| Reconcile cash | `cash_adjustment` | `+/-A` | `0` | `0` | `0` | `+/-A` |
| Reconcile position | `position_adjustment` | `0` | `+/-A` | `0` | `0` | `+/-A` |

The server validates semantic compatibility in addition to SQL shape checks:

- `expense_position` and `refund_position` require a `credit_card` position.
- Income categories are valid only for `income_cash`; expense categories are valid only for expense/refund events.
- A refund must reference an expense for the same user and payment medium.
- Cumulative refunds cannot exceed the original expense amount.
- Position movement commands are constrained by position kind and action.
- Position `kind` is immutable after creation because it determines actions, grouping, and timeline labels.

Cross-row invariants use SQLite triggers with `RAISE(ABORT, 'stable_error_code')`. Triggers reject refund overages or mismatched media, overlapping periods, invalid openings or reversals, events appended during effective closure, and invalid closure bundles. A nonzero Close must reference a committed settlement event from the same user, position, write request, and date; its kind/deltas must move the complete pre-close signed balance to zero. Close date must be at least the latest existing position-event date and no later than today. A zero-balance Close has no settlement event. A trigger failure aborts and rolls back the complete D1 batch, including its idempotency claim. Application prechecks provide friendly errors, but triggers are the concurrency-safe integrity boundary; a zero-row conditional mutation is never treated as transactional failure.

## Position Read Model

The position list groups rows by economic meaning rather than exposing ledger terminology:

| UI group | Position kinds | Primary value |
|----------|----------------|---------------|
| Credit cards | `credit_card` | Outstanding card debt and period card spending |
| Owed to me | `personal_receivable` | Principal still collectible |
| I owe | `personal_payable` | Principal still payable |
| Term deposits | `term_deposit` | Principal still held and maturity date |

The list response includes per group totals and, per position, `balance`, derived `status`, `due_date`, `counterparty`, and latest activity date. Closed positions are hidden by default and available in a separate history section.

Positions remain in the group defined by immutable `kind`. If a refund or overpayment crosses zero, the UI changes the balance label rather than moving the position. Group summaries expose normal outstanding principal and opposite-sign credit separately; they never add absolute values together.

The position detail response includes a complete chronological timeline. UI activity labels are derived from event kind plus position kind:

| Position | Event | UI activity |
|----------|-------|-------------|
| Credit card | `expense_position` | Purchase, including category and custom allocations |
| Credit card | `refund_position` | Purchase refund |
| Credit card | `cash_to_position` | Card payment |
| Receivable | `cash_to_position` | Money lent |
| Receivable | `position_to_cash` | Principal received |
| Payable | `position_to_cash` | Money borrowed |
| Payable | `cash_to_position` | Principal repaid |
| Term deposit | `cash_to_position` | Deposit funded |
| Term deposit | `position_to_cash` | Principal withdrawn/matured |
| Any | `opening_position` | Opening balance |
| Any | `position_adjustment` | Balance adjustment |
| Any | Event referenced by `financial_position_closure` | Full settlement and close |
| Any | `reversal` | Correction reversing an earlier event |

Standard principal movements may not cross zero. Refunds and explicit reconciliation adjustments may cross zero. Close appends the complete signed settlement and the closure record:

```text
if balance > 0:
  append position_to_cash(amount = balance)
  append closure referencing that settlement event
if balance < 0:
  append cash_to_position(amount = abs(balance))
  append closure referencing that settlement event
if balance = 0:
  append closure with no settlement event
```

For a receivable or term deposit this normally receives principal into cash. For a payable or credit card this normally pays principal from cash. If an exceptional credit or overpayment reversed the sign, direction follows the signed balance so there is always a path to zero. The settlement event and closure row are atomic and idempotent. Closing never changes income or expense. Closed positions cannot be reopened; a later relationship creates a new position and preserves a clear historical boundary.

## Budget Model

```sql
CREATE TABLE budget_period (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  start_date       TEXT NOT NULL,
  end_date         TEXT NOT NULL,
  planned_income   INTEGER NOT NULL CHECK (planned_income >= 0),
  savings_target   INTEGER NOT NULL DEFAULT 0 CHECK (savings_target >= 0),
  spending_limit   INTEGER NOT NULL CHECK (spending_limit >= 0),
  objective        TEXT,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, label),
  UNIQUE (id, user_id),
  CHECK (start_date <= end_date),
  CHECK (spending_limit + savings_target <= planned_income)
);

CREATE TABLE budget_period_lock (
  budget_period_id  INTEGER NOT NULL,
  user_id           TEXT NOT NULL,
  first_event_id    TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (budget_period_id),
  FOREIGN KEY (budget_period_id, user_id)
    REFERENCES budget_period(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (first_event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE RESTRICT
);

CREATE TABLE ledger_budget_adjustment (
  id                TEXT PRIMARY KEY,
  budget_period_id  INTEGER NOT NULL,
  user_id           TEXT NOT NULL,
  target            TEXT NOT NULL CHECK (target IN (
                      'planned_income', 'savings_target', 'spending_limit'
                    )),
  delta             INTEGER NOT NULL CHECK (delta != 0),
  note              TEXT NOT NULL CHECK (length(trim(note)) > 0),
  write_key         TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (budget_period_id, user_id)
    REFERENCES budget_period(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);
```

Periods use inclusive `start_date` and `end_date` and may not overlap for one user. An overlap trigger aborts conflicting inserts or boundary changes. The first referencing event appends `budget_period_lock` in the same batch; once present, period boundaries are immutable forever. Every expense persists the period selected by the canonical date-to-period resolver, and an aborting trigger verifies that its date is inside that period. An expense date with no covering period is rejected. Refunds and reversals retain the original event's period so they restore the plan that funded it.

Budget financial values are append-only. `budget_period` stores the initial plan; every change appends an idempotent `ledger_budget_adjustment`. Effective planned income, savings target, and spending limit are the initial values plus adjustment sums. An insert trigger raises unless all resulting effective values remain nonnegative and effective `spending_limit + savings_target <= planned_income`. Update/delete triggers protect period locks and adjustment rows. The new adjustment table name avoids collision with the legacy table during expand/contract rollout.

`spending_limit` is the consumption ceiling after protecting `savings_target`. The check against `planned_income` makes that relationship explicit rather than showing a savings target that does not affect decisions.

### Period and custom budget semantics

Budgeting has two explicit levels:

- Every expense/refund belongs to exactly one `budget_period`. Its full `expense_delta` always affects that period.
- A custom budget is an optional envelope inside one budget period. One expense may split its amount across zero, one, or many custom budgets from that same period.

Custom budgets are not independent copies of the same money. The sum allocated across custom budgets cannot exceed the event amount. Any remainder is period spending that is not assigned to a custom envelope. Cross-cutting analytical membership belongs in tags, not budgets.

Custom envelopes use a new table so the additive release does not collide with the legacy open-ended model:

```sql
CREATE TABLE ledger_custom_budget (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  budget_period_id  INTEGER NOT NULL,
  name              TEXT NOT NULL,
  amount            INTEGER NOT NULL CHECK (amount > 0),
  series_key        TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (budget_period_id, user_id)
    REFERENCES budget_period(id, user_id) ON DELETE RESTRICT
);

CREATE TABLE ledger_custom_budget_adjustment (
  id                TEXT PRIMARY KEY,
  custom_budget_id  TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  delta             INTEGER NOT NULL CHECK (delta != 0),
  note              TEXT NOT NULL CHECK (length(trim(note)) > 0),
  write_key         TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (custom_budget_id, user_id)
    REFERENCES ledger_custom_budget(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);

CREATE TABLE ledger_custom_budget_closure (
  id                TEXT PRIMARY KEY,
  custom_budget_id  TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  write_key         TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (id, user_id),
  FOREIGN KEY (custom_budget_id, user_id)
    REFERENCES ledger_custom_budget(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);

CREATE TABLE ledger_custom_budget_closure_reversal (
  closure_id        TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  write_key         TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (closure_id),
  FOREIGN KEY (closure_id, user_id)
    REFERENCES ledger_custom_budget_closure(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, write_key)
    REFERENCES financial_write_request(user_id, idempotency_key) ON DELETE RESTRICT
);
```

`amount` is initial capacity reserved from the parent period. Cap changes append adjustment rows; effective amount is initial amount plus adjustment deltas and may be zero but never negative. The sum of all effective custom-budget amounts in a period cannot exceed effective `spending_limit`. Aborting triggers enforce these invariants when creating an envelope, inserting a custom adjustment, or inserting a parent `spending_limit` adjustment. A trigger permits at most one unreversed closure per custom budget. No custom adjustment or ordinary allocation may be appended during effective custom-budget closure, and closure requires zero `custom_remaining`. If correction of a historical event needs reversal allocations, the same batch first appends `ledger_custom_budget_closure_reversal`, then appends and commits the financial reversal. The envelope becomes open with its newly derived remaining amount and may receive a new closure row after reconciliation. `series_key` optionally links envelopes carried forward under the same project name, but each period owns and funds its own capacity. Custom budgets are not financial accounts and cap adjustments do not move cash.

Replace the boolean junction with amount-bearing allocations:

```sql
CREATE TABLE financial_event_custom_budget_allocation (
  financial_event_id      TEXT NOT NULL,
  custom_budget_id        TEXT NOT NULL,
  user_id                 TEXT NOT NULL,
  allocated_expense_delta INTEGER NOT NULL
                            CHECK (allocated_expense_delta != 0),
  PRIMARY KEY (financial_event_id, custom_budget_id),
  FOREIGN KEY (financial_event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (custom_budget_id, user_id)
    REFERENCES ledger_custom_budget(id, user_id) ON DELETE RESTRICT
);
```

For an expense, allocation deltas are positive. For a refund, they are negative. Aborting triggers enforce:

- Only expense, refund, and reversal events have allocations.
- All allocations belong to the same user.
- Every allocated custom budget belongs to the event's budget period.
- Expense allocation sum is at most the event amount.
- A refund can release only custom-budget amounts allocated by its original expense.
- Total released custom allocation is at most the refund amount.
- Reversal allocations exactly negate the original event's allocations.

Refund category, budget period, and payment medium are derived from the original expense. Refund expense metrics are grouped by `budget_period_id`, not by the refund's cash date. A full refund reverses every original custom allocation. For partial refunds, compute the cumulative target allocation at the new cumulative refunded amount across original custom allocations and the unallocated remainder. Use largest-remainder rounding with ascending custom-budget ID as the stable tie-breaker and sort the unallocated bucket after every custom-budget ID, then write only the difference from amounts already released. This prevents repeated partial refunds from over-releasing any envelope. The client does not provide refund allocations.

All allocations are append-only and protected by update/delete triggers. A reversal event appends exact negative allocations copied from its original event. Custom budgets are never deleted. A closure row may be appended only at zero `custom_remaining`; closed rows remain included in historical reconciliation.

Custom budget values are:

```text
custom_spent
  = SUM(allocated_expense_delta for the custom budget)

custom_remaining
  = effective_custom_budget_amount - custom_spent

period_unallocated_expense
  = period_expense - SUM(custom allocation deltas in the period)

period_unassigned_remaining
  = spending_limit
    - SUM(all effective custom budget amounts in the period, including closed history)
    - period_unallocated_expense
```

Negative `custom_remaining` is allowed and shown as overspending. The following identity must always reconcile:

```text
budget_remaining
  = period_unassigned_remaining + SUM(custom_remaining)
  = spending_limit - period_expense
```

The UI presents period remaining as the total and custom balances plus unassigned remaining as its breakdown. It never adds custom remaining on top of period remaining.

## Derived Metrics

All balance queries require an `as_of` date and use `date <= as_of`:

```text
cash_balance = SUM(cash_delta)
position_balance = SUM(position_delta) grouped by position
net_worth = cash_balance + SUM(position balances)

period_expense = SUM(expense_delta
  WHERE budget_period_id = selected_period AND date <= as_of)
period_income = SUM(income_delta
  WHERE start_date <= date <= MIN(end_date, as_of))
actual_savings = period_income - period_expense
savings_rate = actual_savings / period_income
savings_target_gap = savings_target - actual_savings
```

Savings rate is null when period income is zero. Principal movement and equity adjustments do not affect income, expense, or savings.

Safe-to-spend is:

```text
reserved_payables
  = SUM(position balances
      WHERE reserve_against_cash = 1 AND balance < 0)

cash_after_commitments
  = cash_balance + reserved_payables - minimum_cash_reserve

budget_remaining
  = spending_limit - period_expense

safe_to_spend
  = MIN(cash_after_commitments, budget_remaining)
```

`reserved_payables` is negative. Credit limits never increase safe-to-spend. Term deposits are absent from cash after funding but remain positive positions in net worth. Negative results are shown as warnings, not clamped. If no active budget exists, `safe_to_spend` is null and the UI requires a plan rather than presenting cash-only availability as safe.

Historical `as_of` reports use historical event balances but current policy settings for `minimum_cash_reserve`, `reserve_against_cash`, and effective budget targets. The UI labels this as a recalculation under the current plan; the initial product does not version policy settings.

## API Boundary

Public routes are semantic and use typed request/response schemas:

```text
POST   /api/ledger/initialize
GET    /api/ledger/summary?asOf=YYYY-MM-DD&period=LABEL
POST   /api/ledger/profile/adjustments
GET    /api/budget-periods
POST   /api/budget-periods
PATCH  /api/budget-periods/:id
POST   /api/budget-periods/:id/adjustments
GET    /api/budget-periods/:id/custom-budgets
POST   /api/budget-periods/:id/custom-budgets
PATCH  /api/custom-budgets/:id
POST   /api/custom-budgets/:id/adjustments
POST   /api/custom-budgets/:id/close
GET    /api/financial-events
POST   /api/financial-events/income
POST   /api/financial-events/expense
POST   /api/financial-events/:id/reverse
POST   /api/financial-events/:id/refunds
GET    /api/positions
GET    /api/positions/:id
POST   /api/positions
PATCH  /api/positions/:id
POST   /api/positions/:id/fund
POST   /api/positions/:id/withdraw
POST   /api/positions/:id/pay
POST   /api/positions/:id/borrow
POST   /api/positions/:id/close
POST   /api/positions/:id/close/reverse
POST   /api/reconciliation/cash-adjustments
POST   /api/reconciliation/position-adjustments
```

Every write accepts an `Idempotency-Key` header and is covered by `financial_write_request`, including initialization, metadata corrections, adjustments, reversals, and closure. Ownership failures return `404` to avoid disclosing another user's resources. Validation conflicts such as key reuse with another payload, over-refunds, overlapping periods, and an invalid closure settlement return `409` with a stable error code.

`PATCH /api/positions/:id` accepts descriptive metadata only and never `kind` or balance. `PATCH /api/budget-periods/:id` accepts `objective` and unlocked date metadata only; financial values use adjustments. `PATCH /api/custom-budgets/:id` accepts `name` and `series_key` only; capacity uses adjustments. No route updates or deletes financial events, allocations, adjustments, locks, or closures.

All multi-statement writes use one `D1Database.batch()` call. The first statement claims idempotency; cross-row validation triggers abort the batch on violation. A preceding `SELECT` or a zero-row conditional statement in the same batch is never considered a write gate. Implementations must not use unsupported interactive `BEGIN`/`COMMIT` transactions or separate awaited writes.

## Primary Flows

- Cash expense: amount, category, note, date; creates `expense_cash`.
- Card expense: same form plus card position; creates `expense_position` and reduces budget immediately.
- Card payment: card detail `Pay`; creates `cash_to_position`, reducing cash and debt without expense.
- Term deposit: create position with principal and maturity; creates `cash_to_position`.
- Deposit maturity: position detail `Withdraw`; creates `position_to_cash`, returning principal without income.
- Personal lending: positive receivable funded through `cash_to_position`.
- Personal borrowing: negative payable funded through `position_to_cash`.
- Position close: appends the full remaining settlement movement plus a closure row, preserves the timeline, and removes the position from active entry choices.

The common expense flow remains under ten seconds. Position management is outside that frequent path.

## Invariants

- All queries and writes are scoped to the authenticated `user_id`.
- Composite foreign keys prevent cross-user position, category, period, and related-event links.
- Event arithmetic and kind-specific effect shapes are checked by SQLite.
- The API never accepts delta fields.
- Dates are valid, not before ledger start, and not in the future.
- Opening events are unique per cash ledger or position.
- Financial events, allocations, adjustments, period locks, and closures are append-only; correction uses reversal plus replacement.
- Adjustments require a nonblank reason and never affect operating metrics.
- Refund totals cannot exceed the original expense.
- Custom-budget allocations split an expense and never exceed its amount.
- Budget periods do not overlap and use inclusive bounds.
- Closed positions have zero current balance and permanently reject later financial activity.
- Idempotency prevents duplicate mobile retries.
- All route readers, analytics, pace, dashboard, export, and AI metrics use the same ledger service.

Append-only applies to financial history during the user's account lifetime. Explicit full-account erasure remains the sole deletion exception: deleting the owning auth user may cascade all personal data to satisfy the existing account-deletion contract. No finance API exposes parent deletion as a way to rewrite history.

## Cutover

This is a clean financial reset, not a historical conversion. It uses expand/contract because migrations run before application deployment:

1. Expand release: add new tables under new names while the legacy app continues to work. Add complete legacy export, reset consent, and consumer inventory.
2. Cutover release: after export and consent, freeze legacy writes for that user, initialize the ledger and initial budget atomically, then route every finance reader/writer to versioned ledger APIs and cache keys.
3. Acceptance window: use forward fixes after the first ledger write. Application rollback is allowed only before ledger enablement; rolling back afterward would expose stale legacy balances.
4. Contract release: after user acceptance, remove legacy routes, code, and tables in a separate migration.

No compatibility union or dual write is used. Before per-user initialization, all reads remain legacy. After initialization, all reads are ledger-only. Historical card payments cannot be reconstructed reliably and the user explicitly accepts a fresh financial start.

## Alternatives Considered

### Full double-entry account ledger

Rejected for now. It supports bank-level reconciliation but adds account selection and transfer matching without improving the current decisions.

### Keep `income | expense` and add flags

Rejected. Flags create exceptions and cannot enforce a general accounting invariant.

### Derive effects from kinds at query time

Rejected. Every report would duplicate mappings, and changing a mapping would rewrite historical meaning. Persisted, constrained deltas make reporting direct and stable.

### Treat term deposits as expenses

Rejected. Principal remains an asset and returns at maturity.

## Consequences

- Spending, cash, obligations, savings, and net worth reconcile without multiple bank accounts.
- Card purchases count immediately; card payments never double count.
- Term deposits and personal lending use one receivable abstraction.
- Aggregate cash cannot be reconciled independently against individual banks; this is intentional.
- Semantic event constructors and their SQL shapes become the core tested boundary.
- The cutover touches all finance consumers and must ship atomically.

## References

- [GnuCash Accounting Concepts](https://www.gnucash.org/docs/v5/C/gnucash-guide/basics-accounting1.html)
- [GnuCash Credit Card Charges](https://www.gnucash.org/docs/v5/C/gnucash-guide/cc-entercharge1.html)
- [GnuCash Credit Card Payments and Refunds](https://www.gnucash.org/docs/v5/C/gnucash-guide/cc-enterpay1.html)
- [GnuCash Personal Loan to a Friend](https://www.gnucash.org/docs/v5/C/gnucash-guide/loans_personalLoanToSomeOne.html)
