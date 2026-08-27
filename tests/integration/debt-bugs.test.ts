import { beforeAll, describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedMonthlyBudget, seedUser } from "./helpers";

let cookie: string; let userId: string; let categoryId: number; let accountId: string;
beforeAll(async () => {
  await applyMigrations(); userId = await seedUser(); cookie = await createTestSession(userId); await seedMonthlyBudget(userId, "2026-05", 1_000_000);
  categoryId = (await env.DB.prepare("INSERT INTO category (user_id,name,level,sort_order,type,system_kind,budget_behavior) VALUES (?, 'Gửi tiết kiệm', 1, 0, 'expense', 'savings_deposit', 'non_budget') RETURNING id").bind(userId).first<{ id: number }>())!.id;
  const account = await SELF.fetch("http://localhost/api/finance-accounts", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ type: "savings", name: "Sổ" }) }); accountId = (await account.json() as { account: { id: string } }).account.id;
});

describe("dashboard excludes non-budget transfers", () => {
  it("does not count a savings deposit as consumption spending", async () => {
    await SELF.fetch("http://localhost/api/transactions", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ amount: 300_000, type: "expense", category_id: categoryId, finance_account_id: accountId, date: "2026-05-10" }) });
    const dashboard = await SELF.fetch("http://localhost/api/dashboard?month=2026-05", { headers: authHeaders(cookie) });
    expect((await dashboard.json() as { total_expense: number }).total_expense).toBe(0);
  });
});
