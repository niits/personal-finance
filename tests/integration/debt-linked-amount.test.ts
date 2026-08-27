import { beforeAll, describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedMonthlyBudget, seedUser } from "./helpers";

let cookie: string; let userId: string; let categoryId: number; let groupId: string;
beforeAll(async () => {
  await applyMigrations(); userId = await seedUser(); cookie = await createTestSession(userId); await seedMonthlyBudget(userId, "2026-05", 1_000_000);
  categoryId = (await env.DB.prepare("INSERT INTO category (user_id,name,level,sort_order,type,budget_behavior) VALUES (?, 'Ăn uống', 1, 0, 'expense', 'consumption') RETURNING id").bind(userId).first<{ id: number }>())!.id;
  const group = await SELF.fetch("http://localhost/api/credit-card-groups", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ name: "Thẻ chính", statement_close_day: 15 }) });
  const { group: createdGroup } = await group.json() as { group: { id: string } };
  groupId = createdGroup.id;
});

describe("card purchase, budget, and statement payment", () => {
  it("counts a card purchase once in consumption and the unpaid subset", async () => {
    const purchase = await SELF.fetch("http://localhost/api/transactions", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ amount: 250_000, type: "expense", category_id: categoryId, credit_card_group_id: groupId, date: "2026-05-10", note: "Siêu thị" }) });
    expect(purchase.status).toBe(201);
    const dashboard = await SELF.fetch("http://localhost/api/dashboard?month=2026-05", { headers: authHeaders(cookie) });
    const summary = await dashboard.json() as { total_expense: number; unpaid_card_spend: number };
    expect(summary.total_expense).toBe(250_000);
    expect(summary.unpaid_card_spend).toBe(250_000);
    const groups = await SELF.fetch("http://localhost/api/credit-card-groups", { headers: authHeaders(cookie) });
    const body = await groups.json() as { groups: { statements: { id: string; status: "unpaid" | "paid"; amount: number; purchases: unknown[] }[] }[] };
    const statementId = body.groups[0].statements[0].id;
    expect(statementId).toEqual(expect.any(String));
    expect(body.groups[0].statements[0].status).toBe("unpaid");
    expect(body.groups[0].statements[0].amount).toBe(250_000);
    expect(body.groups[0].statements[0].purchases).toHaveLength(1);
    const payment = await SELF.fetch(`http://localhost/api/credit-card-statements/${statementId}/pay`, { method: "PATCH", headers: authHeaders(cookie), body: JSON.stringify({ paid_at: "2026-05-16" }) });
    expect(payment.status, await payment.clone().text()).toBe(200);
    const paidDashboard = await SELF.fetch("http://localhost/api/dashboard?month=2026-05", { headers: authHeaders(cookie) });
    const paidSummary = await paidDashboard.json() as { total_expense: number; unpaid_card_spend: number };
    expect(paidSummary.total_expense).toBe(250_000);
    expect(paidSummary.unpaid_card_spend).toBe(0);
    const deletedGroup = await SELF.fetch(`http://localhost/api/credit-card-groups/${groupId}`, {
      method: "DELETE", headers: authHeaders(cookie),
    });
    expect(deletedGroup.status).toBe(400);
  });
});
