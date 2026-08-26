import { beforeAll, describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedMonthlyBudget, seedUser } from "./helpers";

let cookie: string; let userId: string; let consumptionId: number; let savingsId: number;
beforeAll(async () => {
  await applyMigrations(); userId = await seedUser(); cookie = await createTestSession(userId); await seedMonthlyBudget(userId, "2026-05", 1_000_000);
  consumptionId = (await env.DB.prepare("INSERT INTO category (user_id,name,level,sort_order,type,budget_behavior) VALUES (?, 'Ăn uống', 1, 0, 'expense', 'consumption') RETURNING id").bind(userId).first<{ id: number }>())!.id;
  savingsId = (await env.DB.prepare("INSERT INTO category (user_id,name,level,sort_order,type,system_kind,budget_behavior) VALUES (?, 'Gửi tiết kiệm', 1, 1, 'expense', 'savings_deposit', 'non_budget') RETURNING id").bind(userId).first<{ id: number }>())!.id;
});

describe("finance account transaction rules", () => {
  it("records a savings deposit without requiring a monthly budget link", async () => {
    const account = await SELF.fetch("http://localhost/api/finance-accounts", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ type: "savings", name: "Sổ tiết kiệm" }) });
    const { account: created } = await account.json() as { account: { id: string } };
    const response = await SELF.fetch("http://localhost/api/transactions", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ amount: 200_000, type: "expense", category_id: savingsId, finance_account_id: created.id, date: "2026-05-10" }) });
    expect(response.status).toBe(201);
    expect((await response.json() as { transaction: { monthly_budget_id: number | null } }).transaction.monthly_budget_id).toBeNull();
  });

  it("rejects a system category without its required account", async () => {
    const response = await SELF.fetch("http://localhost/api/transactions", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ amount: 200_000, type: "expense", category_id: savingsId, date: "2026-05-10" }) });
    expect(response.status).toBe(400);
  });
});
