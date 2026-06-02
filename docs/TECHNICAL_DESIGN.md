# Technical Design Document
## Personal Finance Tracker

---

| Field | Value |
|-------|-------|
| Type | Technical Design Document |
| Document Version | 1.2 |
| Status | Draft |
| Author | niits |
| Created | 2026-04-29 |
| Last Updated | 2026-05-14 |
| Based On | BRD v1.2, specs/flows.md v1.1, COMPONENT_ARCHITECTURE.md v1.0 |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model](#2-data-model)
3. [Database Schema (SQL)](#3-database-schema-sql)
4. [API Design](#4-api-design)
5. [Edge Cases & Validation Rules](#5-edge-cases--validation-rules)
6. [Computed Values & Business Logic](#6-computed-values--business-logic)
7. [Seeding & Initialization](#7-seeding--initialization)
8. [Error Response Format](#8-error-response-format)
9. [Frontend Architecture](#9-frontend-architecture)

---

## 1. Overview

### 1.1 Architecture

```
Browser (Next.js App Router)
       │  SWR in-memory cache (categories)
       │  HTTP browser cache (Cache-Control headers)
       ▼
Next.js API Routes (/api/*)   ← All requests authenticated via better-auth session
       │
       ▼
Cloudflare D1 (SQLite)        ← Single database, all tables below
```

Deployed on **Cloudflare Workers** via `@opennextjs/cloudflare`.

### 1.2 Auth boundary

Every `/api/*` route (except `/api/auth/*`) must:
1. Call `auth.api.getSession({ headers: request.headers })`
2. If no session → return `401 Unauthorized`
3. Scope every DB query to `user_id = session.user.id`

For optimistic route guarding outside API handlers, use Better Auth's cookie helper instead of manually parsing cookie names. The route guard should rely on `getSessionCookie(request)` from `better-auth/cookies`, while real authorization remains enforced by `auth.api.getSession(...)` inside protected server boundaries and API routes.

---

## 2. Data Model

### 2.1 Entity Relationship Diagram

```
user ────────────────┬──── budget_config (1:1)
                     │
                     ├──── category (1:N, self-referential, max 3 levels)
                     │
                     ├──── monthly_budget (1:N, unique per month)
                     │         └──── budget_adjustment (1:N)
                     │
                     ├──── custom_budget (1:N)
                     │
                     └──── transaction (1:N)
                               │    ├── category (N:1)
                               │    └── monthly_budget (N:1, null for income)
                               └── transaction_custom_budget (N:M)
                                        └── custom_budget (N:1)
```

### 2.2 Entity Descriptions

| Entity | Description | Cardinality |
|--------|-------------|-------------|
| `user` | Managed by better-auth. One row per GitHub account. | — |
| `budget_config` | Default monthly amount. Auto-created on first login. | 1 per user |
| `category` | Hierarchical expense/income labels. Max 3 levels. Has `type` (income/expense). | N per user |
| `monthly_budget` | Budget for a specific budget period (see §6.4). | 1 per user per month |
| `budget_adjustment` | Immutable audit log of each budget change. | N per monthly_budget |
| `custom_budget` | Open-ended named budget (e.g. "Trip Đà Lạt"). | N per user |
| `transaction` | Single expense or income event. May be a debt opening/repayment (`debt_id` set, `category_id` null). | N per user |
| `transaction_custom_budget` | Junction: one expense ↔ many custom budgets. | N:M |
| `debt` | A lending/borrowing relationship; principal derived from its opening transaction. | N per user |
| `ai_suggestion_run` | Tracks each AI suggestion session and its transaction window. | N per user |

---

## 3. Database Schema (SQL)

> Migration file: `0003_finance_schema.sql`

```sql
-- Categories (hierarchical, max 3 levels)
CREATE TABLE IF NOT EXISTS category (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  parent_id   INTEGER REFERENCES category(id) ON DELETE RESTRICT,
  level       INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_category_user_parent
  ON category(user_id, parent_id);

-- Monthly budgets (one per user per budget period)
CREATE TABLE IF NOT EXISTS monthly_budget (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  month      TEXT    NOT NULL,            -- 'YYYY-MM' (budget month label)
  amount     INTEGER NOT NULL CHECK (amount > 0),
  start_date TEXT,                        -- first day of budget period, 'YYYY-MM-DD'
  end_date   TEXT,                        -- last day of budget period, inclusive, 'YYYY-MM-DD'
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_budget_user_month
  ON monthly_budget(user_id, month);

-- Budget adjustment audit log
CREATE TABLE IF NOT EXISTS budget_adjustment (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  monthly_budget_id INTEGER NOT NULL REFERENCES monthly_budget(id) ON DELETE CASCADE,
  delta             INTEGER NOT NULL,     -- positive = increase, negative = decrease
  note              TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_budget_adj_monthly_budget
  ON budget_adjustment(monthly_budget_id);

-- Custom budgets (open-ended, project-style)
CREATE TABLE IF NOT EXISTS custom_budget (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_custom_budget_user
  ON custom_budget(user_id, is_active);

-- Transactions
CREATE TABLE IF NOT EXISTS transaction (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  amount             INTEGER NOT NULL CHECK (amount > 0),
  type               TEXT    NOT NULL CHECK (type IN ('expense', 'income')),
  category_id        INTEGER REFERENCES category(id) ON DELETE RESTRICT,  -- nullable since migration 0012: debt transactions have no category
  note               TEXT,
  date               TEXT    NOT NULL,   -- 'YYYY-MM-DD'
  monthly_budget_id  INTEGER REFERENCES monthly_budget(id) ON DELETE RESTRICT,
  debt_id            TEXT    REFERENCES debt(id) ON DELETE SET NULL,      -- set => this txn is a debt opening or a repayment (migration 0011)
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  -- An expense must belong to a monthly budget OR be a debt entry; income never has a budget (relaxed in migration 0012).
  CHECK (
    (type = 'income') OR
    (type = 'expense' AND (monthly_budget_id IS NOT NULL OR debt_id IS NOT NULL))
  )
);

CREATE INDEX IF NOT EXISTS idx_transaction_user_date
  ON transaction(user_id, date);

CREATE INDEX IF NOT EXISTS idx_transaction_user_category
  ON transaction(user_id, category_id);

CREATE INDEX IF NOT EXISTS idx_transaction_monthly_budget
  ON transaction(monthly_budget_id);

CREATE INDEX IF NOT EXISTS idx_transaction_debt
  ON transaction(debt_id);

-- Debt tracking (lending / borrowing). Repayments are stored as regular
-- transactions with debt_id set; the opening transaction is linked back via
-- opening_transaction_id. Principal is derived from the opening transaction's
-- amount (migrations 0011 + 0013).
CREATE TABLE IF NOT EXISTS debt (
  id                     TEXT    PRIMARY KEY,
  user_id                TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  type                   TEXT    NOT NULL CHECK (type IN ('lend', 'borrow')),
  party                  TEXT    NOT NULL,                 -- who you lent to / borrowed from
  note                   TEXT,
  due_date               TEXT,                             -- 'YYYY-MM-DD' or null; drives overdue flag
  status                 TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  opening_transaction_id INTEGER REFERENCES "transaction"(id) ON DELETE SET NULL,
  created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Junction: expense ↔ custom_budget (N:M)
CREATE TABLE IF NOT EXISTS transaction_custom_budget (
  transaction_id   INTEGER NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
  custom_budget_id INTEGER NOT NULL REFERENCES custom_budget(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, custom_budget_id)
);

CREATE INDEX IF NOT EXISTS idx_txn_custom_budget_budget
  ON transaction_custom_budget(custom_budget_id);

-- AI suggestion run history (tracks transaction window per run)
CREATE TABLE IF NOT EXISTS ai_suggestion_run (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  from_tx_id   INTEGER,                   -- NULL = start from beginning of history
  up_to_tx_id  INTEGER NOT NULL,          -- max transaction id at time of run
  status       TEXT    NOT NULL CHECK (status IN ('pending', 'available', 'done')),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Budget config (one row per user, seeded on first login)
CREATE TABLE IF NOT EXISTS budget_config (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                TEXT    NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  default_monthly_amount INTEGER NOT NULL DEFAULT 10000000 CHECK (default_monthly_amount > 0),
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 3.1 Schema Notes

| Decision | Rationale |
|----------|-----------|
| `amount` as INTEGER | VND has no sub-unit; avoids floating-point errors |
| `date` as TEXT `YYYY-MM-DD` | SQLite has no DATE type; lexicographic sort works correctly |
| `created_at` as INTEGER (unixepoch) | Compact, timezone-agnostic; display in VN timezone in UI |
| `ON DELETE RESTRICT` on category | Prevents orphaning transactions when deleting used categories |
| `ON DELETE CASCADE` on transaction_custom_budget | Cleans up junction rows when either side is deleted |
| `CHECK` on transaction | DB-level enforcement of BR-03 (income has no monthly_budget_id) |
| UNIQUE (user_id, month) on monthly_budget | DB-level enforcement of BR-01 |
| `type` on category | All categories carry an income/expense label; child inherits from parent, enforced in API layer |
| `start_date`/`end_date` on monthly_budget | Stored at creation time so period boundaries are stable even if the derivation logic changes later |
| `ai_suggestion_run.status` flow | `pending` → `available` (user approves suggestions) → `done` (recategorize consumed the window) |
| `debt` has no `amount` column | Principal is derived from `opening_transaction.amount`; `remaining = opening_amount − Σ repayments` and `is_overdue` (due_date past + status `open`) are computed in `src/lib/debt.ts`, not stored |
| `ON DELETE SET NULL` on `transaction.debt_id` and `debt.opening_transaction_id` | Deleting one side detaches the link instead of cascading — a debt's repayments survive as plain transactions, and vice-versa |

---

## 4. API Design

### 4.1 Conventions

- Base path: `/api`
- All endpoints require authenticated session (better-auth cookie)
- Request body: `application/json`
- Success responses: `200 OK`, `201 Created`
- All monetary values in VND integers
- Dates: `YYYY-MM-DD` string
- Months: `YYYY-MM` string
- Errors: see [Section 8](#8-error-response-format)

---

### 4.2 Categories

#### `GET /api/categories`

Returns the full category tree for the current user.

**Response `200`:**
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Ăn uống",
      "parent_id": null,
      "level": 1,
      "sort_order": 0,
      "type": "expense",
      "children": [
        {
          "id": 4,
          "name": "Ăn ngoài",
          "parent_id": 1,
          "level": 2,
          "sort_order": 0,
          "type": "expense",
          "children": []
        }
      ]
    }
  ]
}
```

> Build tree in application layer (single flat SELECT, then nest by parent_id).

---

#### `POST /api/categories/seed`

Creates the default seed category set for the current user. Idempotent — uses `INSERT OR IGNORE`, safe to call multiple times. Returns `{ ok: true }`.

Intended use: shown as a button in the UI when the user has no categories.

**Response `200`:** `{ "ok": true }`

---

#### `POST /api/categories`

Create a new category.

**Request:**
```json
{
  "name": "Bún bò",
  "parent_id": 1,
  "type": "expense"
}
```

- `parent_id` null → level-1 category. `type` is **required** for level-1 (`"income"` or `"expense"`).
- `parent_id` provided → child category. `type` is **ignored** — inherited from parent automatically.

**Validations:**
- `name` required, non-empty string, max 100 chars
- `parent_id` must belong to the current user if provided
- `parent_id` category's level must be < 3 (cannot add child to level-3 node)
- `type` required and must be `"income"` or `"expense"` when `parent_id` is null
- Resulting level = parent.level + 1 (or 1 if no parent)

**Response `201`:**
```json
{
  "category": { "id": 42, "name": "Bún bò", "parent_id": 1, "level": 2, "sort_order": 0, "type": "expense" }
}
```

**Errors:** `400 Bad Request`, `403 Forbidden` (parent not owned by user), `409 Conflict` (parent is level 3)

---

#### `PATCH /api/categories/:id`

Rename or reorder a category.

**Request (any subset):**
```json
{
  "name": "Bún bò Huế",
  "sort_order": 2
}
```

**Validations:**
- Category must belong to current user
- `name` non-empty, max 100 chars

**Response `200`:**
```json
{
  "category": { "id": 42, "name": "Bún bò Huế", ... }
}
```

---

#### `DELETE /api/categories/:id`

**Validations (in order):**
1. Category must belong to current user → `403`
2. Has transactions using it → `409 { error: "...", transaction_count: N }`
3. Has child categories → `409 { error: "..." }`

**Response `200`:** `{}`

---

### 4.3 Transactions

#### `GET /api/transactions`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `month` | `YYYY-MM` | current month | Filter by transaction month |
| `type` | `expense\|income` | all | Filter by type |
| `category_id` | integer | all | Filter by category |
| `custom_budget_id` | integer | all | Filter by custom budget association |

**Response `200`:**
```json
{
  "transactions": [
    {
      "id": 101,
      "amount": 50000,
      "type": "expense",
      "category": { "id": 4, "name": "Ăn ngoài", "path": "Ăn uống > Ăn ngoài" },
      "note": "Phở bò",
      "date": "2026-04-29",
      "monthly_budget_id": 3,
      "custom_budgets": [{ "id": 1, "name": "Trip Đà Lạt" }],
      "created_at": 1745894400
    }
  ],
  "summary": {
    "total_expense": 1500000,
    "total_income": 20000000,
    "savings": 18500000
  }
}
```

> Single query with LEFT JOINs; build `custom_budgets` array from junction table. `category.path` built in app layer.

---

#### `POST /api/transactions`

**Request:**
```json
{
  "amount": 50000,
  "type": "expense",
  "category_id": 4,
  "note": "Phở bò",
  "date": "2026-04-29",
  "custom_budget_ids": [1, 2]
}
```

**Validations:**
- `amount` positive integer > 0
- `type` must be `expense` or `income`
- `category_id` must be a leaf node (no children) owned by user
- `date` valid `YYYY-MM-DD` format
- If `type = expense`: monthly_budget for `date`'s month must exist → `400` if not
- If `type = income`: `custom_budget_ids` must be empty/absent
- All `custom_budget_ids` must belong to user (ownership check before any insert)
- `custom_budget_ids` only valid for `type = expense`

**Execution (atomic):**
```
BEGIN
  INSERT transaction → get transaction_id
  IF custom_budget_ids:
    INSERT transaction_custom_budget rows
COMMIT
```

**Response `201`:**
```json
{ "transaction": { ...full transaction object... } }
```

---

#### `PATCH /api/transactions/:id`

Update any field of a transaction.

**Request (any subset):**
```json
{
  "amount": 60000,
  "category_id": 5,
  "note": "Bún bò",
  "date": "2026-04-28",
  "custom_budget_ids": [1]
}
```

**Validations:**
- Transaction must belong to current user
- Same field-level validations as POST
- If `date` changes and transaction is `expense`:
  - Derive new month from new date
  - Verify monthly_budget exists for new month → `400` if not
  - Update `monthly_budget_id` to the new month's budget
- If `type` changes expense → income:
  - Clear `monthly_budget_id`
  - Delete all `transaction_custom_budget` rows for this transaction
- If `type` changes income → expense:
  - Validate monthly_budget exists for `date`'s month
  - Set `monthly_budget_id`

**Execution (atomic):**
```
BEGIN
  UPDATE transaction
  DELETE FROM transaction_custom_budget WHERE transaction_id = :id
  INSERT new transaction_custom_budget rows (if any)
COMMIT
```

**Response `200`:**
```json
{ "transaction": { ...full transaction object... } }
```

---

#### `DELETE /api/transactions/:id`

- Must belong to current user
- `transaction_custom_budget` rows cascade-deleted by DB
- `monthly_budget_id` link is just a FK — monthly_budget itself is NOT deleted

**Response `200`:** `{}`

---

### 4.4 Monthly Budgets

#### `GET /api/monthly-budgets`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `month` | `YYYY-MM` | current month | Month to fetch |

**Response `200`:**
```json
{
  "month": "2026-04",
  "monthly_budget": {
    "id": 3,
    "month": "2026-04",
    "amount": 15000000,
    "created_at": 1743465600,
    "adjustments": [
      { "id": 1, "delta": 5000000, "note": "Lương thưởng thêm", "created_at": 1744070400 }
    ]
  },
  "start": "2026-03-31",
  "end": "2026-04-29"
}
```

> Returns `null` for `monthly_budget` if none exists for that month. `start` and `end` are always present (computed from `getBudgetPeriodInclusive` when no budget exists).

---

#### `POST /api/monthly-budgets`

**Request:**
```json
{
  "month": "2026-05",
  "amount": 12000000
}
```

**Validations:**
- `month` valid `YYYY-MM` format
- `amount` positive integer > 0
- No existing monthly_budget for (user_id, month) → `409` if duplicate

**Response `201`:**
```json
{
  "monthly_budget": { "id": 4, "month": "2026-05", "amount": 12000000, "adjustments": [] },
  "start": "2026-04-29",
  "end": "2026-05-29"
}
```

> `start_date` and `end_date` are computed via `getBudgetPeriodInclusive(month)` and stored in the `monthly_budget` row at creation time.

---

#### `PATCH /api/monthly-budgets/:id`

Adjust budget amount (creates BudgetAdjustment record).

**Request:**
```json
{
  "delta": 500000,
  "note": "Lương thưởng thêm"
}
```

**Validations:**
- Budget must belong to current user
- `delta` must be non-zero integer
- `amount + delta` must be > 0 (cannot reduce budget to 0 or below)
- `note` optional but recommended; max 500 chars

**Execution (atomic):**
```
BEGIN
  UPDATE monthly_budget SET amount = amount + delta WHERE id = :id
  INSERT budget_adjustment { monthly_budget_id, delta, note }
COMMIT
```

**Response `200`:**
```json
{
  "monthly_budget": { "id": 3, "amount": 15500000, ... },
  "adjustment": { "id": 2, "delta": 500000, "note": "...", "created_at": ... }
}
```

---

### 4.5 Custom Budgets

#### `GET /api/custom-budgets`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active_only` | boolean | `false` | Filter to only active budgets |

**Response `200`:**
```json
{
  "custom_budgets": [
    {
      "id": 1,
      "name": "Trip Đà Lạt",
      "amount": 3000000,
      "is_active": 1,
      "spent": 450000,
      "created_at": 1743465600
    }
  ]
}
```

> `spent` = SUM(transaction.amount) WHERE transaction joins transaction_custom_budget for this custom_budget_id.

---

#### `POST /api/custom-budgets`

**Request:**
```json
{
  "name": "Trip Đà Lạt",
  "amount": 3000000
}
```

**Validations:**
- `name` required, non-empty, max 100 chars
- `amount` positive integer > 0

**Response `201`:**
```json
{ "custom_budget": { "id": 1, "name": "Trip Đà Lạt", "amount": 3000000, "is_active": 1, "spent": 0 } }
```

---

#### `PATCH /api/custom-budgets/:id`

**Request (any subset):**
```json
{
  "name": "Trip Đà Lạt 2026",
  "amount": 5000000,
  "is_active": 0
}
```

**Validations:**
- Must belong to current user
- `amount` positive integer > 0 if provided
- `name` non-empty, max 100 chars if provided
- `is_active` must be 0 or 1 if provided

**Response `200`:**
```json
{ "custom_budget": { ...updated object... } }
```

---

#### `DELETE /api/custom-budgets/:id`

- Must belong to current user
- `transaction_custom_budget` rows cascade-deleted (transactions themselves are NOT deleted)
- The transactions retain all other data; only the association is removed

**Response `200`:** `{}`

---

### 4.6 Budget Config

#### `GET /api/budget-config`

**Response `200`:**
```json
{
  "budget_config": {
    "default_monthly_amount": 10000000,
    "updated_at": 1743465600
  }
}
```

> If no config exists yet (edge case: user just registered, seed job hasn't run), return default `10000000`.

---

#### `PUT /api/budget-config`

Upsert (INSERT OR REPLACE).

**Request:**
```json
{
  "default_monthly_amount": 12000000
}
```

**Validations:**
- `default_monthly_amount` positive integer > 0

**Response `200`:**
```json
{ "budget_config": { "default_monthly_amount": 12000000, "updated_at": 1745894400 } }
```

---

### 4.7 Dashboard

#### `GET /api/dashboard`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `month` | `YYYY-MM` | current month | Month to compute |

**Response `200`:**
```json
{
  "month": "2026-04",
  "period_start": "2026-03-31",
  "period_end": "2026-04-29",
  "total_expense": 8500000,
  "total_income": 20000000,
  "savings": 11500000,
  "monthly_budget": {
    "id": 3,
    "amount": 15000000,
    "remaining": 6500000
  },
  "days_in_period": 30,
  "days_elapsed": 29,
  "days_remaining": 1,
  "pace_status": "under",
  "daily_expenses": [
    { "date": "2026-04-01", "amount": 150000 },
    { "date": "2026-04-02", "amount": 320000 }
  ]
}
```

> `pace_status`: `"under"` if actual ≤ ideal, `"over"` if actual > ideal, `"no_budget"` if no monthly_budget exists.
> `ideal_today = (budget_amount / days_in_period) × days_elapsed`
> `daily_expenses`: aggregated expense per date within the period, ordered ascending. Used by the spending chart on the Home screen.

---

### 4.8 Pace Line Data

#### `GET /api/pace-line`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `month` | `YYYY-MM` | yes | Month to compute |

**Response `200`:**
```json
{
  "month": "2026-04",
  "budget_amount": 15000000,
  "days_in_month": 30,
  "today_day": 29,
  "ideal_line": [
    { "day": 1, "amount": 500000 },
    { "day": 2, "amount": 1000000 },
    ...
    { "day": 30, "amount": 15000000 }
  ],
  "actual_line": [
    { "day": 1, "amount": 0 },
    { "day": 2, "amount": 350000 },
    ...
    { "day": 29, "amount": 8500000 }
  ]
}
```

> `ideal_line` has 1..days_in_month points.
> `actual_line` has 1..today_day points (current month) or 1..days_in_month (past month).
> Both lines start implicitly at (0, 0).
> If no monthly_budget: return `{ monthly_budget: null, ideal_line: [], actual_line: [] }`.

---

### 4.9 Statistics

#### `GET /api/statistics`

Returns cached or previously generated insight data for the given month (if any). Used to check if insights already exist before generating new ones.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `month` | `YYYY-MM` | yes | Month to fetch |

**Response `200`:**
```json
{
  "month": "2026-04",
  "insights": [...]    // array of Insight objects, or empty if not generated yet
}
```

---

#### `POST /api/statistics/generate`

Triggers AI insight generation for a given month. Returns a **streaming** response (Server-Sent Events or NDJSON) where each event is a partial or complete `Insight` object emitted as the AI produces it.

**Request:**
```json
{ "month": "2026-04" }
```

**Behavior:**
1. Fetch all transactions for the month from D1 (amount, category path, type, date, note)
2. Build a structured prompt with the transaction data and insight rules
3. Call the AI (OpenAI `gpt-4o` via the Cloudflare AI Gateway, streaming the agent's structured insights)
4. Stream each insight object as it is produced — the client renders cards progressively
5. Each `Insight` has: `title`, `narrative`, `value` (numeric), `value_unit` (`vnd` | `percent` | `count`), optional `chart_type` and `chart_data`

**Insight object shape:**
```ts
type Insight = {
  title: string;
  narrative: string;
  value: number;
  value_unit: "vnd" | "percent" | "count";
  chart_type?: "bar" | "line" | "pie" | "area";
  chart_data?: ChartDatum[];
};

type ChartDatum = {
  label: string;
  value: number;
  group?: string;
};
```

**CSP constraint:** Chart rendering uses `vega-interpreter` (no `eval`) — the API must produce standard Vega-Lite specs; the client injects the interpreter at render time.

---

### 4.10 AI Endpoints

> **Epic 3 note:** The per-screen AI endpoints below (`/api/categories/suggest`, `/api/transactions/recategorize`, `/api/categories/fill-emoji`, `/api/ai-suggestion-runs/:id`) are retained in the backend but are **no longer called from the UI**. They are used internally by the new `/api/ai/organize` endpoint. The single-transaction suggest endpoint (`/api/transactions/:id/suggest`) has been **removed**.
>
> See `docs/EPIC_3_AI_REFACTOR.md` for the full design.

#### `POST /api/ai/organize` *(Epic 3)*

Analyzes all user data (categories + transaction notes) and returns a combined preview of changes. **No writes to DB.**

**Response `200`:**
```typescript
{
  new_categories: {
    temp_id: string;           // e.g. "new:0" — referenced in recategorizations
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    parent_category_name: string | null;
    example_notes: string[];
  }[];
  emoji_assignments: {
    category_id: number;
    category_name: string;
    emoji: string;
  }[];
  recategorizations: {
    transaction_id: number;
    note: string;
    current_category_id: number;
    current_category_name: string;
    suggested_category_id: number | string;  // string = temp_id for new categories
    suggested_category_name: string;
    reason: string;
  }[];
}
```

#### `POST /api/ai/organize/apply` *(Epic 3)*

Writes the user-selected subset of changes from the preview.

**Request:**
```typescript
{
  new_categories: { temp_id: string; name: string; type: string; parent_category_id: number | null; emoji: string | null }[];
  emoji_assignments: { category_id: number; emoji: string }[];
  recategorizations: { transaction_id: number; category_id: number | string }[];
}
```

Apply order: create categories → update emoji → resolve temp_ids → update transactions.

**Response `200`:** `{ created_categories: number, emoji_updated: number, transactions_moved: number }`

#### `POST /api/categories/suggest` *(internal)*

Retained. Called internally by `/api/ai/organize`. Not user-facing in Epic 3+.

#### `PATCH /api/ai-suggestion-runs/:id` *(internal)*

Retained. Called internally to manage run state. Not user-facing in Epic 3+.

#### `POST /api/transactions/recategorize` *(internal)*

Retained. Called internally by `/api/ai/organize`. Not user-facing in Epic 3+.

#### ~~`POST /api/transactions/:id/suggest`~~ *(removed in Epic 3)*

Removed. Replaced by `/api/ai/organize` batch flow.

---

### 4.11 Debts (Epic 4)

Debts model lending/borrowing. A debt's **opening transaction** records the principal; **repayments** are ordinary transactions with `debt_id` set. See `docs/specs/debt-tracking.md` for the full SRS and `src/lib/debt.ts` for computed values.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/debts` | List the user's debts grouped into `lending`, `borrowing`, `settled` (each a `DebtWithRepayments`) |
| POST | `/api/debts` | Create a debt + its opening transaction atomically. Body: `{ type: 'lend'\|'borrow', party, amount, date, note?, due_date?, transaction_note? }` → `{ debt }` (201) |
| GET | `/api/debts/:id` | One debt with its repayment timeline and computed `opening_amount`, `total_repaid`, `remaining`, `is_overdue` |
| PATCH | `/api/debts/:id` | Update `party` / `note` / `due_date` / `status` |
| DELETE | `/api/debts/:id` | Delete the debt (linked transactions are detached, not deleted) |
| PATCH | `/api/transactions/:id/link` | Link an existing transaction to a debt as a repayment |
| DELETE | `/api/transactions/:id/link` | Unlink a transaction from its debt |

`POST`/`PATCH /api/transactions` also accept `debt_id` to create or convert a transaction into a repayment. Direction is derived: a **lend** opening is an expense and its repayments are income; a **borrow** opening is income and its repayments are expense (`src/lib/debt.ts` → `debtOpeningTxType` / `repaymentTxType`).

---

## 5. Edge Cases & Validation Rules

### 5.1 Categories

| Case | Expected Behavior |
|------|-------------------|
| POST with `parent_id` = level-3 category | `409 Conflict: "Danh mục cấp 3 không thể có danh mục con"` |
| POST with `parent_id` belonging to another user | `403 Forbidden` |
| PATCH renaming to same name as sibling | Allowed (no uniqueness constraint at sibling level) |
| DELETE category used in ≥ 1 transaction | `409 { error: "Danh mục đang được dùng bởi N giao dịch", transaction_count: N }` |
| DELETE category that has children | `409 { error: "Vui lòng xóa danh mục con trước" }` — checked after transaction check |
| Assigning non-leaf category to transaction | `400 { error: "Chỉ được chọn danh mục không có danh mục con" }` |
| GET /api/categories with no categories yet | Returns empty array (not an error) |

### 5.2 Transactions

| Case | Expected Behavior |
|------|-------------------|
| POST expense, no monthly_budget for that month | `400 { error: "Chưa có budget tháng YYYY-MM. Vui lòng tạo budget trước." }` |
| POST income with `custom_budget_ids` | `400 { error: "Giao dịch thu nhập không thể gán vào Custom Budget" }` |
| POST with `amount = 0` | `400 { error: "Số tiền phải lớn hơn 0" }` |
| POST with negative `amount` | `400 { error: "Số tiền phải lớn hơn 0" }` |
| POST with decimal `amount` (e.g. 1500.5) | `400 { error: "Số tiền phải là số nguyên" }` |
| POST with non-existent `category_id` | `404 { error: "Danh mục không tồn tại" }` |
| POST with `category_id` owned by another user | `403 Forbidden` |
| POST with `custom_budget_ids` containing inactive budget | Allowed — user explicitly chose to associate even if inactive |
| POST with `custom_budget_ids` belonging to another user | `403 Forbidden` |
| POST with invalid date format (e.g. "29-04-2026") | `400 { error: "Định dạng ngày không hợp lệ. Dùng YYYY-MM-DD." }` |
| POST with future date | Allowed (user may pre-log planned expenses) |
| PATCH: change `date` to different month → new month has no budget | `400 { error: "Chưa có budget tháng YYYY-MM..." }` |
| PATCH: change `type` from expense → income | Clear `monthly_budget_id`; cascade-delete `transaction_custom_budget` rows |
| PATCH: change `type` from income → expense | Validate budget for `date`'s month exists; set `monthly_budget_id` |
| PATCH: transaction not owned by user | `403 Forbidden` |
| DELETE: transaction not owned by user | `403 Forbidden` |
| GET with `custom_budget_id` for inactive budget | Returns associated transactions (inactive doesn't mean hidden in history) |

### 5.3 Monthly Budgets

| Case | Expected Behavior |
|------|-------------------|
| POST duplicate (same user + month) | `409 { error: "Budget tháng YYYY-MM đã tồn tại" }` |
| POST with `amount = 0` | `400 { error: "Số tiền phải lớn hơn 0" }` |
| PATCH delta that would make amount ≤ 0 | `400 { error: "Số tiền budget sau điều chỉnh phải lớn hơn 0. Hiện tại: N ₫, delta: -M ₫" }` |
| PATCH delta = 0 | `400 { error: "Delta phải khác 0" }` |
| GET month with no budget | Returns `{ monthly_budget: null }` |
| DELETE endpoint | **Not provided** — budgets are immutable records; only adjustments are allowed |
| Accessing another user's budget | `403 Forbidden` |
| POST month in the past | Allowed (user may create historical budgets) |

### 5.4 Custom Budgets

| Case | Expected Behavior |
|------|-------------------|
| DELETE custom_budget that has linked transactions | Allowed; only `transaction_custom_budget` rows are deleted (cascade), transactions remain |
| PATCH `amount` to 0 | `400 { error: "Số tiền mục tiêu phải lớn hơn 0" }` || Toggle inactive → active | Allowed; budget reappears in transaction form |
| GET spending of deleted custom_budget | N/A (budget is deleted, no history view needed) |
| Two custom budgets with same name for same user | Allowed (no uniqueness constraint) |

### 5.5 Budget Config

| Case | Expected Behavior |
|------|-------------------|
| GET before seed (first login, seed not run yet) | Return default `{ default_monthly_amount: 10000000 }` |
| PUT `default_monthly_amount = 0` | `400 { error: "Số tiền mặc định phải lớn hơn 0" }` |
| Changing Budget Config after Monthly Budget created | Monthly Budget is **not** retroactively changed (BR-11) |

### 5.6 Dashboard & Pace Line

| Case | Expected Behavior |
|------|-------------------|
| Month with no transactions | `total_expense: 0`, `total_income: 0`, `savings: 0`; pace chart shows only ideal line |
| Month with no monthly_budget | `monthly_budget: null`, `pace_status: "no_budget"`, `ideal_line: []` |
| Future month (beyond today) | `actual_line: []`; `ideal_line` shows full month |
| First day of month, no expenses yet | `actual_line: [{ day: 1, amount: 0 }]`; `pace_status: "under"` |
| Budget adjusted mid-month | `ideal_line` uses current `budget_amount` (not original); chart reflects latest value |
| Multiple expenses same day | Cumulative sum correctly aggregates all same-day expenses |
| `savings` negative | Display in red; value is correct (income − expense, can be negative) |

### 5.7 Auth & Authorization

| Case | Expected Behavior |
|------|-------------------|
| Any API call without valid session | `401 { error: "Unauthorized" }` |
| Requesting resource owned by another user | `403 Forbidden` — all queries scoped to `session.user.id` |
| Session expired | `401 { error: "Session expired" }` — better-auth handles |
| First login (new user) | Seed: create `budget_config`, create default categories |

---

## 6. Computed Values & Business Logic

### 6.1 Pace Line Computation

```
days_in_month = last day of month (28/29/30/31 depending on month)
today_day     = min(current_day_of_month, days_in_month)   // for current month
             = days_in_month                                // for past months

ideal_line[d] = round((budget_amount / days_in_month) × d)  for d in 1..days_in_month

daily_expenses = Map<day_number, sum_of_amounts>
                 from transactions WHERE type = 'expense' AND date LIKE 'YYYY-MM-%'

actual_line[d] = cumulative_sum(daily_expenses, d)          for d in 1..today_day
```

### 6.2 Category Level Derivation

```
level = 1                         if parent_id IS NULL
level = parent.level + 1         if parent_id IS NOT NULL
```

API always derives level from parent; client never sends `level`.

### 6.3 Category Leaf Detection

A category is a **leaf** if it has no rows in `category` with `parent_id = category.id` (scoped to same user).

```sql
SELECT COUNT(*) FROM category WHERE parent_id = :id AND user_id = :user_id
```

### 6.4 Budget Period & Month Derivation

A budget period is **not** a calendar month. It spans from the last working day of the previous calendar month to the last working day of the current budget month (inclusive).

**Last working day** = the last Monday–Friday that is not a Vietnamese public holiday in that calendar month.

```
lastWorkingDay(year, month):
  d = last calendar day of month
  while d is weekend or VN public holiday:
    d -= 1 day
  return d

getBudgetMonthForDate(dateStr):
  [y, m] = dateStr year and month
  if dateStr >= lastWorkingDay(y, m):
    return next calendar month (YYYY-MM)   // belongs to the NEXT budget period
  return dateStr.substring(0, 7)           // belongs to current calendar month's budget

getBudgetPeriod(budgetMonth):
  start = lastWorkingDay(prevMonth)   // first day of the period (inclusive)
  end   = lastWorkingDay(budgetMonth) // exclusive upper bound for queries
```

**Example:** For budget month `2026-04`:
- `lastWorkingDay(2026-03)` = `2026-03-31` (assuming it's a weekday/non-holiday)
- `lastWorkingDay(2026-04)` = `2026-04-29` (last working day of April)
- Period = `2026-03-31` (inclusive) to `2026-04-29` (exclusive in queries; `2026-04-28` inclusive for storage)

**Transaction date routing:**
```
date = "2026-04-29"
getBudgetMonthForDate("2026-04-29") → "2026-05"  // April 29 is the last working day of April
                                                  // so it belongs to the MAY budget period
```

**`start_date` and `end_date` in `monthly_budget` table:**
Computed via `getBudgetPeriodInclusive(month)` and stored at budget creation time. Subsequent queries use the stored dates for consistency — the period is frozen at creation even if the derivation logic changes.

When resolving which monthly_budget an expense transaction belongs to:
```
month = getBudgetMonthForDate(date)
SELECT id FROM monthly_budget WHERE user_id = ? AND month = ?
```

### 6.5 Custom Budget Spent

```sql
SELECT COALESCE(SUM(t.amount), 0) AS spent
FROM transaction t
JOIN transaction_custom_budget tcb ON tcb.transaction_id = t.id
WHERE tcb.custom_budget_id = :id
  AND t.user_id = :user_id
  AND t.type = 'expense'
```

---

## 7. Seeding & Initialization

### 7.1 On First Login

Triggered via better-auth `databaseHooks.user.create.after`, before returning the session:

1. **Create `budget_config`** with `default_monthly_amount = 10000000`
2. **Create seed categories** (structure below)

### 7.2 On-Demand Seed

`POST /api/categories/seed` calls `seedNewUser()` for the current authenticated user. Displayed in the UI as a "Create sample categories" button when `GET /api/categories` returns an empty array.

Both paths share the same `seedNewUser(db, userId)` function from `src/lib/seed.ts`.

```
Ăn uống (L1)
  ├─ Ăn ngoài (L2)
  ├─ Đi chợ / siêu thị (L2)
  └─ Đồ uống (L2)

Đi lại (L1)
  ├─ Xăng (L2)
  ├─ Gửi xe (L2)
  └─ Taxi / Grab (L2)

Mua sắm (L1)
  ├─ Quần áo (L2)
  ├─ Điện tử (L2)
  └─ Gia dụng (L2)

Sức khoẻ (L1)
  ├─ Thuốc (L2)
  └─ Khám bệnh (L2)

Giải trí (L1)
  ├─ Phim / sự kiện (L2)
  ├─ Game (L2)
  └─ Du lịch (L2)

Hoá đơn & dịch vụ (L1)
  ├─ Điện nước (L2)
  ├─ Internet / điện thoại (L2)
  └─ Thuê nhà (L2)

Thu nhập (L1)
  ├─ Lương (L2)
  ├─ Thưởng (L2)
  └─ Thu nhập khác (L2)
```

### 7.3 Idempotency

If seed is triggered multiple times (e.g., race condition or repeated on-demand calls), `INSERT OR IGNORE` on both `budget_config` and seed categories prevents duplicates.

---

## 8. Error Response Format

All error responses follow a consistent shape:

```json
{
  "error": "Human-readable message in Vietnamese",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

### 8.1 Standard Error Codes

| HTTP Status | Code | When Used |
|-------------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid input (missing field, wrong type, business rule violation) |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | Resource not owned by user |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Uniqueness violation, deletion constraint, etc. |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### 8.2 Validation Error Detail

For field-level errors, include `details`:

```json
{
  "error": "Dữ liệu không hợp lệ",
  "code": "VALIDATION_ERROR",
  "details": {
    "amount": "Số tiền phải lớn hơn 0",
    "category_id": "Danh mục không tồn tại"
  }
}
```

### 8.3 Budget Missing Error (409 special case)

```json
{
  "error": "Chưa có budget tháng 2026-04. Vui lòng tạo budget trước.",
  "code": "MONTHLY_BUDGET_MISSING",
  "details": { "month": "2026-04" }
}
```

### 8.4 Category In Use Error

```json
{
  "error": "Danh mục đang được dùng bởi 12 giao dịch.",
  "code": "CATEGORY_IN_USE",
  "details": { "transaction_count": 12 }
}
```

---

## 9. Frontend Architecture

The full frontend architecture is defined in `docs/COMPONENT_ARCHITECTURE.md`. This section summarizes the technical contracts relevant to implementation.

### 9.1 Component Hierarchy

```
Atoms → Molecules → Organisms → Templates → Pages (App Router)
```

Pages (`src/app/**`) are data-fetching shells only. They call hooks/APIs and pass all data as props to template components. No rendering logic in page files.

### 9.2 State Management

| State Type | Tool | Scope |
|-----------|------|-------|
| Server state (categories, transactions, dashboard) | SWR (`useSWR`) | Page level |
| Local UI state (modals open, active tab, form values) | `useState` / `useReducer` | Organism level |
| URL state (selected month, filters) | Next.js `useSearchParams` | Page level |

SWR keys use the pattern `["/api/resource", { month, ... }]`. Mutation calls `mutate()` after success.

### 9.3 Storybook Integration

- Adapter: `@storybook/nextjs` (handles Image, Link, fonts)
- Stories co-located with components: `ComponentName.stories.tsx`
- Format: CSF3 with `args` and `play` functions where needed
- Viewport presets: 375px (iPhone SE), 393px (iPhone 14 Pro), 768px (iPad), 1280px (Desktop)
- Every story renders without auth, router, or network — use args for all data
- CI runs `build-storybook` to catch broken stories

### 9.4 Data Flow Diagram

```
App Router page.tsx
    │  useSWR("/api/dashboard?month=...")
    │
    ▼
DashboardTemplate (props: dashboardData, transactions, onSave, ...)
    │
    ├── DashboardSummary (organism) ← receives summary props
    │       ├── BudgetProgressBar (molecule)
    │       └── PaceChip (molecule)
    │
    ├── MonthStepper (molecule) ← month string + callbacks
    │
    └── TransactionGroup[] (organism) ← grouped transaction arrays
            └── TransactionListItem[] (molecule)
```

### 9.5 Cloudflare-Specific Frontend Constraints

| Constraint | Detail |
|-----------|--------|
| No `eval` in Worker | Use `vega-interpreter` for Vega expression evaluation |
| No Node.js built-ins | No `path`, `fs`, etc. in any component or hook |
| DB access only in API routes | Never call `getCloudflareContext()` from client components |
| Dynamic imports for heavy libs | Use `next/dynamic` for Vega (`react-vega`) to keep initial bundle small |

---

## Appendix A: API Route Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | List category tree (includes `type` field) |
| POST | `/api/categories` | Create category (`type` required for level-1) |
| POST | `/api/categories/seed` | Create default seed categories (idempotent) |
| POST | `/api/categories/suggest` | AI: suggest new categories from transaction history |
| PATCH | `/api/categories/:id` | Rename / reorder |
| DELETE | `/api/categories/:id` | Delete (with checks) |
| GET | `/api/transactions` | List with filters + summary |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| POST | `/api/transactions/recategorize` | AI: suggest recategorizations for a run window |
| PATCH | `/api/transactions/:id/link` | Link a transaction to a debt as a repayment |
| DELETE | `/api/transactions/:id/link` | Unlink a transaction from its debt |
| GET | `/api/debts` | List debts grouped into lending / borrowing / settled |
| POST | `/api/debts` | Create a debt + opening transaction (atomic) |
| GET | `/api/debts/:id` | One debt with repayments + computed values |
| PATCH | `/api/debts/:id` | Update party / note / due_date / status |
| DELETE | `/api/debts/:id` | Delete debt (detaches linked transactions) |
| GET | `/api/monthly-budgets` | Get budget + period dates for a month |
| POST | `/api/monthly-budgets` | Create monthly budget (stores period dates) |
| PATCH | `/api/monthly-budgets/:id` | Adjust budget (creates audit record) |
| GET | `/api/custom-budgets` | List custom budgets with spent |
| POST | `/api/custom-budgets` | Create custom budget |
| PATCH | `/api/custom-budgets/:id` | Update name / amount / is_active |
| DELETE | `/api/custom-budgets/:id` | Delete (keeps transactions) |
| GET | `/api/budget-config` | Get default monthly amount |
| PUT | `/api/budget-config` | Upsert default monthly amount |
| GET | `/api/dashboard` | Summary stats + daily expenses for a period |
| GET | `/api/pace-line` | Pace line chart data for a month |
| GET | `/api/statistics` | Fetch cached insights for a month |
| POST | `/api/statistics/generate` | Stream AI-generated insights for a month |
| PATCH | `/api/ai-suggestion-runs/:id` | Transition run: `pending` → `available` |
