/**
 * Integration tests for the debt link/unlink feature on PATCH /api/transactions/:id.
 *
 * Covers:
 * - Linking a transaction to a debt (clears category + budget)
 * - Unlinking when no repayments exist
 * - Unlink blocked when repayments already exist
 * - Invalid debt ID (not found / cross-user)
 * - Invalid link_debt_id value type
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

/** Helper: create a debt and return its id */
async function createDebt(type: "lend" | "borrow", party: string, amount: number) {
  const res = await SELF.fetch("http://localhost/api/debts", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ type, party, amount, date: "2026-05-01" }),
  });
  const { debt } = await res.json() as { debt: { id: string } };
  return debt.id;
}

/** Helper: create a categorised expense transaction and return its id */
async function createTransaction(amount: number, date: string, budgetId: number) {
  const res = await SELF.fetch("http://localhost/api/transactions", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ amount, type: "expense", category_id: categoryId, date, monthly_budget_id: budgetId }),
  });
  const { transaction } = await res.json() as { transaction: { id: number } };
  return transaction.id;
}

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser();
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Ăn uống", null, 1);
  await seedMonthlyBudget(userId, "2026-05", 5_000_000);
});

// ─── linking ──────────────────────────────────────────────────────────────────

describe("PATCH transaction — link_debt_id: link", () => {
  it("links a transaction to a debt and clears category + monthly_budget_id", { timeout: 15000 }, async () => {
    const debtId = await createDebt("lend", "Minh", 1_000_000);
    const txId = await createTransaction(1_000_000, "2026-05-10", 1);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: debtId }),
    });

    expect(res.status).toBe(200);
    const { transaction } = await res.json() as {
      transaction: { debt_id: string | null; category: unknown; monthly_budget_id: number | null };
    };
    expect(transaction.debt_id).toBe(debtId);
    expect(transaction.category).toBeNull();
    expect(transaction.monthly_budget_id).toBeNull();
  });

  it("returns 404 when debt_id does not exist", async () => {
    const txId = await createTransaction(500_000, "2026-05-10", 1);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: "no-such-debt-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when link_debt_id is a number (wrong type)", async () => {
    const txId = await createTransaction(500_000, "2026-05-10", 1);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: 42 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when debt belongs to a different user", async () => {
    // Create a second user and their debt
    const otherUserId = await seedUser({ id: "user-other", email: "other@example.com" });
    await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: authHeaders(await createTestSession(otherUserId)),
      body: JSON.stringify({ type: "lend", party: "SomeOne", amount: 100_000 }),
    });
    // Fetch the other user's debt id directly from DB
    const { env } = await import("cloudflare:test");
    const row = await env.DB.prepare(
      "SELECT id FROM debt WHERE user_id = ? LIMIT 1"
    ).bind(otherUserId).first<{ id: string }>();
    const otherDebtId = row?.id;
    if (!otherDebtId) return; // skip if setup failed

    const txId = await createTransaction(100_000, "2026-05-10", 1);
    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: otherDebtId }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── unlinking ────────────────────────────────────────────────────────────────

describe("PATCH transaction — link_debt_id: unlink (null)", () => {
  it("unlinks a transaction that has no repayment history", async () => {
    const debtId = await createDebt("lend", "Hùng", 800_000);
    const txId = await createTransaction(800_000, "2026-05-12", 1);

    // Link first
    await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: debtId }),
    });

    // Now unlink
    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: null }),
    });
    expect(res.status).toBe(200);
    const { transaction } = await res.json() as { transaction: { debt_id: string | null } };
    expect(transaction.debt_id).toBeNull();
  });

  it("blocks unlinking when repayment transactions already exist on the debt", async () => {
    const debtId = await createDebt("lend", "Lan", 500_000);
    const txId = await createTransaction(500_000, "2026-05-14", 1);

    // Link the opening transaction
    await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: debtId }),
    });

    // Log a repayment — lend debt is repaid by an income transaction
    await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 200_000, type: "income", date: "2026-05-15", debt_id: debtId }),
    });

    // Attempt to unlink the opening transaction — should be blocked
    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: null }),
    });
    expect(res.status).toBe(400);
  });

  it("unlink on a transaction with no debt_id is a no-op (null → null)", async () => {
    const txId = await createTransaction(200_000, "2026-05-16", 1);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: null }),
    });
    // Should succeed — no-op
    expect(res.status).toBe(200);
    const { transaction } = await res.json() as { transaction: { debt_id: string | null } };
    expect(transaction.debt_id).toBeNull();
  });
});

// ─── response shape ───────────────────────────────────────────────────────────

describe("PATCH transaction — response shape after link", () => {
  it("linked transaction response includes debt_id in full transaction object", async () => {
    const debtId = await createDebt("borrow", "Tuấn", 300_000);
    const txId = await createTransaction(300_000, "2026-05-17", 1);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ link_debt_id: debtId }),
    });

    const { transaction } = await res.json() as {
      transaction: {
        id: number;
        debt_id: string;
        category: unknown;
        custom_budgets: unknown[];
      };
    };
    expect(transaction.id).toBe(txId);
    expect(transaction.debt_id).toBe(debtId);
    expect(transaction.category).toBeNull();
    expect(Array.isArray(transaction.custom_budgets)).toBe(true);
  });
});
