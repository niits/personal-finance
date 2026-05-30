/**
 * Integration tests for the dedicated link/unlink endpoints (SRS §8.6–8.7):
 *   PATCH  /api/transactions/[id]/link   body { debt_id }
 *   DELETE /api/transactions/[id]/link
 *
 * The equivalent `link_debt_id` field on PATCH /api/transactions/[id] is covered
 * separately in transactions-debt-link.test.ts.
 *
 * Cases trace to docs/specs/debt-tracking-tests.md §4.7 (INT-LINK-* / INT-UNLINK-*).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
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

async function createDebt(type: "lend" | "borrow", party: string, amount: number) {
  const res = await SELF.fetch("http://localhost/api/debts", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ type, party, amount, date: "2026-05-01" }),
  });
  const { debt } = (await res.json()) as { debt: { id: string; transactions: { id: number }[] } };
  return debt;
}

/** Standalone (no debt) transaction. */
async function createTx(type: "expense" | "income", amount: number) {
  const body: Record<string, unknown> = { amount, type, date: "2026-05-10", category_id: categoryId };
  const res = await SELF.fetch("http://localhost/api/transactions", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify(body),
  });
  const { transaction } = (await res.json()) as { transaction: { id: number } };
  return transaction.id;
}

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser();
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Ăn uống", null, 1);
  await seedMonthlyBudget(userId, "2026-05", 5_000_000);
});

// ─── auth ───────────────────────────────────────────────────────────────────

describe("link route auth (INT-LINK-AUTH)", () => {
  it("PATCH 401 without session", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions/1/link", {
      method: "PATCH",
      body: JSON.stringify({ debt_id: "x" }),
    });
    expect(res.status).toBe(401);
  });
  it("DELETE 401 without session", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions/1/link", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});

// ─── PATCH link ─────────────────────────────────────────────────────────────

describe("PATCH /api/transactions/[id]/link (INT-LINK)", () => {
  it("INT-LINK-1: links a standalone income tx to an open lend debt", async () => {
    const debt = await createDebt("lend", "Minh", 1000000);
    const txId = await createTx("income", 200000);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}/link`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ debt_id: debt.id }),
    });
    expect(res.status).toBe(200);

    const get = await SELF.fetch(`http://localhost/api/debts/${debt.id}`, { headers: authHeaders(cookie) });
    const { debt: d } = (await get.json()) as { debt: { transactions: { id: number }[] } };
    expect(d.transactions.some((t) => t.id === txId)).toBe(true);
  });

  it("INT-LINK-2: wrong transaction type → 409 wrong_type (D-16)", async () => {
    const debt = await createDebt("lend", "WrongType", 500000);
    const txId = await createTx("expense", 100000); // lend repayment must be income

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}/link`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ debt_id: debt.id }),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("wrong_type");
  });

  it("INT-LINK-3: already-linked tx → 409 already_linked (D-15)", async () => {
    const debt1 = await createDebt("lend", "D1", 300000);
    const debt2 = await createDebt("lend", "D2", 300000);
    const openingTxId = debt1.transactions[0].id;

    const res = await SELF.fetch(`http://localhost/api/transactions/${openingTxId}/link`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ debt_id: debt2.id }),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("already_linked");
  });

  it("INT-LINK-4: linking to a settled debt → 409 debt_settled (D-17)", async () => {
    const debt = await createDebt("lend", "Settled", 500000);
    await SELF.fetch(`http://localhost/api/debts/${debt.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ status: "settled" }),
    });
    const txId = await createTx("income", 100000);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}/link`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ debt_id: debt.id }),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("debt_settled");
  });

  it("INT-LINK-OWN: another user's debt → 404", async () => {
    const otherId = await seedUser({ id: "user-link-other", email: "linkother@example.com" });
    const otherCookie = await createTestSession(otherId);
    const otherDebt = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: authHeaders(otherCookie),
      body: JSON.stringify({ type: "lend", party: "X", amount: 100000, date: "2026-05-01" }),
    });
    const { debt } = (await otherDebt.json()) as { debt: { id: string } };
    const txId = await createTx("income", 100000);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}/link`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ debt_id: debt.id }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE unlink ──────────────────────────────────────────────────────────

describe("DELETE /api/transactions/[id]/link (INT-UNLINK)", () => {
  it("INT-UNLINK-1: unlinks a repayment and restores remaining (D-10)", async () => {
    const debt = await createDebt("lend", "UnlinkRepay", 1000000);
    const rep = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 300000, type: "income", date: "2026-05-12", debt_id: debt.id }),
    });
    const { transaction } = (await rep.json()) as { transaction: { id: number } };

    const res = await SELF.fetch(`http://localhost/api/transactions/${transaction.id}/link`, {
      method: "DELETE",
      headers: authHeaders(cookie),
    });
    expect(res.status).toBe(200);

    const get = await SELF.fetch(`http://localhost/api/debts/${debt.id}`, { headers: authHeaders(cookie) });
    const { debt: d } = (await get.json()) as { debt: { remaining: number } };
    expect(d.remaining).toBe(1000000);
  });

  it("INT-UNLINK-2: unlinking the opening tx with repayments → 409 opening_has_repayments (D-07)", async () => {
    const debt = await createDebt("lend", "Guard", 500000);
    await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 100000, type: "income", date: "2026-05-12", debt_id: debt.id }),
    });

    const res = await SELF.fetch(`http://localhost/api/transactions/${debt.transactions[0].id}/link`, {
      method: "DELETE",
      headers: authHeaders(cookie),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("opening_has_repayments");
  });

  it("INT-UNLINK-3: unlinking an unbudgeted expense → 409 expense_requires_budget (D-11)", async () => {
    // A lend debt's opening tx is an unbudgeted expense; unlinking it (no
    // repayments) would leave an expense with no budget → blocked.
    const debt = await createDebt("lend", "ExpenseGuard", 400000);
    const res = await SELF.fetch(`http://localhost/api/transactions/${debt.transactions[0].id}/link`, {
      method: "DELETE",
      headers: authHeaders(cookie),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("expense_requires_budget");
  });

  it("INT-UNLINK-4: unlinking a tx with no debt_id → 409 not_linked", async () => {
    const txId = await createTx("income", 100000);
    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}/link`, {
      method: "DELETE",
      headers: authHeaders(cookie),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("not_linked");
  });
});
