# Debt Tracking — Fix Plan (test-first)

| Field | Value |
|-------|-------|
| Type | Implementation Plan (for an executing agent) |
| Version | 1.0 |
| Status | Ready |
| Epic | Epic 4: Debt Tracking |
| Source of truth | `docs/specs/debt-tracking.md` (SRS v1.1), `docs/specs/debt-tracking-tests.md` |
| Created | 2026-05-30 |

---

## 0. How to use this document

This is a **test-first** plan. Each outstanding defect already has a test that
encodes the **desired** behaviour. Those tests are committed in a **disabled** state
(`it.skip` / `test.fixme`) so CI stays green until the fix lands.

For every task below:

1. Read the linked test(s) — they are the executable spec of "done".
2. Make the production change.
3. **Enable** the test (remove `.skip` / `.fixme`) and make it pass.
4. Remove any "tripwire" test that asserted the old broken behaviour (called out per task).
5. Update the SRS / test-spec doc if the task resolves a documented contradiction.

Do **not** change a test's intended assertion to make it pass — fix the code. If a
desired behaviour is genuinely ambiguous, resolve the **Decision** noted in the task
first (ask the product owner), then align the test.

**Run commands**

```bash
npm run test:unit                  # fast, no infra
npm run build:cf                   # required before API integration tests (see below)
npm run test:integration           # Workers pool; SELF.fetch routes need the build
npm run test:e2e                   # Playwright; needs dev:cf running on :8787
```

> **Integration infra note:** the Workers pool boots `.open-next/worker.js`, so run
> `npm run build:cf` first. The Next.js server bundle pulls in `node:os`, which the
> pool's workerd cannot resolve from the dynamically-required bundle (it works in real
> `wrangler dev`). This is now handled by a `resolve.alias` in `vitest.config.ts` that
> maps `node:os` to `tests/integration/node-os-stub.cjs` — without it every route test
> fails with `No such module "node:os"`. Schema tests that use `env.DB` directly are
> unaffected.
>
> **Known caveat (perf, not correctness):** routes compile on-demand inside workerd, so
> the first request to each route can be very slow; a few tests may still flake on a
> 30 s timeout on a cold machine. Re-run, or warm the route first. This is independent of
> the `node:os` fix above and of the assertions under test.

---

## 1. Defect register

| ID | Severity | Rule | Summary | Gating test (disabled) | Tripwire (delete on fix) |
|----|----------|------|---------|------------------------|--------------------------|
| BUG-1 | High | D-18 | Deleting a debt with unbudgeted expense txns violates the transaction CHECK → 500 instead of 204 | `tests/integration/debt-bugs.test.ts › BUG-1*` | `tests/integration/debt.test.ts › INT-SCHEMA-6b` |
| BUG-2 | ~~High~~ Resolved by decision | D-20/D-25 | **Decision: debt expenses DO count toward the budget/pace (one simple model).** No longer a defect — pace line keeps counting debt; the dashboard was made consistent (it previously excluded). Tasks B & D below are obsolete. | `tests/integration/debt-bugs.test.ts › BUG-2a` (now a regression guard) | — |
| GAP-1 | ✅ Done | DEBT-08/DEBT-11 | `LinkTransactionSheet` built + wired into the debt-detail page; links an eligible standalone transaction as a repayment. | `tests/e2e/specs/debts.spec.ts › GAP-1` (enabled, green) | — |
| BUG-3 | ~~Low~~ Resolved by decision | D-25 | Same decision as BUG-2: the statistics forecast keeps counting all expenses, debt included. No change needed. | — | — |
| DEC-1 | ✅ Resolved | Flow 3 | **Decision: stay on the detail page** after one-tap settle (shows the settled, read-only state). No code change; `E2E-SETTLE-2` already matches. | `tests/e2e/specs/debts.spec.ts › E2E-SETTLE-2` | — |

---

## 2. Tasks

### Task A — Fix debt deletion (BUG-1)

**Goal:** `DELETE /api/debts/[id]` succeeds (204) for every debt, leaving the DB in a
valid state, instead of throwing a CHECK violation.

**Root cause:** `transaction.debt_id` is `ON DELETE SET NULL` (migration 0012/0013),
but the transaction CHECK requires an expense to have a budget **or** a debt. A debt's
debt-only expense transactions (lend opening; borrow repayments) become invalid the
moment `debt_id` is nulled, so SQLite aborts the delete.

**Decision (resolve first):** SRS D-18 says "transactions are not deleted." That is
impossible for unbudgeted debt expenses. Pick one:

- **Option A (recommended): delete only the transactions that would become invalid** —
  i.e. `type = 'expense' AND monthly_budget_id IS NULL` (lend openings, borrow
  repayments). Keep everything else (income openings/repayments, budgeted expenses) and
  detach them (`debt_id = NULL`). This removes the minimum needed to stay valid. Update
  SRS D-18 to: "debt-only expense entries are removed with the debt; all other linked
  transactions are detached (`debt_id = NULL`) and kept."
- **Option B: relax the transaction CHECK** to allow free-floating expenses, so
  `SET NULL` leaves a valid (uncategorised, unbudgeted) expense. Honours D-18 literally
  but weakens the "every expense belongs to a budget" invariant (BR-03).

The gating test is written for **Option A**. If Option B is chosen, adjust the test's
post-condition (transactions remain, `debt_id` null) per the inline comment.

**Implementation (Option A):** in `src/app/api/debts/[id]/route.ts` `DELETE`, before/inside
the delete, remove debt-only transactions for this debt, then delete the debt — as a
single D1 batch so it is atomic. Example:

```ts
// remove the expense entries that SET NULL would invalidate, then the debt.
// FK ON DELETE SET NULL detaches the remaining (valid) transactions.
await db.transaction().execute(async (trx) => {
  await trx.deleteFrom("transaction")
    .where("debt_id", "=", id)
    .where("type", "=", "expense")
    .where("monthly_budget_id", "is", null)
    .execute();
  await trx.deleteFrom("debt").where("id", "=", id).execute();
});
```

**Acceptance:**
- Enable `BUG-1a/BUG-1b/BUG-1c` in `debt-bugs.test.ts`; all pass.
- **Delete the tripwire** `INT-SCHEMA-6b` in `tests/integration/debt.test.ts` (it asserts
  the old failing behaviour and will start failing once the bug is fixed).
- Re-point E2E `DELETE /api/debts/:id` to also cover a **lend** debt (currently uses a
  borrow debt to dodge the bug) — see the comment in `debts.spec.ts`.

---

### Task B — ~~Exclude debt transactions from the pace line (BUG-2)~~ — OBSOLETE (decision reversed)

> **Decision (2026-05-30):** debt cash transfers DO count toward the budget, to keep
> one simple model. The pace line already counts them, so it is left unchanged; instead
> the **dashboard** `budget_expense` was made consistent by dropping its `debt_id IS NULL`
> filter. The gating test `BUG-2a` was flipped to assert inclusion (a regression guard).
> The original (now superseded) plan follows for history.

**Goal:** `/api/pace-line` `actual_line` reflects only budget-relevant spending; debt
cash transfers are excluded (D-25), matching the dashboard's `budget_expense`.

**Root cause:** `src/app/api/pace-line/route.ts` sums `type = 'expense'` over the period
with no `debt_id IS NULL` filter.

**Implementation:** add `.where("debt_id", "is", null)` to the `expenses` query (the
grouped daily-sum query, ~lines 45–56).

**Acceptance:** enable `BUG-2a` in `debt-bugs.test.ts`; it asserts that a debt expense in
the period does not appear in `actual_line`, while a normal expense does.

---

### Task C — Build the "link existing transaction" sheet (GAP-1)

**Goal:** from the debt detail page, a user can link an existing eligible transaction as
a repayment (DEBT-08, DEBT-11), per SRS §6 Flow 4 and §7.10 `LinkTransactionSheet`.

**Root cause:** `src/app/(app)/debts/[id]/page.tsx` renders
`onClick={() => {/* TODO: LinkTransactionSheet */}}` — a no-op.

**Implementation:**
1. Create `src/components/organisms/LinkTransactionSheet/` (`.tsx`, `.stories.tsx`,
   `index.ts`) per CDD. Props: `debt`, `onClose`, `onLinked`. It fetches eligible
   transactions (`debt_id IS NULL`, type = `repaymentTxType(debt.type)`) and on select
   calls `PATCH /api/transactions/[id]/link { debt_id }`.
   - Eligible-transaction source: `GET /api/transactions?month=...&type=<repayment type>`
     filtered client-side to `debt_id == null`. (Optionally add a `?debt_eligible_for=`
     server filter later; not required for this task.)
2. Wire it into the detail page in place of the TODO; refresh the debt on `onLinked`.

**Acceptance:** enable `GAP-1` in `debts.spec.ts` (`test.fixme` → `test`); the flow opens
the sheet, links a transaction, and the row appears in "Lịch sử" with the remaining
balance updated. Add the Storybook story (required by repo rules).

---

### Task D — ~~Exclude debt from the statistics forecast (BUG-3)~~ — OBSOLETE (decision reversed)

> **Decision (2026-05-30):** per the same one-simple-model decision as Task B, the
> forecast keeps counting all expenses (debt included). No code change. Original plan
> below for history.

**Goal:** the forecast insight's daily-expense series excludes debt expenses, consistent
with the budget pace (D-25).

**Root cause:** `src/lib/statistics.ts` (~line 333) sums `type = 'expense'` with no
`debt_id` filter for the `forecastInsight` series.

**Implementation:** add `.where("debt_id", "is", null)` to that grouped query.

**Acceptance:** enable `BUG-3a` in `debt-bugs.test.ts` (asserts the generated report's
forecast does not count a debt expense). If asserting AI output proves flaky, instead
assert at the data-layer helper that feeds the forecast (refactor a small pure
`dailyBudgetExpenses` query helper and unit-test it).

---

### Task E — Decide settle-flow navigation (DEC-1)

**Goal:** resolve whether one-tap settle should return to the Nợ tab (SRS Flow 3 wording)
or stay on the detail page in its settled state (current behaviour).

**Action:** confirm with product owner.
- If "return to overview": after settle in `src/app/(app)/debts/[id]/page.tsx`
  `handleSettle`, `router.push("/debts")` instead of in-place reload. Then update
  `E2E-SETTLE-2` to assert `toHaveURL("/debts")` + debt in the settled section.
- If "stay in place" (current): no code change; `E2E-SETTLE-2` already matches.

This is the only open product decision; everything else is a defect with a defined fix.

---

## 3. Definition of done (whole plan)

- [ ] All gating tests in `debt-bugs.test.ts` enabled and green.
- [ ] `GAP-1` E2E enabled and green; `LinkTransactionSheet` has a Storybook story.
- [ ] Tripwire `INT-SCHEMA-6b` removed; lend-debt delete covered by the new test.
- [ ] `npm run test:unit` and `npm run test:integration` (after `build:cf`) pass.
- [ ] `npm run test:e2e` passes against `dev:cf`.
- [ ] SRS `debt-tracking.md` D-18 reconciled with the chosen delete behaviour; the
      coverage matrix in `debt-tracking-tests.md` updated (move the affected rows from
      "known defect" to covered).
