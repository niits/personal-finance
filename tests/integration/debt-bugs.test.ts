/**
 * Gating tests for outstanding debt-tracking defects (see
 * docs/specs/debt-tracking-fix-plan.md). These encode the DESIRED behaviour and
 * are intentionally DISABLED (`describe.skip`) so CI stays green until each fix
 * lands. The executing agent removes `.skip` for the relevant block, makes it
 * pass by fixing the production code — never by weakening the assertion.
 *
 *   BUG-1  Task A  DELETE /api/debts/[id] must succeed for every debt (D-18)
 *   BUG-2  Task B  /api/pace-line must exclude debt expenses (D-20/D-25)
 *   BUG-3  Task D  statistics forecast must exclude debt expenses (D-25)
 *
 * Route-level cases use SELF.fetch, so run `npm run build:cf` first (see the
 * infra note in the fix plan).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import {
  applyMigrations,
  seedUser,
  createTestSession,
  authHeaders,
  seedCategory,
  seedMonthlyBudget,
} from "./helpers";

let cookie: string;
let userId: string;
let categoryId: number;

async function createDebt(data: { type: "lend" | "borrow"; party: string; amount: number; date?: string }) {
  const res = await SELF.fetch("http://localhost/api/debts", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ date: "2026-04-15", ...data }),
  });
  return (await res.json()) as {
    debt: { id: string; transactions: { id: number; type: string; is_opening: boolean }[] };
  };
}

async function txExists(id: number): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT 1 AS x FROM "transaction" WHERE id = ?`).bind(id).first();
  return !!row;
}

async function txDebtId(id: number): Promise<string | null | undefined> {
  const row = await env.DB.prepare(`SELECT debt_id FROM "transaction" WHERE id = ?`)
    .bind(id)
    .first<{ debt_id: string | null }>();
  return row?.debt_id;
}

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser();
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Ăn uống", null, 1);
  await seedMonthlyBudget(userId, "2026-04", 3_000_000);
});

// ─── BUG-1 · Task A — debt deletion (D-18) ─────────────────────────────────────
// Desired behaviour assumes Option A from the fix plan: unbudgeted debt expenses
// are removed with the debt; all other linked transactions are detached and kept.
// If Option B (relax CHECK) is chosen instead, flip BUG-1a/BUG-1c to assert the
// expense survives with debt_id = null.

describe.skip("BUG-1 · DELETE /api/debts/[id] keeps the DB valid (D-18)", () => {
  async function del(id: string) {
    return SELF.fetch(`http://localhost/api/debts/${id}`, { method: "DELETE", headers: authHeaders(cookie) });
  }

  it("BUG-1a: deleting a lend debt returns 204 and removes its unbudgeted opening expense", async () => {
    const { debt } = await createDebt({ type: "lend", party: "DelLend", amount: 500_000 });
    const openingId = debt.transactions[0].id;
    expect(debt.transactions[0].type).toBe("expense");

    const res = await del(debt.id);
    expect(res.status).toBe(204); // currently 500 — CHECK violation

    const get = await SELF.fetch(`http://localhost/api/debts/${debt.id}`, { headers: authHeaders(cookie) });
    expect(get.status).toBe(404);
    expect(await txExists(openingId)).toBe(false); // unbudgeted expense removed
  });

  it("BUG-1b: deleting a borrow debt returns 204 and keeps its income opening (detached)", async () => {
    const { debt } = await createDebt({ type: "borrow", party: "DelBorrow", amount: 700_000 });
    const openingId = debt.transactions[0].id;
    expect(debt.transactions[0].type).toBe("income");

    const res = await del(debt.id);
    expect(res.status).toBe(204);

    expect(await txExists(openingId)).toBe(true); // income stays valid
    expect(await txDebtId(openingId)).toBeNull(); // detached
  });

  it("BUG-1c: deleting a lend debt with an income repayment keeps the repayment, drops the expense", async () => {
    const { debt } = await createDebt({ type: "lend", party: "DelMixed", amount: 1_000_000 });
    const openingExpenseId = debt.transactions[0].id;

    const rep = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 400_000, type: "income", date: "2026-04-16", debt_id: debt.id }),
    });
    const { transaction } = (await rep.json()) as { transaction: { id: number } };

    const res = await del(debt.id);
    expect(res.status).toBe(204);

    expect(await txExists(openingExpenseId)).toBe(false); // unbudgeted expense removed
    expect(await txExists(transaction.id)).toBe(true); // income repayment kept
    expect(await txDebtId(transaction.id)).toBeNull(); // detached
  });
});

// ─── BUG-2 · Task B — pace line excludes debt expenses (D-25) ───────────────────

describe.skip("BUG-2 · GET /api/pace-line excludes debt expenses (D-25)", () => {
  it("BUG-2a: a debt expense in the period is not counted in actual_line", async () => {
    // Normal budgeted expense (counts) + a lend debt opening expense (must NOT count),
    // both inside the 2026-04 budget period.
    await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 500_000, type: "expense", category_id: categoryId, date: "2026-04-15" }),
    });
    await createDebt({ type: "lend", party: "PaceDebt", amount: 1_000_000, date: "2026-04-15" });

    const res = await SELF.fetch("http://localhost/api/pace-line?month=2026-04", { headers: authHeaders(cookie) });
    const body = (await res.json()) as { actual_line: { day: number; amount: number }[] };

    const peak = Math.max(...body.actual_line.map((p) => p.amount));
    expect(peak).toBe(500_000); // only the budgeted expense — currently 1_500_000
  });
});

// ─── BUG-3 · Task D — statistics forecast excludes debt expenses (D-25) ─────────
// The forecast series is consumed by AI insight generation, which is
// non-deterministic. Per the fix plan, Task D should extract a pure
// `dailyBudgetExpenses` helper (expense AND debt_id IS NULL) and unit-test it
// directly. Enable + retarget this once that helper exists.

describe.skip("BUG-3 · statistics forecast excludes debt expenses (D-25)", () => {
  it.todo(
    "BUG-3a: dailyBudgetExpenses(period) counts only budgeted expenses, not debt transfers",
  );
});
