# Debt Tracking — Test Specification

| Field | Value |
|-------|-------|
| Type | Test Specification |
| Version | 1.0 |
| Status | Draft |
| Epic | Epic 4: Debt Tracking |
| Source of truth | `docs/specs/debt-tracking.md` (SRS v1.1) |
| Related | `docs/TESTING.md`, `docs/TECHNICAL_DESIGN.md` |
| Created | 2026-05-30 |

---

## 1. Purpose & Scope

This document enumerates the test cases that verify the Debt Tracking feature against
its SRS. Every case traces to a rule (`D-xx`), functional requirement (`DEBT-xx`),
API contract (§8), or user flow (§6) in the SRS.

The feature is **transaction-centric**: a debt has no `amount` column; the principal
is `opening_transaction.amount` and repayments are ordinary `transaction` rows with a
`debt_id`. Tests must assert this model — not the legacy `debt.amount` / `repaid` model
that was removed in migration `0013`.

### Test layers

| Layer | Tool | Verifies | Location |
|-------|------|----------|----------|
| Unit | Vitest (node) | Pure functions & computed values in `src/lib/debt.ts` | `src/lib/debt.test.ts` |
| Integration | Vitest + Workers pool | Migrations + API routes against real D1 | `tests/integration/debt*.test.ts` |
| E2E | Playwright | API + UI flows in a real browser/server | `tests/e2e/specs/debts.spec.ts` |

---

## 2. Coverage Matrix (SRS rule → test case → layer)

| Rule | Assertion | Case ID | Layer |
|------|-----------|---------|-------|
| D-01 | Debt scoped to owner; cross-user read/write blocked | INT-OWN-1, INT-OWN-2 | Integration |
| D-02 | A transaction belongs to at most one debt | INT-LINK-3 | Integration |
| D-04 | At most one opening transaction per debt | INT-CREATE-1 | Integration |
| D-05 | Opening tx type matches debt type (lend→expense, borrow→income) | UNIT-TYPE-1, INT-CREATE-2 | Unit, Integration |
| D-06 | Debt with no opening tx not surfaced as valid | INT-CREATE-1 | Integration |
| D-07 | Opening tx cannot be unlinked while repayments exist | INT-UNLINK-2, E2E-UNLINK-2 | Integration, E2E |
| D-08 | Repayment type is inverse of opening | UNIT-TYPE-2, INT-LINK-2 | Unit, Integration |
| D-09 | Overpayment allowed; remaining may go negative | UNIT-CALC-3, INT-REPAY-3 | Unit, Integration |
| D-10 | Any repayment can be unlinked | INT-UNLINK-1, E2E-UNLINK-1 | Integration, E2E |
| D-11 | Unlink rejected if it would break the expense CHECK | INT-UNLINK-3 | Integration |
| D-12 | Status never auto-updated by the system | INT-REPAY-4 | Integration |
| D-13 | Settle action sets status=settled | INT-SETTLE-1, E2E-SETTLE-2 | Integration, E2E |
| D-14 | Settled debt is read-only (no new repayments/links) | INT-REPAY-5, INT-LINK-4 | Integration |
| D-15 | Only `debt_id IS NULL` transactions can be linked | INT-LINK-3 | Integration |
| D-16 | Linked repayment must have correct type | INT-LINK-2 | Integration |
| D-17 | Cannot link to a settled debt | INT-LINK-4 | Integration |
| D-18 | Deleting a debt removes debt-only expense entries, detaches & keeps the rest | BUG-1a/b/c, E2E-DEL-1 | Integration, E2E |
| D-19 | Deleting opening tx leaves debt incomplete (opening_transaction_id NULL) | INT-SCHEMA-5 | Integration |
| D-20 | Debt transactions counted in budget pace (one simple model) | BUG-2a | Integration |
| D-21 | Debt transactions included in income/expense totals | INT-BUDGET-2 | Integration |
| D-22/23 | Category breakdown skips `category_id IS NULL` without error | INT-STATS-1 | Integration |
| DEBT-01..03 | Create debt + opening tx (party, amount, date, optional due_date) | INT-CREATE-*, E2E-CREATE-1 | Integration, E2E |
| DEBT-04/05 | Edit party/note/due_date/status; type immutable | INT-PATCH-*, E2E-API-PATCH | Integration, E2E |
| DEBT-06 | Delete debt | INT-DEL-1 | Integration, E2E |
| DEBT-12 | Record repayment via POST /api/transactions | INT-REPAY-1, E2E-REPAY-1 | Integration, E2E |
| DEBT-14 | One-tap settle creates final repayment + sets settled | E2E-SETTLE-1/2 | E2E |
| DEBT-16/17/19/20 | Overview: grouping, cards, settled section, summary | E2E-OV-* | E2E |
| DEBT-21/22/23 | Detail: history list, unlink action, amounts | E2E-DETAIL-* | E2E |

---

## 3. Unit Tests — `src/lib/debt.ts`

Pure logic, no DB. Runner: `vitest run --config vitest.unit.config.ts`.

| Case ID | Function | Input | Expected |
|---------|----------|-------|----------|
| UNIT-TYPE-1 | `debtOpeningTxType` | `"lend"` / `"borrow"` | `"expense"` / `"income"` |
| UNIT-TYPE-2 | `repaymentTxType` | `"lend"` / `"borrow"` | `"income"` / `"expense"` |
| UNIT-TYPE-3 | type helpers | opening and repayment of same debt type | always inverse of each other |
| UNIT-CALC-1 | remaining | opening 1.000.000, repaid 0 | remaining = 1.000.000 |
| UNIT-CALC-2 | remaining | opening 1.000.000, repaid 400.000 | remaining = 600.000 |
| UNIT-CALC-3 | remaining (overpay, D-09) | opening 1.000.000, repaid 1.200.000 | remaining = −200.000 |
| UNIT-CALC-4 | remaining (no opening, D-06) | opening_amount 0 | remaining = −total_repaid |
| UNIT-OVERDUE-1 | is_overdue | due_date in past, status open | `true` |
| UNIT-OVERDUE-2 | is_overdue | due_date in past, status settled | `false` (only open debts overdue) |
| UNIT-OVERDUE-3 | is_overdue | due_date in future, status open | `false` |
| UNIT-OVERDUE-4 | is_overdue | due_date null | `false` |
| UNIT-OVERDUE-5 | is_overdue | due_date == today | `false` (strict `<`) |

> Computed-value cases (`UNIT-CALC-*`, `UNIT-OVERDUE-*`) exercise the same arithmetic
> `getDebtWithRepayments` applies. If the inline logic is later extracted to a pure
> helper, point these cases at it directly; until then they assert the formulas as
> documented in SRS §3.4.

---

## 4. Integration Tests — D1 + API

Runner: `vitest run --config vitest.config.ts`. Each file applies all migrations,
seeds a user + session, and drives the real routes via `SELF.fetch`.

### 4.1 Schema & migration (`debt.test.ts`) — post-0013 model

| Case ID | Assertion |
|---------|-----------|
| INT-SCHEMA-1 | `debt` table exists |
| INT-SCHEMA-2 | Columns = `id, user_id, type, party, note, due_date, status, opening_transaction_id, created_at`; **no `amount`** |
| INT-SCHEMA-3 | `CHECK(type IN ('lend','borrow'))` rejects other values |
| INT-SCHEMA-4 | `CHECK(status IN ('open','settled'))` rejects other values; default `open` |
| INT-SCHEMA-5 | Deleting the opening transaction sets `debt.opening_transaction_id = NULL` (FK SET NULL, D-19) |
| INT-SCHEMA-6 | `transaction.debt_id` exists, nullable, FK SET NULL on debt delete |
| INT-SCHEMA-7 | `transaction` CHECK accepts expense with `debt_id` and null budget; rejects expense with both null |

### 4.2 Create — `POST /api/debts` (§8.1)

| Case ID | Request | Expected |
|---------|---------|----------|
| INT-CREATE-AUTH | no session | 401 |
| INT-CREATE-1 | lend, party, amount, date | 201; `opening_amount`=amount; `remaining`=amount; `total_repaid`=0; status open; `transactions` has 1 row with `is_opening:true`; `opening_transaction_id` set |
| INT-CREATE-2 | lend → opening tx | created tx `type="expense"`; borrow → `type="income"` (D-05) |
| INT-CREATE-3 | with `due_date` + `transaction_note` | persisted; debt.note and tx.note are distinct |
| INT-CREATE-VAL-1 | missing/empty party | 400 |
| INT-CREATE-VAL-2 | type not lend/borrow | 400 |
| INT-CREATE-VAL-3 | amount 0 / negative / non-integer | 400 |
| INT-CREATE-VAL-4 | missing or malformed date | 400 |
| INT-CREATE-VAL-5 | invalid JSON body | 400 |

### 4.3 List & read — `GET /api/debts`, `GET /api/debts/[id]` (§8.2–8.3)

| Case ID | Assertion |
|---------|-----------|
| INT-LIST-AUTH | 401 without session |
| INT-LIST-1 | empty user → `{lending:[], borrowing:[], settled:[]}` |
| INT-LIST-2 | open lend in `lending`; open borrow in `borrowing`; any settled in `settled` |
| INT-LIST-3 | each item carries computed `opening_amount/total_repaid/remaining/is_overdue` + `transactions[]` |
| INT-GET-1 | `GET /[id]` returns full debt with ordered `transactions` (date asc, id asc) |
| INT-GET-2 | unknown id → 404 |
| INT-OWN-1 | `GET /[id]` of another user's debt → 404 (D-01) |

### 4.4 Repayment — `POST /api/transactions` with `debt_id` (§8.8, DEBT-12)

| Case ID | Request | Expected |
|---------|---------|----------|
| INT-REPAY-1 | income tx with `debt_id` on a lend debt | 201; `total_repaid` += amount; `remaining` -= amount; tx has no category/budget |
| INT-REPAY-2 | repayment tx omits category & budget | stored (CHECK satisfied via `debt_id`) |
| INT-REPAY-3 | repayment > remaining (D-09) | 201; `remaining` negative; no auto-settle |
| INT-REPAY-4 | after full repayment | status stays `open` (D-12 — never auto-settles) |
| INT-REPAY-5 | repayment on settled debt (D-14) | 400 |
| INT-REPAY-AUTH | no session | 401 |
| INT-REPAY-VAL | amount 0/negative | 400 |
| INT-REPAY-OWN | `debt_id` of another user | 404 |

### 4.5 Update — `PATCH /api/debts/[id]` (§8.4)

| Case ID | Body | Expected |
|---------|------|----------|
| INT-PATCH-1 | `{party}` | 200; updated |
| INT-PATCH-2 | `{note}` then `{note:null}` | set, then cleared |
| INT-PATCH-3 | `{due_date}` | updated; recomputes `is_overdue` |
| INT-PATCH-4 | `{status:"settled"}` then `{status:"open"}` | settle then reopen (DEBT-07) |
| INT-PATCH-5 | `{type:"borrow"}` | ignored — type immutable (DEBT-05); response type unchanged |
| INT-PATCH-6 | `{}` (no updatable field) | 400 |
| INT-PATCH-7 | unknown id | 404 |
| INT-PATCH-AUTH | no session | 401 |

### 4.6 Delete — `DELETE /api/debts/[id]` (§8.5)

| Case ID | Assertion |
|---------|-----------|
| INT-DEL-1 | 204; debt gone (subsequent GET 404); linked transactions remain with `debt_id=NULL` (D-18) |
| INT-DEL-2 | unknown id → 404 |
| INT-DEL-AUTH | no session → 401 |

### 4.7 Link / unlink — `PATCH|DELETE /api/transactions/[id]/link` (§8.6–8.7)

Note: the project also exposes equivalent link/unlink via `PATCH /api/transactions/[id]`
with `link_debt_id`; cases below cover the dedicated `/link` route (SRS contract).
The `link_debt_id` variant is covered in `transactions-debt-link.test.ts`.

| Case ID | Action | Expected |
|---------|--------|----------|
| INT-LINK-1 | link standalone income tx to open lend debt | 200; appears in debt `transactions` |
| INT-LINK-2 | link expense tx to lend debt (wrong type, D-16) | 409 `reason:"wrong_type"` |
| INT-LINK-3 | link an already-linked tx (D-15) | 409 `reason:"already_linked"` |
| INT-LINK-4 | link to settled debt (D-17) | 409 `reason:"debt_settled"` |
| INT-LINK-OWN | link debt of another user | 404 |
| INT-UNLINK-1 | unlink a repayment (D-10) | 200; `remaining` restored |
| INT-UNLINK-2 | unlink opening tx while repayments exist (D-07) | 409 `reason:"opening_has_repayments"` |
| INT-UNLINK-3 | unlink expense tx with null budget (D-11) | 409 `reason:"expense_requires_budget"` |
| INT-UNLINK-4 | unlink a tx with no `debt_id` | 409 `reason:"not_linked"` |
| INT-LINK-AUTH | no session (PATCH & DELETE) | 401 |

### 4.8 Budget & statistics integration (D-20..23)

| Case ID | Assertion |
|---------|-----------|
| BUG-2a | a debt expense (debt_id set, no budget) **is counted** in the monthly-budget pace/remaining, like any other expense (one simple model) |
| INT-BUDGET-2 | the same debt transactions **are included** in `summary.total_income/total_expense` |
| INT-STATS-1 | statistics/category aggregation skips `category_id IS NULL` rows without error |

---

## 5. E2E Tests — Playwright (`debts.spec.ts`)

Server: `dev:cf` on `:8787`. Data seeded directly into local D1 via `resetTestData(level)`.
The `"debts"` seed creates: **Minh** (lend, open, gốc 2.000.000, repaid 500.000 →
remaining 1.500.000, repayment note "Trả một phần"), **Chị Lan** (borrow, open,
1.000.000), **Anh Tuấn** (lend, settled, 500.000).

### 5.1 API guards & lifecycle (no UI)

| Case ID | Assertion |
|---------|-----------|
| E2E-AUTH-* | GET/POST/PATCH/DELETE `/api/debts*` and `/api/transactions/:id/link` → 401 unauthenticated |
| E2E-API-CREATE | POST creates debt + opening tx atomically; `transactions[0].is_opening` |
| E2E-API-GROUP | GET groups lending/borrowing/settled |
| E2E-API-GET | GET `/[id]` returns `opening_amount/total_repaid/remaining/transactions` |
| E2E-API-PATCH | PATCH updates party/note/due_date; settle via `{status:"settled"}` |
| E2E-DEL-1 | DELETE removes debt; opening tx survives with `debt_id=null` |
| E2E-REPAY-1 | POST tx with `debt_id` updates remaining; tx count grows |
| E2E-REPAY-2 | repayment on settled debt → 400 |
| E2E-LINK-1 | link income tx to lend debt → 200, shows in history |
| E2E-LINK-2 | link wrong type → 409 `wrong_type` |
| E2E-LINK-3 | link already-linked → 409 `already_linked` |
| E2E-UNLINK-1 | unlink repayment → 200, remaining restored |
| E2E-UNLINK-2 | unlink opening with repayments → 409 `opening_has_repayments` |

### 5.2 UI — overview (`/debts`)

| Case ID | Assertion |
|---------|-----------|
| E2E-OV-EMPTY | minimal seed → "Nợ" heading + empty state "Chưa có khoản nợ nào" |
| E2E-OV-LEND | debts seed → "Cho vay" section shows **Minh** card |
| E2E-OV-BORROW | "Đi vay" section shows **Chị Lan** card |
| E2E-OV-SUMMARY | summary tile shows Minh remaining 1.500.000 |
| E2E-OV-SETTLED | "Đã tất toán" section collapsed; **Anh Tuấn** hidden until expanded |
| E2E-OV-NAV | tapping Minh navigates to `/debts/:id` |

### 5.3 UI — detail (`/debts/[id]`)

| Case ID | Assertion |
|---------|-----------|
| E2E-DETAIL-HERO | shows party, opening 2.000.000, remaining 1.500.000 |
| E2E-DETAIL-HIST | "Lịch sử" lists opening row with "Gốc" badge and the repayment row "Trả một phần" |
| E2E-DETAIL-ACTIONS | "Ghi nhận thanh toán" and "Tất toán ngay" buttons visible (open debt, remaining>0) |
| E2E-DETAIL-BACK | "←" returns to `/debts` |

### 5.4 UI — create / repayment / settle flows (§6)

| Case ID | Flow | Assertion |
|---------|------|-----------|
| E2E-CREATE-1 | FAB → TransactionForm → "Liên kết nợ" → "Cho vay mới" → party → Lưu | new card appears in overview |
| E2E-REPAY-1 | detail → "Ghi nhận thanh toán" → form in repayment mode | title + locked debt chip; amount pre-filled with remaining |
| E2E-REPAY-2 | submit partial repayment 400.000 on Chị Lan | remaining updates to 600.000 |
| E2E-SETTLE-1 | detail → "Tất toán ngay" | confirm dialog "Tất toán khoản nợ" + "Xác nhận" button |
| E2E-SETTLE-2 | confirm settle | debt moves to "Đã tất toán" section |

---

## 6. Edge Cases Checklist

Derived from SRS §3–§6. Each must be covered by ≥1 case above.

- [ ] Opening tx type is **derived**, never user-chosen, for both directions (D-05).
- [ ] Repayment type is the **inverse** of the opening (D-08); wrong type rejected on link (D-16).
- [ ] **Overpayment**: `remaining` goes negative, no crash, no auto-settle (D-09, D-12).
- [ ] **No opening tx**: `opening_amount=0`; debt treated as incomplete (D-06, D-19).
- [ ] Deleting the **opening** transaction nulls `opening_transaction_id` (D-19, FK SET NULL).
- [ ] Deleting the **debt** removes its debt-only expense entries; detaches & keeps everything else (D-18).
- [ ] **Settled debt** rejects new repayments and new links; reopen restores write access (D-14, DEBT-07).
- [ ] Unlink the **opening** tx blocked while repayments exist (D-07); allowed when it is the only tx.
- [ ] Unlink that would leave an **expense without a budget** is rejected (D-11).
- [ ] Unlink a **non-linked** tx → 409 `not_linked`.
- [ ] **Cross-user** access to any debt/link endpoint → 404 (never 200/leak) (D-01).
- [ ] **Due date** boundary: overdue strictly when `due_date < today AND status=open`; equal-to-today is **not** overdue.
- [ ] Debt transactions **counted** in budget pace and **included** in income/expense totals (D-20, D-21).
- [ ] Category aggregation tolerates `category_id IS NULL` (D-22, D-23).
- [ ] `debt.note` and the opening `transaction.note` are **independent** fields.
- [ ] Amounts render in vi-VN locale (`.` thousands, `₫` suffix) (NFR-D05).
- [ ] Invalid JSON / missing fields on every write endpoint → 400, never 500.

---

## 7. Out of Scope (mirrors SRS §10)

Interest, multi-party debts, reminders/push, debt categories, import, non-VND currency —
no test cases. `LinkTransactionSheet` (picker UI) is a TODO in the detail page and is
exercised only through the API link cases until the UI ships.
