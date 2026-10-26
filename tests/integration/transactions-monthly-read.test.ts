import { beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/transactions/route";
import {
  applyMigrations,
  createTestSession,
  seedCategory,
  seedCustomBudget,
  seedMonthlyBudget,
  seedUser,
} from "./helpers";

// Exercise the route, authentication, and D1 without the compiled Next.js router.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env }),
}));

type MonthlyResponse = {
  transactions: {
    id: number;
    type: string;
    category: { id: number };
    custom_budgets: { id: number; name: string }[];
  }[];
  summary: { total_expense: number; total_income: number; savings: number };
};

beforeAll(applyMigrations);

describe("GET /api/transactions full-month reads", () => {
  it("rejects requests without a session", async () => {
    const response = await GET(new NextRequest("http://localhost/api/transactions?month=2026-05"));
    expect(response.status).toBe(401);
  });

  it("returns an empty month with zero totals", async () => {
    const cookie = await createTestSession(await seedUser());
    const response = await GET(new NextRequest("http://localhost/api/transactions?month=2026-05", {
      headers: { Cookie: cookie },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      transactions: [],
      summary: { total_expense: 0, total_income: 0, savings: 0 },
    });
  });

  it.each([
    { count: 100, storedPeriod: false },
    { count: 101, storedPeriod: false },
    { count: 250, storedPeriod: true },
  ])("returns $count transactions with storedPeriod=$storedPeriod", async ({ count, storedPeriod }) => {
    const userId = await seedUser();
    const cookie = await createTestSession(userId);
    const categoryId = await seedCategory(userId, "Chi tiêu");
    const incomeCategoryId = await seedCategory(userId, "Thu nhập", null, 1, "income");
    const budget = await seedMonthlyBudget(userId, "2026-05", 5_000_000);
    if (storedPeriod) {
      await env.DB.prepare("UPDATE monthly_budget SET start_date = ?, end_date = ? WHERE id = ?")
        .bind("2026-05-04", "2026-05-25", budget.id).run();
    }
    const firstBudgetId = await seedCustomBudget(userId, "Ngân sách thứ nhất", 1_000_000);
    const secondBudgetId = await seedCustomBudget(userId, "Ngân sách thứ hai", 2_000_000);

    // Separate statements keep fixture creation within the production D1 limit.
    const inserted = await env.DB.batch<{ id: number }>(Array.from({ length: count }, (_, index) =>
      env.DB.prepare(
        'INSERT INTO "transaction" (user_id, amount, type, category_id, date, monthly_budget_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      ).bind(userId, 10_000, index === count - 1 ? "income" : "expense",
        index === count - 1 ? incomeCategoryId : categoryId, "2026-05-10",
        index === count - 1 ? null : budget.id),
    ));
    const ids = inserted.map((result) => result.results[0].id);
    const linkedIds = ids.filter((_, index) => index % 3 !== 0 && index < count - 1);
    await env.DB.batch(linkedIds.flatMap((id) => [firstBudgetId, secondBudgetId].map((customBudgetId) =>
      env.DB.prepare("INSERT INTO transaction_custom_budget (transaction_id, custom_budget_id) VALUES (?, ?)")
        .bind(id, customBudgetId),
    )));

    const otherUserId = await seedUser({ id: "other-user", email: "other@example.com" });
    const otherCategoryId = await seedCategory(otherUserId, "Danh mục riêng");
    const otherBudget = await seedMonthlyBudget(otherUserId, "2026-05", 1_000_000);
    const otherCustomBudgetId = await seedCustomBudget(otherUserId, "Ngân sách riêng", 1_000_000);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO "transaction" (user_id, amount, type, category_id, date, monthly_budget_id) VALUES (?, 999999, ?, ?, ?, ?)')
        .bind(otherUserId, "expense", otherCategoryId, "2026-05-10", otherBudget.id),
      // Invalid legacy associations must not expose another user's budget.
      env.DB.prepare("INSERT INTO transaction_custom_budget (transaction_id, custom_budget_id) VALUES (?, ?)")
        .bind(ids[0], otherCustomBudgetId),
      ...[storedPeriod ? "2026-05-03" : "2026-04-01", storedPeriod ? "2026-05-26" : "2026-06-15"].map((date) =>
        env.DB.prepare('INSERT INTO "transaction" (user_id, amount, type, category_id, date, monthly_budget_id) VALUES (?, 999999, ?, ?, ?, ?)')
          .bind(userId, "expense", categoryId, date, budget.id),
      ),
    ]);

    const url = "http://localhost/api/transactions?month=2026-05";
    const response = await GET(new NextRequest(url, { headers: { Cookie: cookie } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
    const body = await response.json() as MonthlyResponse;
    expect(body.transactions.map((transaction) => transaction.id)).toEqual([...ids].reverse());
    expect(body.summary).toEqual({
      total_expense: (count - 1) * 10_000,
      total_income: 10_000,
      savings: (2 - count) * 10_000,
    });
    for (const transaction of body.transactions) {
      expect(transaction.custom_budgets.map((customBudget) => customBudget.id).sort((a, b) => a - b))
        .toEqual(linkedIds.includes(transaction.id) ? [firstBudgetId, secondBudgetId] : []);
    }

    const filteredResponse = await GET(new NextRequest(`${url}&type=expense&category_id=${categoryId}&custom_budget_id=${firstBudgetId}`, {
      headers: { Cookie: cookie },
    }));
    expect(filteredResponse.status).toBe(200);
    const filtered = await filteredResponse.json() as MonthlyResponse;
    expect(filtered.transactions.map((transaction) => transaction.id)).toEqual([...linkedIds].reverse());
    expect(filtered.summary).toEqual(body.summary);
    for (const transaction of filtered.transactions) {
      expect(transaction.custom_budgets).toHaveLength(2);
    }

    const revalidated = await GET(new NextRequest(url, {
      headers: { Cookie: cookie, "If-None-Match": response.headers.get("etag")! },
    }));
    expect(revalidated.status).toBe(304);
    expect(await revalidated.text()).toBe("");
  });
});
