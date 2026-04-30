# Business Requirements Document (BRD)

## Personal Finance Tracker

---

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | Draft |
| Author | niits |
| Created | 2026-04-29 |
| Last Updated | 2026-04-29 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [Business Objectives](#3-business-objectives)
4. [Scope](#4-scope)
5. [Stakeholders](#5-stakeholders)
6. [Functional Requirements](#6-functional-requirements)
7. [Business Rules](#7-business-rules)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Data Requirements](#9-data-requirements)
10. [User Interface Requirements](#10-user-interface-requirements)
11. [Process Flows](#11-process-flows)
12. [Assumptions & Constraints](#12-assumptions--constraints)
13. [Glossary](#13-glossary)

---

## 1. Executive Summary

The Personal Finance Tracker enables users to record daily income and expenses, manage monthly budgets, and monitor actual spending progress versus plan via a pace line chart. The primary goal is to let users instantly know whether they are spending ahead of or below plan at any point during the month.

---

## 2. Business Context

### 2.1 Problem Statement

Many people currently track personal expenses with manual spreadsheets or complex apps that are not optimized for quick mobile use. There is a need for a simple, fast tool to record expenses immediately and provide a clear, visual view of monthly budget progress.

### 2.2 Proposed Solution

Proposed solution: a mobile-first web app deployed to Cloudflare Pages with a minimal, Apple-inspired UI. The primary screen is a transaction entry form — open the app and you can record a transaction immediately — accompanied by the current monthly budget status.

### 2.3 Current State vs Future State

| Aspect | Current State | Future State |
|--------|--------------|--------------|
| Expense recording | Manual (spreadsheet / memory) | Entered directly in-app within seconds |
| Budget tracking | None or end-of-month check only | Real-time pace line — know instantly if today is over or under pace |
| Categorization | Inconsistent | Hierarchical, consistent, customizable categories |
| Reporting | Calculated manually | Automatic aggregation by month, category, and budget |

### 3.1 Primary Objectives

| ID | Objective | Success Criteria |
|----|-----------|-----------------|
| OBJ-01 | Fast transaction capture | Time to record a transaction < 10s |
| OBJ-02 | Track monthly budget progress | User can tell immediately if they are over or under pace |
| OBJ-03 | Expense analysis by category | Provide monthly breakdown by category |
| OBJ-04 | Calculate monthly savings | Accurately display: Income − Expense = Savings |

### 3.2 Secondary Objectives

| ID | Objective |
|----|-----------|
| OBJ-05 | Flexible budget management (increase/decrease mid-month) with audit trail |
| OBJ-06 | Support project-specific budgets (custom budgets) independent of the monthly budget |

---

## 4. Scope

### 4.1 In Scope

- User authentication via GitHub OAuth
- Hierarchical expense category management (up to 3 levels)
- Manual recording of expense and income transactions
- Monthly budgets: create, adjust, and view change history
- Custom budgets: create, manage, and associate with transactions
- Pace line chart: cumulative spending vs ideal budget line
- Transaction history: view, edit, delete, filter
- Monthly summaries: total expenses, total income, savings
- Default monthly budget value configuration for the next month
- Vietnamese-language UI and VND currency (initial target)

### 4.2 Out of Scope

- Importing data from bank files (CSV, PDF)
- Multi-currency support
- Recurring transactions (automated repeat transactions)
- Data sharing between multiple users
- Report export
- Push notifications / reminders
- Direct bank integration (Open Banking)

---

## 5. Stakeholders

| Role | Name | Responsibilities |
|------|------|-----------------|
| Product Owner | niits | Define requirements, approve |
| Developer | niits | Design, build, deploy |
| End User | niits | Use the application daily |

---

## 6. Functional Requirements

### 6.1 Authentication (AUTH)

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-01 | The system must support login via GitHub OAuth | Must Have |
| AUTH-02 | Each GitHub account corresponds to one independent user profile | Must Have |
| AUTH-03 | Sessions must be maintained via a secure httpOnly cookie | Must Have |
| AUTH-04 | Unauthenticated users must not be able to access any data | Must Have |

---

### 6.2 Transaction Management (TXN)

| ID | Requirement | Priority |
|----|-------------|----------|
| TXN-01 | Users must be able to create an expense transaction with: amount, category, note (optional), date | Must Have |
| TXN-02 | Users must be able to create an income transaction with: amount, category, note (optional), date | Must Have |
| TXN-03 | Each expense transaction must be automatically linked to the Monthly Budget for its month | Must Have |
| TXN-04 | Users may assign an expense transaction to one or more Custom Budgets | Must Have |
| TXN-05 | Income transactions are not linked to any budget | Must Have |
| TXN-06 | Users must be able to view transactions grouped by date, defaulting to the current month | Must Have |
| TXN-07 | Users must be able to edit any field of a transaction | Must Have |
| TXN-08 | Users must be able to delete a transaction | Must Have |
| TXN-09 | Users must be able to filter the transaction list by: month, category, type (expense/income), custom budget | Should Have |
| TXN-10 | Amount must be a positive integer in VND | Must Have |
| TXN-11 | Transaction date defaults to today; users may select a different date | Must Have |

---

### 6.3 Monthly Budget (MBGT)

| ID | Requirement | Priority |
|----|-------------|----------|
| MBGT-01 | Each user may have at most 1 Monthly Budget per month | Must Have |
| MBGT-02 | Users must be able to manually create a Monthly Budget for any month that does not yet have one | Must Have |
| MBGT-03 | When creating a Monthly Budget, the default amount is taken from Budget Config | Should Have |
| MBGT-04 | Users must be able to adjust the Monthly Budget amount (up or down) along with a reason note | Must Have |
| MBGT-05 | Each adjustment must create a Budget Adjustment record to maintain history | Must Have |
| MBGT-06 | The system must display the adjustment history of a Monthly Budget (date, delta, note) | Must Have |
| MBGT-07 | If creating an expense transaction for month T and no budget for month T exists, the system must return an error and prompt the user to create a budget first | Must Have |
| MBGT-08 | The system must display a Pace Line Chart for the Monthly Budget (see FR-CHART) | Must Have |

---

### 6.4 Custom Budget (CBGT)

| ID | Requirement | Priority |
|----|-------------|----------|
| CBGT-01 | Users must be able to create a Custom Budget with: name and target amount | Must Have |
| CBGT-02 | Custom Budgets have an active or inactive status that users can toggle at any time | Must Have |
| CBGT-03 | Only active Custom Budgets are shown in the transaction entry form | Must Have |
| CBGT-04 | A single expense transaction can be assigned to multiple Custom Budgets simultaneously | Must Have |
| CBGT-05 | Users must be able to view the list of transactions linked to each Custom Budget | Must Have |
| CBGT-06 | The system must display progress for each Custom Budget: total spent / target | Must Have |
| CBGT-07 | Users must be able to edit the name and target amount of a Custom Budget | Should Have |
| CBGT-08 | Users must be able to delete a Custom Budget (associated transactions are not deleted) | Should Have |

---

### 6.5 Budget Config (BCFG)

| ID | Requirement | Priority |
|----|-------------|----------|
| BCFG-01 | Each user has exactly one Budget Config record | Must Have |
| BCFG-02 | Budget Config stores the default budget value used to seed next month's Monthly Budget | Must Have |
| BCFG-03 | Changing Budget Config does not affect existing Monthly Budgets | Must Have |
| BCFG-04 | The UI must clearly indicate that this value applies only to the next month | Must Have |

---

### 6.6 Category Management (CAT)

| ID | Requirement | Priority |
|----|-------------|----------|
| CAT-01 | Categories have a hierarchical structure up to 3 levels deep | Must Have |
| CAT-02 | The system must automatically create a default set of seed categories when a new user registers | Must Have |
| CAT-03 | If a user has no categories, the system must provide a manual "seed categories" action to create the default set on demand | Must Have |
| CAT-04 | Users must be able to add a category at any level (1, 2, or 3) | Must Have |
| CAT-05 | Users must be able to rename any category | Must Have |
| CAT-06 | Users must be able to delete categories that have no transactions and no child categories | Must Have |
| CAT-07 | When deleting a category that is used by transactions, the system must reject the deletion and display the number of affected transactions | Must Have |
| CAT-08 | Only leaf nodes (categories with no children) may be assigned to transactions | Must Have |
| CAT-09 | Level-3 categories cannot have child categories | Must Have |

**Default seed categories:**

```
Ăn uống
  └─ Ăn ngoài
  └─ Đi chợ / siêu thị
  └─ Đồ uống

Đi lại
  └─ Xăng
  └─ Gửi xe
  └─ Taxi / Grab

Mua sắm
  └─ Quần áo
  └─ Điện tử
  └─ Gia dụng

Sức khoẻ
  └─ Thuốc
  └─ Khám bệnh

Giải trí
  └─ Phim / sự kiện
  └─ Game
  └─ Du lịch

Hoá đơn & dịch vụ
  └─ Điện nước
  └─ Internet / điện thoại
  └─ Thuê nhà

Thu nhập
  └─ Lương
  └─ Thưởng
  └─ Thu nhập khác
```

---

### 6.7 Pace Line Chart (CHART)

| ID | Requirement | Priority |
|----|-------------|----------|
| CHART-01 | The chart must display 2 lines: the ideal budget line (dashed) and the actual spending line (solid) | Must Have |
| CHART-02 | X-axis: days of the month (1 to N); Y-axis: amount in VND | Must Have |
| CHART-03 | Ideal budget line: linear from 0 to `budget_amount`; value at day D = `(budget_amount / days_in_month) × D` | Must Have |
| CHART-04 | Actual spending line: cumulative sum of expense transactions from the start of the month to today | Must Have |
| CHART-05 | Fill area between the two lines: green when actual ≤ ideal, red when actual > ideal | Must Have |
| CHART-06 | The actual line is drawn only up to the current day (no future projection) | Must Have |
| CHART-07 | When the budget is adjusted, the ideal line must reflect the current budget amount | Must Have |

---

### 6.8 Dashboard & Reporting (RPT)

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-01 | The Home screen must display: total spent this month, remaining budget, and this month's savings | Must Have |
| RPT-02 | Monthly savings = total income − total expenses for the month | Must Have |
| RPT-03 | The Transactions screen must display a summary: total expenses, total income, and savings for the viewed month | Must Have |
| RPT-04 | Users must be able to navigate to view data from previous months | Must Have |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-01 | Each user has exactly 1 Monthly Budget per month (unique constraint: user_id + month) |
| BR-02 | A Monthly Budget for month T must exist before creating an expense transaction with a date in month T |
| BR-03 | Income transactions must not be linked to any Monthly Budget or Custom Budget |
| BR-04 | Custom Budgets have no time constraint — they persist until the user deletes or deactivates them |
| BR-05 | Budget Adjustment stores the delta (positive = increase, negative = decrease); `MonthlyBudget.amount` always reflects the current total |
| BR-06 | A category in use by at least one transaction cannot be deleted |
| BR-07 | A category that still has child categories cannot be deleted |
| BR-08 | Only leaf nodes (categories with no children) may be assigned to transactions |
| BR-09 | Categories have a maximum of 3 levels; level-3 categories cannot have children |
| BR-10 | Transaction amount must be a positive integer (> 0); negative values and decimals are not allowed |
| BR-11 | Budget Config changes do not retroactively affect existing Monthly Budgets |
| BR-12 | An expense transaction may belong to 0, 1, or many Custom Budgets simultaneously |
| BR-13 | Each user has exactly 1 Budget Config record (auto-created on first login) |
| BR-14 | Seed categories are auto-created for new users on first login; users with no categories may also trigger seeding on demand via `POST /api/categories/seed` |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-P01 | API response time for standard operations (CRUD) < 500ms |
| NFR-P02 | Pace Line Chart must render in < 1 second with up to 31 data points |
| NFR-P03 | Monthly transaction list must load in < 1 second |
| NFR-P04 | API responses for categories must include HTTP `Cache-Control` headers (`private, max-age=3600`) to allow browser caching |
| NFR-P05 | Past-month transaction and dashboard data must be cached by the browser (`private, max-age=86400`) as it is immutable |

### 8.2 Security

| ID | Requirement |
|----|-------------|
| NFR-S01 | Every API endpoint must authenticate the session before processing any request |
| NFR-S02 | User A must not be able to read or modify User B's data |
| NFR-S03 | SQL queries must use parameterized statements, never string concatenation |
| NFR-S04 | Session cookies must have both httpOnly and Secure flags set |

### 8.3 Usability

| ID | Requirement |
|----|-------------|
| NFR-U01 | The UI must work well on iPhone (375px – 430px viewport width) |
| NFR-U02 | The UI must be responsive on desktop (1280px+) |
| NFR-U03 | All amounts must display with thousands separators (e.g., 1.500.000 ₫) |
| NFR-U04 | The transaction form must auto-focus the amount field when the app is opened |

### 8.4 Reliability

| ID | Requirement |
|----|-------------|
| NFR-R01 | The app runs on Cloudflare Workers (edge network); uptime is governed by Cloudflare's SLA |
| NFR-R02 | Data is stored in Cloudflare D1 (SQLite) with automatic backups per D1's policy |

### 8.5 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-M01 | Schema migrations must use Wrangler migrations; no direct database edits allowed |
| NFR-M02 | Every schema change must have a corresponding migration file |

---

## 9. Data Requirements

### 9.1 Entity Relationship Overview

```
User ─────────┬──── BudgetConfig (1:1)
              ├──── Category (1:N)
              ├──── MonthlyBudget (1:N, unique per month)
              │         └──── BudgetAdjustment (1:N)
              ├──── CustomBudget (1:N)
              └──── Transaction (1:N)
                        ├──── Category (N:1)
                        ├──── MonthlyBudget (N:1, nullable for income)
                        └──── CustomBudget (N:M via TransactionCustomBudget)
```

### 9.2 Data Dictionary

#### User

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | PK | Managed by better-auth |
| email | TEXT | NOT NULL, UNIQUE | Email GitHub |
| name | TEXT | | Display name |
| created_at | DATETIME | NOT NULL | |

#### Category

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| name | TEXT | NOT NULL | |
| parent_id | INTEGER | FK → Category.id, nullable | Null if level 1 |
| level | INTEGER | NOT NULL, CHECK (1-3) | |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Display order |
| created_at | DATETIME | NOT NULL | |

#### Transaction

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| amount | INTEGER | NOT NULL, CHECK (> 0) | VND, positive integer |
| type | TEXT | NOT NULL, CHECK ('expense','income') | |
| category_id | INTEGER | NOT NULL, FK → Category.id | |
| note | TEXT | nullable | |
| date | TEXT | NOT NULL | Format YYYY-MM-DD |
| monthly_budget_id | INTEGER | FK → MonthlyBudget.id, nullable | Null for income |
| created_at | DATETIME | NOT NULL | |

#### TransactionCustomBudget

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| transaction_id | INTEGER | NOT NULL, FK → Transaction.id | |
| custom_budget_id | INTEGER | NOT NULL, FK → CustomBudget.id | |
| PRIMARY KEY | | (transaction_id, custom_budget_id) | |

#### MonthlyBudget

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| month | TEXT | NOT NULL | Format YYYY-MM |
| amount | INTEGER | NOT NULL, CHECK (> 0) | Current value after adjustments |
| created_at | DATETIME | NOT NULL | |
| UNIQUE | | (user_id, month) | |

#### BudgetAdjustment

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| monthly_budget_id | INTEGER | NOT NULL, FK → MonthlyBudget.id | |
| delta | INTEGER | NOT NULL | Positive = increase, negative = decrease |
| note | TEXT | nullable | Reason for adjustment |
| created_at | DATETIME | NOT NULL | |

#### CustomBudget

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| name | TEXT | NOT NULL | |
| amount | INTEGER | NOT NULL, CHECK (> 0) | Target amount |
| is_active | INTEGER | NOT NULL, DEFAULT 1 | 1 = active, 0 = inactive |
| created_at | DATETIME | NOT NULL | |

#### BudgetConfig

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, UNIQUE, FK → User.id | 1 row per user |
| default_monthly_amount | INTEGER | NOT NULL, CHECK (> 0) | Seed value for next month |
| updated_at | DATETIME | NOT NULL | |

---

## 10. User Interface Requirements

### 10.1 Navigation Structure

```
App (authenticated)
├── Tab 1: Home
│   ├── Status Card (budget pace summary)
│   └── Log Transaction Form
├── Tab 2: Transactions
│   ├── Month Navigator
│   ├── Summary Bar (expenses / income / savings)
│   └── Transaction Feed (grouped by date)
├── Tab 3: Budgets
│   ├── Monthly Budget Section
│   │   ├── Pace Line Chart
│   │   ├── Adjust Budget Action
│   │   └── Adjustment History (accordion)
│   └── Custom Budgets Section
│       ├── Budget Cards (progress + toggle)
│       └── Create Custom Budget (FAB)
└── Tab 4: Settings
    ├── Categories (tree view, 3 levels)
    ├── Budget Config (default monthly amount)
    └── Account (profile + sign out)
```

### 10.2 Home Screen — Log Transaction Form

**Field order and behavior:**

| # | Field | Type | Required | Notes |
|---|-------|------|----------|-------|
| 1 | Số tiền | Number input | Yes | Auto-focus when tab opens; auto-formats thousands separator |
| 2 | Loại | Segmented control | Yes | Chi tiêu / Thu nhập; default Chi tiêu |
| 3 | Danh mục | Bottom sheet picker | Yes | 3-level tree; leaf nodes only |
| 4 | Ghi chú | Text input | No | Placeholder "Ghi chú..." |
| 5 | Ngày | Date picker | Yes | Defaults to today |
| 6 | Custom budgets | Multi-select chips | No | Shown only when Loại = Chi tiêu; active budgets only |
| 7 | Nút Lưu | Button | — | Submit form |

**Post-submit behavior:** Reset Số tiền and custom budgets; preserve Loại, Danh mục, and Ngày; show toast "Đã lưu ✓"; refresh status card.

### 10.3 Status Card (Home)

Displayed in order:

1. Month label: "Tháng 5/2026 · còn N ngày"
2. Progress: "Đã chi X.XXX.XXX ₫ / Y.YYY.YYY ₫"
3. Mini pace bar: 2 layers (ideal budget to today vs actual)
4. Savings: "Tiết kiệm: +Z.ZZZ.ZZZ ₫" (green if positive, red if negative)

### 10.4 Design System

Tuân thủ `DESIGN.md`:

- Color tokens (no inline hex values)
- Typography: SF Pro Display/Text, body 17px
- Spacing tokens
- Mobile-first, breakpoint collapse strategy

---

## 11. Process Flows

Detailed sequence diagrams are described in [`FLOWS.md`](./FLOWS.md).

| Flow | Diagram |
|------|---------|
| GitHub OAuth login | FLOWS.md #1 |
| Log expense transaction | FLOWS.md #2 |
| Log income transaction | FLOWS.md #3 |
| Manually create Monthly Budget | FLOWS.md #4 |
| Adjust Monthly Budget | FLOWS.md #5 |
| Create Custom Budget | FLOWS.md #6 |
| Toggle Custom Budget active/inactive | FLOWS.md #7 |
| Add category | FLOWS.md #8 |
| Delete category | FLOWS.md #9 |
| Update Budget Config | FLOWS.md #10 |

---

## 12. Assumptions & Constraints

### 12.1 Assumptions

| ID | Assumption |
|----|------------|
| A-01 | Users have a GitHub account to log in with |
| A-02 | All transactions are entered manually; no bank integration |
| A-03 | Only VND is used; multi-currency is not required |
| A-04 | Users proactively create a Monthly Budget before entering transactions for a new month |
| A-05 | Monthly transaction volume is at a personal scale (< 500 transactions/month) |

### 12.2 Constraints

| ID | Constraint |
|----|------------|
| C-01 | Must run on Cloudflare Pages + D1; no dedicated server allowed |
| C-02 | Database is SQLite (D1), not PostgreSQL/MySQL |
| C-03 | Framework is Next.js App Router + TypeScript; no change allowed |
| C-04 | No offline mode |

### 12.3 Dependencies

| ID | Dependency | Impact if Unavailable |
|----|------------|----------------------|
| D-01 | GitHub OAuth | Cannot log in |
| D-02 | Cloudflare D1 | Cannot store or read data |
| D-03 | Cloudflare Pages | App cannot be deployed |
| D-04 | better-auth | Entire auth flow is affected |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Monthly Budget | Budget created for a specific calendar month. Each user has at most 1 budget per month. |
| Custom Budget | An open-ended named budget with no time limit, used for specific projects or goals (e.g., "Da Lat Trip"). |
| Budget Adjustment | A single change to a Monthly Budget's amount, recording the delta and a note to create an audit trail. |
| Budget Config | Settings that store the default budget value, used only to seed next month's Monthly Budget. |
| Pace Line | A chart comparing actual cumulative spending against the ideal (linear) budget line. |
| Pace | Spending rate. "On pace" = spending at the expected rate relative to the budget; "Over pace" = spending faster than planned. |
| Leaf Node | A category with no child categories. Only leaf nodes may be assigned to transactions. |
| Seed Data | Default data auto-created when a user registers for the first time (categories, budget config). |
| Delta | The change value in a Budget Adjustment. Positive (+) = budget increase, negative (−) = budget decrease. |
| Cumulative Sum | The running total of spending from day 1 to day D in a month, used to plot the actual line on the Pace Line chart. |
