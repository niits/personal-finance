import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import {
  applyMigrations,
  seedUser,
  createTestSession,
  seedCategory,
  seedMonthlyBudget,
  seedCustomBudget,
  authHeaders,
} from "./helpers";

let cookie: string;
let userId: string;
let categoryId: number;
let budgetId: number;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser();
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Ăn ngoài", null, 1);
  const budget = await seedMonthlyBudget(userId, "2026-05", 5_000_000);
  budgetId = budget.id;
});

describe("GET /api/transactions", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions");
    expect(res.status).toBe(401);
  });

  it("returns empty list for new user", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions?month=2026-05", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ transactions: unknown[] }>();
    expect(body.transactions).toEqual([]);
  });
});

describe("POST /api/transactions", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 50000, type: "expense", category_id: categoryId, date: "2026-05-10" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates expense and links to monthly budget", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 50_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-05-10",
        note: "Phở bò",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ transaction: Record<string, unknown> }>();
    expect(body.transaction.amount).toBe(50_000);
    expect(body.transaction.monthly_budget_id).toBe(budgetId);
    expect(body.transaction.type).toBe("expense");
  });

  it("creates income without monthly_budget_id", async () => {
    const incomeCategory = await seedCategory(userId, "Lương", null, 1);
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 20_000_000,
        type: "income",
        category_id: incomeCategory,
        date: "2026-05-01",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ transaction: Record<string, unknown> }>();
    expect(body.transaction.monthly_budget_id).toBeNull();
  });

  it("returns 400 when monthly budget does not exist for date", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 100_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-06-01",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ code: string }>();
    expect(body.code).toBe("MONTHLY_BUDGET_MISSING");
  });

  it("returns 400 for amount = 0", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 0, type: "expense", category_id: categoryId, date: "2026-05-10" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative amount", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: -500, type: "expense", category_id: categoryId, date: "2026-05-10" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when assigning income to custom budget", async () => {
    const cbId = await seedCustomBudget(userId, "Trip", 1_000_000);
    const incomeCategory = await seedCategory(userId, "Thu nhập khác", null, 1);
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 500_000,
        type: "income",
        category_id: incomeCategory,
        date: "2026-05-01",
        custom_budget_ids: [cbId],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("links expense to custom budget", async () => {
    const cbId = await seedCustomBudget(userId, "Trip Đà Lạt", 3_000_000);
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 150_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-05-15",
        custom_budget_ids: [cbId],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ transaction: { custom_budgets: { id: number }[] } }>();
    expect(body.transaction.custom_budgets).toHaveLength(1);
    expect(body.transaction.custom_budgets[0].id).toBe(cbId);
  });
});

describe("DELETE /api/transactions/:id", () => {
  it("deletes a transaction", async () => {
    const createRes = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 30_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-05-20",
      }),
    });
    const { transaction } = await createRes.json<{ transaction: { id: number } }>();

    const deleteRes = await SELF.fetch(`http://localhost/api/transactions/${transaction.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(deleteRes.status).toBe(200);
  });

  it("returns 404 for non-existent transaction", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions/99999", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});
