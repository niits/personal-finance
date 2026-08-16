# Single-Cash Ledger Implementation Plan

| Field | Value |
|-------|-------|
| Status | Approved |
| Date | 2026-08-16 |
| Decision | `docs/adr/005-single-cash-position-ledger.md` |

## Goal

Replace the current flag-based transaction/debt model with one aggregate liquid-cash ledger and named receivable/payable positions. Preserve fast mobile expense entry while making spending, credit-card payments, term deposits, principal movements, savings, and safe-to-spend mathematically consistent.

## Scope

Included:

- Clean-start onboarding with aggregate opening cash and optional opening positions.
- Cash/debit income, expenses, and refunds.
- Credit-card purchases, refunds, and principal payments.
- Principal-only term deposits and personal lending/borrowing.
- Budget periods with planned income, savings target, and spending limit.
- Period-owned custom envelopes and amount-bearing allocations that split one expense without duplicating money.
- Dashboard metrics, transaction feed, category/custom-budget attribution, analytics, AI inputs, and export over the new ledger.
- Mobile-first forms and position detail flows.

Excluded:

- Multiple bank or cash accounts.
- Interest and fees as position-specific calculations. Manually entered fees remain ordinary expenses.
- Multi-currency, investments, valuations, bank sync, recurring schedules, split payments, and statement reconciliation.
- Historical conversion from the old finance schema.

## Delivery Strategy

Use one feature branch and small implementation commits. Tests lead each behavior change. Use expand/contract releases because D1 migrations run before application deployment. Do not deploy or enable the financial reset in production until the user explicitly approves the cutover.

Before implementation, create a checked migration matrix covering every reference to `transaction`, `monthly_budget`, `budget_adjustment`, `debt`, `transaction_custom_budget`, finance cache key, export path, statistics report, AI input, seed/reset helper, route, page, and test fixture. Each row needs a replacement owner and verification test.

## Phase 1: Ledger Contract

1. Add pure TypeScript types for semantic commands and event effects.
2. Add `zod` as a direct dependency instead of relying on a transitive package.
3. Define the complete position-kind/action matrix, overpayment rules, immutable opening fields, refunded-expense edit rules, and request/response/error unions.
4. Implement one exhaustive event constructor that produces constrained deltas.
5. Add unit tests for every mapping in ADR 005, including positive/negative adjustments.
6. Add pure metric functions for cash, positions, net worth, period savings, and safe-to-spend.
7. Test the accounting equation for every event fixture.

Acceptance criteria:

- Clients cannot provide ledger deltas.
- Every supported semantic command maps to exactly one event shape.
- All event fixtures satisfy the accounting equation.
- Principal movements never change income or expense.

## Phase 2: D1 Schema

1. Add an additive migration for `financial_profile`, `financial_write_request`, `financial_position`, `budget_period`, `ledger_budget_adjustment`, `ledger_custom_budget`, `financial_event`, and `financial_event_custom_budget_allocation`; do not rebuild or drop legacy tables in this phase.
2. Add composite ownership indexes and foreign keys.
3. Add kind-specific `CHECK` constraints, idempotency uniqueness, and opening-event uniqueness.
4. Update `src/lib/schema.ts` with all new tables.
5. Add fresh-schema and populated legacy upgrade-path integration tests against D1, including two users and all legacy finance tables.

Acceptance criteria:

- Cross-user references fail at the database boundary.
- Balanced but semantically invalid rows fail.
- Duplicate idempotency and opening keys fail.
- Invalid amount and malformed date shapes fail.
- Custom allocation sums above the event amount and cross-user allocations fail.

## Phase 3: Ledger Service

1. Implement the canonical Vietnam-date validator and budget-period resolver.
2. Implement initialization, event CRUD, refund, position movement, and adjustment services.
3. Use `D1Database.batch()` for every multi-write operation. Claim idempotency with a conflict-failing first insert and enforce cross-row gates through aborting SQLite triggers; never rely on a preceding batch `SELECT` or zero affected rows.
4. Enforce ownership, category type, position compatibility, no future actuals, exact event-period membership, refund limits, cumulative deterministic partial-refund allocation, immutable refunded-expense allocations, immutable used-period boundaries, archived-position rejection, and zero-balance archival.
5. Make duplicate idempotency keys return the original result.

Acceptance criteria:

- Retried mobile writes create one event.
- Parallel refund, initialization, idempotency, period-overlap, and archival attempts preserve invariants and stable conflict codes.
- Editing an event regenerates all effects and period attribution.
- Editing an expense cannot invalidate existing refunds.
- Editing custom allocations cannot duplicate money or invalidate refund allocations.
- No service uses interactive SQL transactions.

## Phase 4: API Cutover

1. Add the semantic routes listed in ADR 005 with typed input/output schemas.
2. Apply session verification and user scoping to every route.
3. Use consistent validation, conflict, and not-found error codes.
4. Add integration tests for every route and cross-user attempt.
5. Keep legacy routes operational until all consumers move; remove them only in the contract release.

Acceptance criteria:

- No public endpoint accepts delta columns.
- Another user's IDs always behave as not found.
- Expense, refund, funding, withdrawal, payment, and borrowing flows round-trip through API tests.

## Phase 5: Read Models and Analytics

1. Create one ledger query service used by dashboard, feed, pace, statistics, AI, and export.
2. Replace `SUM(CASE WHEN transaction.type...)` queries with event delta metrics and amount-bearing custom-budget allocations.
3. Add as-of boundaries to every balance query.
4. Reconcile headline totals with category and daily breakdown totals.
5. Add safe-to-spend, savings target gap, cash balance, reserved card debt, and net worth outputs.
6. Version finance API URLs/cache keys and invalidate persisted statistics and AI-derived reports at cutover.

Acceptance criteria:

- Headline and grouped totals reconcile exactly.
- Card payments and term-deposit movements do not appear as spending.
- A card purchase reduces spending budget immediately.
- Future or scheduled items do not affect current balances.
- Period remaining equals unassigned remaining plus all custom-envelope remaining values, including cross-period refunds attributed to their original period.

## Phase 6: UI Cutover

Before writing UI, read `docs/COMPONENT_ARCHITECTURE.md`, `DESIGN.md`, and use the frontend-design skill.

1. Add onboarding for ledger date, opening cash, reserve, and optional opening positions.
2. Create or collect the initial budget period during onboarding so the first expense has a valid period.
3. Keep the common expense form under ten seconds with `Cash/debit` as default, card as an optional payment selector, and an optional custom-budget split whose amounts cannot exceed the expense.
4. Replace the Debts screen with Positions covering cards, deposits, receivables, and payables.
5. Add semantic actions: pay card, fund/withdraw deposit, lend/receive repayment, borrow/repay.
6. Redesign the home summary around safe-to-spend, period spending, target savings, and obligations.
7. Move finance fetching/mutations to page-owned hooks and callbacks; atoms and molecules remain pure.
8. Add every new component in its required level folder with implementation, `index.ts`, and isolated CSF3 stories covering meaningful states.

Acceptance criteria:

- A cash expense needs no extra account selection.
- A card expense needs one additional payment choice.
- Position movements cannot be mistaken for income or expense in labels or summaries.
- The UI labels custom remaining as a subset of period capacity and never adds it to period remaining.
- Mobile and desktop layouts load without overflow or inaccessible controls.

## Phase 7: Expand Release

1. Ship complete legacy export before any reset can occur.
2. Add explicit fresh-start consent and persist successful export/consent state.
3. Deploy additive schema while legacy reads and writes continue unchanged.
4. Verify the populated legacy upgrade path and disable reset if export is incomplete.

## Phase 8: Per-User Cutover

1. Freeze legacy writes for the user after confirmed export and consent.
2. Initialize profile, opening events, opening positions, and initial budget in one idempotent batch.
3. Switch every finance consumer to versioned ledger APIs/cache keys in the same application release.
4. Update `BRD.md`, `TECHNICAL_DESIGN.md`, `SEMANTIC_LAYER.md`, `TESTING.md`, component architecture references, and the documentation registry to describe the active ledger system.
5. Invalidate persisted statistics and AI-derived legacy reports.
6. Treat the first ledger write as the point of no return; use forward fixes afterward.

## Phase 9: Contract Release

1. Remove legacy routes and source only after all consumers and tests use ledger APIs.
2. Remove legacy tables in a later migration after user acceptance.
3. Remove legacy-only documentation after the legacy code and tables are removed.

Acceptance criteria:

- There is no mixed old/new reporting path.
- New users can complete initialization from zero.
- Existing users cannot accidentally start without acknowledging the reset.

## Verification

Run in this order at minimum:

```bash
npm run test:unit
npm run lint
npm run build
npm run build:cf
npm run test:integration
npm run build-storybook
npm run test:e2e
```

Also run targeted end-to-end scenarios:

1. Opening cash -> cash expense -> income.
2. Card purchase -> partial refund -> card payment.
3. Place deposit -> partial withdrawal -> maturity.
4. Lend -> partial repayment -> settle.
5. Borrow -> partial repayment -> settle.
6. Retry the same write with one idempotency key.
7. Attempt cross-user position, category, event, and period references.
8. Verify safe-to-spend before and after each scenario.
9. Split one expense across two custom budgets, issue repeated partial refunds in a later period, and reconcile custom plus unassigned remaining to the original period total.
10. Run parallel duplicate/refund/initialization/overlap/archive requests with `Promise.all`.
11. Upgrade a populated two-user legacy fixture and verify legacy routes before cutover and ledger routes after cutover.

## Rollback

- Do not delete old tables in the first ledger release.
- Roll back application code only before the first ledger write for that user.
- After enablement, use a read-only maintenance mode and forward fix; never expose stale legacy writes.
- New ledger data may be exported separately before rollback.
- Never attempt to merge new ledger events back into the old `income | expense` model.

## Definition of Done

- ADR 005 is accepted.
- All phases above are implemented or explicitly deferred with user approval.
- Unit, integration, lint, production build, Storybook build, and targeted E2E checks pass.
- No old transaction/debt query remains in an active finance screen or report.
- The user verifies opening balance, one card cycle, and one term-deposit cycle before production cutover.
