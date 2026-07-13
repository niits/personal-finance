import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import {
  applyMigrations,
  seedUser,
  createTestSession,
  seedCategory,
  seedMonthlyBudget,
  authHeaders,
} from "./helpers";

let cookie: string;
let userId: string;
let categoryId: number;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser({ id: "user-cb", email: "cb@example.com" });
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Mua sắm", null, 1);
  await seedMonthlyBudget(userId, "2026-05", 5_000_000);
});

describe("POST /api/custom-budgets", () => {
  it("creates a custom budget with is_active = 1", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Trip Đà Lạt", amount: 3_000_000 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ custom_budget: { is_active: number; spent: number } }>();
    expect(body.custom_budget.is_active).toBe(1);
    expect(body.custom_budget.spent).toBe(0);
  });

  it("returns 400 for amount = 0", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Bad budget", amount: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty name", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "", amount: 1_000_000 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/custom-budgets/:id — toggle active", () => {
  it("toggles budget to inactive", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Toggleable", amount: 2_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    const patchRes = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ is_active: 0 }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json<{ custom_budget: { is_active: number } }>();
    expect(body.custom_budget.is_active).toBe(0);
  });

  it("updates name and amount", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Original", amount: 1_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    const patchRes = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Updated", amount: 2_000_000 }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json<{ custom_budget: { name: string; amount: number } }>();
    expect(body.custom_budget.name).toBe("Updated");
    expect(body.custom_budget.amount).toBe(2_000_000);
  });
});

describe("DELETE /api/custom-budgets/:id", () => {
  it("deletes the custom budget", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "To delete", amount: 500_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    const deleteRes = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(deleteRes.status).toBe(200);
  });

  it("returns 404 for non-existent budget", async () => {
    const res = await SELF.fetch("http://localhost/api/custom-budgets/99999", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 and keeps the budget when a transaction is linked, then deletes after unlinking", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Linked budget", amount: 1_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    const txnRes = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 100_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-05-15",
        custom_budget_ids: [custom_budget.id],
      }),
    });
    const { transaction } = await txnRes.json<{ transaction: { id: number } }>();

    const blockedDelete = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(blockedDelete.status).toBe(400);

    const stillThere = await SELF.fetch("http://localhost/api/custom-budgets", {
      headers: { Cookie: cookie },
    });
    const { custom_budgets } = await stillThere.json<{ custom_budgets: { id: number }[] }>();
    expect(custom_budgets.some((b) => b.id === custom_budget.id)).toBe(true);

    // Unlink by removing the transaction's custom_budget_ids
    await SELF.fetch(`http://localhost/api/transactions/${transaction.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ custom_budget_ids: [] }),
    });

    const allowedDelete = await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(allowedDelete.status).toBe(200);
  });
});

describe("GET /api/custom-budgets", () => {
  it("returns list with spent = 0 for new budgets", async () => {
    await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "New budget", amount: 4_000_000 }),
    });

    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ custom_budgets: { spent: number }[] }>();
    expect(Array.isArray(body.custom_budgets)).toBe(true);
  });

  it("reports credit_card_spent and has_linked_transactions for a budget with a credit-card transaction", async () => {
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "CC budget", amount: 2_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();

    await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 300_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-05-16",
        custom_budget_ids: [custom_budget.id],
        is_credit_card: true,
      }),
    });

    const res = await SELF.fetch("http://localhost/api/custom-budgets", {
      headers: { Cookie: cookie },
    });
    const body = await res.json<{
      custom_budgets: { id: number; spent: number; credit_card_spent: number; has_linked_transactions: boolean }[];
    }>();
    const found = body.custom_budgets.find((b) => b.id === custom_budget.id);
    expect(found).toBeDefined();
    expect(found!.spent).toBe(300_000);
    expect(found!.credit_card_spent).toBe(300_000);
    expect(found!.has_linked_transactions).toBe(true);
  });

  it("active_only=true filters inactive budgets", async () => {
    // Create and immediately deactivate one
    const createRes = await SELF.fetch("http://localhost/api/custom-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Inactive budget", amount: 1_000_000 }),
    });
    const { custom_budget } = await createRes.json<{ custom_budget: { id: number } }>();
    await SELF.fetch(`http://localhost/api/custom-budgets/${custom_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ is_active: 0 }),
    });

    const res = await SELF.fetch("http://localhost/api/custom-budgets?active_only=true", {
      headers: { Cookie: cookie },
    });
    const body = await res.json<{ custom_budgets: { is_active: number }[] }>();
    expect(body.custom_budgets.every((b: { is_active: number }) => b.is_active === 1)).toBe(true);
  });
});
