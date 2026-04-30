# Technical Design Document
## Personal Finance Tracker

---

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | Draft |
| Author | niits |
| Created | 2026-04-29 |
| Based On | BRD v1.0, FLOWS v1.0 |

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

---

## 1. Overview

### 1.1 Architecture

```
Browser (Next.js App Router)
       │
       ▼
Next.js API Routes (/api/*)   ← All requests authenticated via better-auth session
       │
       ▼
Cloudflare D1 (SQLite)        ← Single database, all tables below
```

### 1.2 Auth boundary

Every `/api/*` route (except `/api/auth/*`) must:
1. Call `auth.api.getSession({ headers: request.headers })`
2. If no session → return `401 Unauthorized`
3. Scope every DB query to `user_id = session.user.id`

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
| `category` | Hierarchical expense/income labels. Max 3 levels. | N per user |
| `monthly_budget` | Budget for a specific calendar month. | 1 per user per month |
| `budget_adjustment` | Immutable audit log of each budget change. | N per monthly_budget |
| `custom_budget` | Open-ended named budget (e.g. "Trip Đà Lạt"). | N per user |
| `transaction` | Single expense or income event. | N per user |
| `transaction_custom_budget` | Junction: one expense ↔ many custom budgets. | N:M |

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
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_category_user_parent
  ON category(user_id, parent_id);

-- Monthly budgets (one per user per calendar month)
CREATE TABLE IF NOT EXISTS monthly_budget (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  month      TEXT    NOT NULL,            -- 'YYYY-MM'
  amount     INTEGER NOT NULL CHECK (amount > 0),
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
  category_id        INTEGER NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  note               TEXT,
  date               TEXT    NOT NULL,   -- 'YYYY-MM-DD'
  monthly_budget_id  INTEGER REFERENCES monthly_budget(id) ON DELETE RESTRICT,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  -- Enforce: income must have null monthly_budget_id
  CHECK (
    (type = 'income' AND monthly_budget_id IS NULL) OR
    (type = 'expense' AND monthly_budget_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_transaction_user_date
  ON transaction(user_id, date);

CREATE INDEX IF NOT EXISTS idx_transaction_user_category
  ON transaction(user_id, category_id);

CREATE INDEX IF NOT EXISTS idx_transaction_monthly_budget
  ON transaction(monthly_budget_id);

-- Junction: expense ↔ custom_budget (N:M)
CREATE TABLE IF NOT EXISTS transaction_custom_budget (
  transaction_id   INTEGER NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
  custom_budget_id INTEGER NOT NULL REFERENCES custom_budget(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, custom_budget_id)
);

CREATE INDEX IF NOT EXISTS idx_txn_custom_budget_budget
  ON transaction_custom_budget(custom_budget_id);

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
      "children": [
        {
          "id": 4,
          "name": "Ăn ngoài",
          "parent_id": 1,
          "level": 2,
          "sort_order": 0,
          "children": []
        }
      ]
    }
  ]
}
```

> Build tree in application layer (single flat SELECT, then nest by parent_id).

---

#### `POST /api/categories`

Create a new category.

**Request:**
```json
{
  "name": "Bún bò",
  "parent_id": 1
}
```

> `parent_id` null → level 1 category.

**Validations:**
- `name` required, non-empty string, max 100 chars
- `parent_id` must belong to the current user if provided
- `parent_id` category's level must be < 3 (cannot add child to level-3 node)
- Resulting level = parent.level + 1 (or 1 if no parent)

**Response `201`:**
```json
{
  "category": { "id": 42, "name": "Bún bò", "parent_id": 1, "level": 2, "sort_order": 0 }
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
  "monthly_budget": {
    "id": 3,
    "month": "2026-04",
    "amount": 15000000,
    "created_at": 1743465600,
    "adjustments": [
      { "id": 1, "delta": 5000000, "note": "Lương thưởng thêm", "created_at": 1744070400 }
    ]
  }
}
```

> Returns `null` for `monthly_budget` if none exists for that month.

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
{ "monthly_budget": { "id": 4, "month": "2026-05", "amount": 12000000, "adjustments": [] } }
```

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
  "total_expense": 8500000,
  "total_income": 20000000,
  "savings": 11500000,
  "monthly_budget": {
    "id": 3,
    "amount": 15000000,
    "remaining": 6500000
  },
  "days_in_month": 30,
  "days_elapsed": 29,
  "days_remaining": 1,
  "pace_status": "under"
}
```

> `pace_status`: `"under"` if actual ≤ ideal, `"over"` if actual > ideal, `"no_budget"` if no monthly_budget exists.
> `ideal_today = (budget_amount / days_in_month) × days_elapsed`

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

### 6.4 Monthly Budget Month Derivation

When creating an expense transaction:
```
month = date.substring(0, 7)   // "2026-04-29" → "2026-04"
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

Triggered in the better-auth `onAfterUserCreated` hook (or equivalent), before returning the session:

1. **Create `budget_config`** with `default_monthly_amount = 10000000`
2. **Create seed categories** (structure below)

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

### 7.2 Idempotency

If seed is triggered multiple times (e.g., race condition), use `INSERT OR IGNORE` for both `budget_config` and seed categories to avoid duplicates.

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

## Appendix A: API Route Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | List category tree |
| POST | `/api/categories` | Create category |
| PATCH | `/api/categories/:id` | Rename / reorder |
| DELETE | `/api/categories/:id` | Delete (with checks) |
| GET | `/api/transactions` | List with filters + summary |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/monthly-budgets` | Get budget for a month |
| POST | `/api/monthly-budgets` | Create monthly budget |
| PATCH | `/api/monthly-budgets/:id` | Adjust budget (creates audit record) |
| GET | `/api/custom-budgets` | List custom budgets with spent |
| POST | `/api/custom-budgets` | Create custom budget |
| PATCH | `/api/custom-budgets/:id` | Update name / amount / is_active |
| DELETE | `/api/custom-budgets/:id` | Delete (keeps transactions) |
| GET | `/api/budget-config` | Get default monthly amount |
| PUT | `/api/budget-config` | Upsert default monthly amount |
| GET | `/api/dashboard` | Summary stats for a month |
| GET | `/api/pace-line` | Pace line chart data for a month |
