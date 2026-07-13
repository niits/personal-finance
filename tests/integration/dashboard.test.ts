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
  userId = await seedUser({ id: "user-dashboard", email: "dashboard@example.com" });
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Di chuyển", null, 1);
  await seedMonthlyBudget(userId, "2026-05", 5_000_000);
});

type DashboardResponse = {
  monthly_budget: {
    amount: number;
    remaining: number;
    credit_card_expense: number;
    cash_remaining: number;
    credit_card_overuse: boolean;
  } | null;
};

describe("GET /api/dashboard — credit card fields", () => {
  it("reports credit_card_expense = 0 and no overuse with no transactions", async () => {
    const res = await SELF.fetch("http://localhost/api/dashboard?month=2026-05", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<DashboardResponse>();
    expect(body.monthly_budget?.credit_card_expense).toBe(0);
    expect(body.monthly_budget?.cash_remaining).toBe(body.monthly_budget?.remaining);
    expect(body.monthly_budget?.credit_card_overuse).toBe(false);
  });

  it("computes cash_remaining and flags overuse when credit-card spend exceeds 50% of expense", async () => {
    // Cash expense: 400_000. Credit-card expense: 700_000. Total expense: 1_100_000 → cc ratio ≈ 63.6%
    await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 400_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-05-10",
      }),
    });
    await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({
        amount: 700_000,
        type: "expense",
        category_id: categoryId,
        date: "2026-05-10",
        is_credit_card: true,
      }),
    });

    const res = await SELF.fetch("http://localhost/api/dashboard?month=2026-05", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<DashboardResponse>();
    const mb = body.monthly_budget!;
    expect(mb.credit_card_expense).toBe(700_000);
    expect(mb.remaining).toBe(5_000_000 - 1_100_000);
    expect(mb.cash_remaining).toBe(mb.remaining + 700_000);
    expect(mb.credit_card_overuse).toBe(true);
  });
});
