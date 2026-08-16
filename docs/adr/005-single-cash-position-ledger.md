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
```

The API additionally validates that dates are real calendar dates. Actual events before `ledger_start_date` or after the current Vietnam date are rejected. Future intentions belong to schedules, not the actual ledger.

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
  archived_at           INTEGER,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (id),
  UNIQUE (id, user_id)
);

CREATE INDEX idx_financial_position_user_archived
  ON financial_position(user_id, archived_at);
```

Server defaults are exhaustive and tested:

| Kind | Expected balance | Reserve against cash |
|------|------------------|----------------------|
| `term_deposit` | Positive | No |
| `personal_receivable` | Positive | No |
| `credit_card` | Negative | Yes |
| `personal_payable` | Negative | No |

Expected signs are warnings, not constraints, because refunds and overpayments may cross zero. Settlement is derived from a zero balance. There is no independently mutable settled status. A position can be archived only when its as-of balance is zero.

## Financial Event

Before creating this table, add composite ownership keys to referenced tables:

```sql
CREATE UNIQUE INDEX ux_category_id_user ON category(id, user_id);
CREATE UNIQUE INDEX ux_budget_period_id_user ON budget_period(id, user_id);
CREATE UNIQUE INDEX ux_custom_budget_id_user ON custom_budget(id, user_id);
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

The first statement of every write batch is a plain `INSERT` into `financial_write_request` with no conflict handler. A uniqueness violation aborts and rolls back the entire D1 batch before any side effect commits. The handler then reads the existing request: matching operation/hash replays its response, while a mismatch returns conflict. This claim protocol covers event and non-event writes without relying on affected-row inspection.

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
                      'position_adjustment'
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
  note              TEXT,
  date              TEXT NOT NULL,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch()),

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
      AND income_delta = 0 AND expense_delta = 0 AND equity_delta = position_delta)
  ),
  CHECK (
    (kind IN ('income_cash', 'expense_cash', 'expense_position',
      'refund_cash', 'refund_position') AND category_id IS NOT NULL) OR
    (kind NOT IN ('income_cash', 'expense_cash', 'expense_position',
      'refund_cash', 'refund_position') AND category_id IS NULL)
  ),
  CHECK (
    (kind IN ('expense_cash', 'expense_position', 'refund_cash', 'refund_position')
      AND budget_period_id IS NOT NULL) OR
    (kind NOT IN ('expense_cash', 'expense_position', 'refund_cash', 'refund_position')
      AND budget_period_id IS NULL)
  ),
  CHECK (
    (kind IN ('refund_cash', 'refund_position') AND related_event_id IS NOT NULL) OR
    (kind NOT IN ('refund_cash', 'refund_position') AND related_event_id IS NULL)
  ),
  CHECK (
    kind NOT IN ('cash_adjustment', 'position_adjustment') OR
    (note IS NOT NULL AND length(trim(note)) > 0)
  )
);

CREATE UNIQUE INDEX ux_financial_event_opening_cash
  ON financial_event(user_id) WHERE kind = 'opening_cash';

CREATE UNIQUE INDEX ux_financial_event_opening_position
  ON financial_event(position_id) WHERE kind = 'opening_position';

CREATE INDEX idx_financial_event_user_date
  ON financial_event(user_id, date);

CREATE INDEX idx_financial_event_position_date
  ON financial_event(position_id, date);
```

An opening cash balance of zero creates no event. Onboarding may create one opening event per existing position, allowing initial card debt or an existing deposit without fabricating cash movement.

Events remain editable in the initial product because fast correction is more valuable than an accounting audit workflow. Every edit regenerates all deltas from the semantic command and executes atomically. An event referenced by a refund cannot be deleted. Reconciliation and immutable reversals may be added later if real usage requires them.

Opening events are created only by the initialization command, must use `ledger_start_date`, and cannot later be edited or deleted. An expense with refunds cannot change amount below cumulative refunds, payment medium, position, category, period, or custom-budget links. Position-linked events cannot be created, edited, or deleted while the position is archived.

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

Cross-row invariants use SQLite triggers with `RAISE(ABORT, 'stable_error_code')`. Triggers reject refund overages or mismatched media, overlapping periods, invalid opening events, writes against archived positions, non-zero archival, and edits that invalidate dependent refunds. A trigger failure aborts and rolls back the complete D1 batch, including its idempotency claim. Application prechecks provide friendly errors, but triggers are the concurrency-safe integrity boundary; a zero-row conditional mutation is never treated as transactional failure.

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
  locked_at        INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, label),
  UNIQUE (id, user_id),
  CHECK (start_date <= end_date),
  CHECK (spending_limit + savings_target <= planned_income)
);

CREATE TABLE ledger_budget_adjustment (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_period_id  INTEGER NOT NULL,
  user_id           TEXT NOT NULL,
  target            TEXT NOT NULL CHECK (target IN (
                      'planned_income', 'savings_target', 'spending_limit'
                    )),
  delta             INTEGER NOT NULL CHECK (delta != 0),
  note              TEXT NOT NULL CHECK (length(trim(note)) > 0),
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (budget_period_id, user_id)
    REFERENCES budget_period(id, user_id) ON DELETE CASCADE
);
```

Periods use inclusive `start_date` and `end_date` and may not overlap for one user. An overlap trigger aborts conflicting inserts or boundary changes. The first referencing event sets `locked_at` in the same batch; once set, period boundaries remain immutable even if every event is later deleted. Every expense/refund persists the period selected by the canonical date-to-period resolver.

Budget changes update the effective values stored on `budget_period` and insert a `ledger_budget_adjustment` audit row in one batch. A `BEFORE UPDATE` trigger raises and aborts the batch unless resulting values remain nonnegative and `spending_limit + savings_target <= planned_income`; zero-row gating is not used. All metrics use the effective values on `budget_period`, never a separately summed adjustment value. The new table name avoids collision with the legacy `budget_adjustment` table during expand/contract rollout.

`spending_limit` is the consumption ceiling after protecting `savings_target`. The check against `planned_income` makes that relationship explicit rather than showing a savings target that does not affect decisions.

Custom project budgets remain optional expense tags through this junction:

```sql
CREATE TABLE financial_event_custom_budget (
  financial_event_id  TEXT NOT NULL,
  custom_budget_id    INTEGER NOT NULL,
  user_id             TEXT NOT NULL,
  PRIMARY KEY (financial_event_id, custom_budget_id),
  FOREIGN KEY (financial_event_id, user_id)
    REFERENCES financial_event(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (custom_budget_id, user_id)
    REFERENCES custom_budget(id, user_id) ON DELETE CASCADE
);
```

Conditional insert SQL permits links only for expense/refund events. Refund category, budget period, payment medium, and custom-budget links are derived from the original expense and are not accepted from the client.

## Derived Metrics

All balance queries require an `as_of` date and use `date <= as_of`:

```text
cash_balance = SUM(cash_delta)
position_balance = SUM(position_delta) grouped by position
net_worth = cash_balance + SUM(position balances)

period_expense = SUM(expense_delta WHERE start_date <= date <= MIN(end_date, as_of))
period_income = SUM(income_delta WHERE start_date <= date <= MIN(end_date, as_of))
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
PATCH  /api/ledger/profile
GET    /api/budget-periods
POST   /api/budget-periods
PATCH  /api/budget-periods/:id
POST   /api/budget-periods/:id/adjustments
GET    /api/financial-events
POST   /api/financial-events/income
POST   /api/financial-events/expense
PATCH  /api/financial-events/:id
DELETE /api/financial-events/:id
POST   /api/financial-events/:id/refunds
GET    /api/positions
POST   /api/positions
PATCH  /api/positions/:id
POST   /api/positions/:id/fund
POST   /api/positions/:id/withdraw
POST   /api/positions/:id/pay
POST   /api/positions/:id/borrow
POST   /api/reconciliation/cash-adjustments
POST   /api/reconciliation/position-adjustments
```

Every write accepts an `Idempotency-Key` header and is covered by `financial_write_request`, including initialization, updates, and deletes. Ownership failures return `404` to avoid disclosing another user's resources. Validation conflicts such as key reuse with another payload, over-refunds, overlapping periods, and non-zero archival return `409` with a stable error code.

All multi-statement writes use one `D1Database.batch()` call. The first statement claims idempotency; cross-row validation triggers abort the batch on violation. A preceding `SELECT` or a zero-row conditional statement in the same batch is never considered a write gate. Implementations must not use unsupported interactive `BEGIN`/`COMMIT` transactions or separate awaited writes.

## Primary Flows

- Cash expense: amount, category, note, date; creates `expense_cash`.
- Card expense: same form plus card position; creates `expense_position` and reduces budget immediately.
- Card payment: card detail `Pay`; creates `cash_to_position`, reducing cash and debt without expense.
- Term deposit: create position with principal and maturity; creates `cash_to_position`.
- Deposit maturity: position detail `Withdraw`; creates `position_to_cash`, returning principal without income.
- Personal lending: positive receivable funded through `cash_to_position`.
- Personal borrowing: negative payable funded through `position_to_cash`.

The common expense flow remains under ten seconds. Position management is outside that frequent path.

## Invariants

- All queries and writes are scoped to the authenticated `user_id`.
- Composite foreign keys prevent cross-user position, category, period, and related-event links.
- Event arithmetic and kind-specific effect shapes are checked by SQLite.
- The API never accepts delta fields.
- Dates are valid, not before ledger start, and not in the future.
- Opening events are unique per cash ledger or position.
- Adjustments require a nonblank reason and never affect operating metrics.
- Refund totals cannot exceed the original expense.
- Budget periods do not overlap and use inclusive bounds.
- Archived positions have zero as-of balance.
- Idempotency prevents duplicate mobile retries.
- All route readers, analytics, pace, dashboard, export, and AI metrics use the same ledger service.

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
