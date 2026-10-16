import { beforeAll, describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedUser } from "./helpers";

let cookie: string;
let userId: string;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser({ id: "user-finance-accounts", email: "finance-accounts@example.com" });
  cookie = await createTestSession(userId);
});

describe("finance accounts", () => {
  it("creates and updates an account name and note", async () => {
    const created = await SELF.fetch("http://localhost/api/finance-accounts", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ type: "savings", name: "Emergency fund", note: "Initial note" }),
    });
    expect(created.status).toBe(201);
    const { account } = await created.json<{ account: { id: string } }>();

    const updated = await SELF.fetch(`http://localhost/api/finance-accounts/${account.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Rainy day fund", note: "Six months of expenses" }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      account: { name: "Rainy day fund", note: "Six months of expenses" },
    });
  });

  // Contract: Finance counterparts preserve the source and use non-budget categories.
  it("records a received repayment and derives the remaining loan balance", async () => {
    const seeded = await SELF.fetch("http://localhost/api/categories/seed", {
      method: "POST", headers: authHeaders(cookie),
    });
    expect(seeded.status).toBe(200);
    const categories = await env.DB.prepare(
      "SELECT id, system_kind FROM category WHERE user_id = ? AND system_kind IN ('lend', 'debt_collection')",
    ).bind(userId).all<{ id: number; system_kind: string }>();
    const lend = categories.results.find((category) => category.system_kind === "lend")!;
    const collection = categories.results.find((category) => category.system_kind === "debt_collection")!;
    expect(collection).toBeDefined();
    const created = await SELF.fetch("http://localhost/api/finance-accounts", {
      method: "POST", headers: authHeaders(cookie),
      body: JSON.stringify({ type: "debt", name: "Loan repayment verification", debt_direction: "lend" }),
    });
    const { account } = await created.json<{ account: { id: string } }>();
    for (const movement of [
      { amount: 2000000, type: "expense", category_id: lend.id },
      { amount: 500000, type: "income", category_id: collection.id },
    ]) {
      const response = await SELF.fetch("http://localhost/api/transactions", {
        method: "POST", headers: authHeaders(cookie),
        body: JSON.stringify({ ...movement, finance_account_id: account.id, date: "2026-05-01" }),
      });
      expect(response.status).toBe(201);
    }
    const response = await SELF.fetch("http://localhost/api/finance-accounts", { headers: authHeaders(cookie) });
    const { accounts } = await response.json<{ accounts: { id: string; balance: number; transactions: unknown[] }[] }>();
    expect(accounts.find((item) => item.id === account.id)).toMatchObject({
      balance: -1500000, transactions: expect.any(Array),
    });
    expect(accounts.find((item) => item.id === account.id)?.transactions).toHaveLength(2);
    const rows = await env.DB.prepare(
      'SELECT monthly_budget_id FROM "transaction" WHERE user_id = ? AND finance_account_id = ?',
    ).bind(userId, account.id).all<{ monthly_budget_id: number | null }>();
    expect(rows.results.every((row) => row.monthly_budget_id === null)).toBe(true);
  });

  // Contract: transaction edits recompute both accounts and retain related movements.
  it("rejects edits and reassignment that overdraw related withdrawals", async () => {
    const seeded = await SELF.fetch("http://localhost/api/categories/seed", {
      method: "POST", headers: authHeaders(cookie),
    });
    expect(seeded.status).toBe(200);
    const categories = await env.DB.prepare(
      "SELECT id, system_kind FROM category WHERE user_id = ? AND system_kind IN ('savings_deposit', 'savings_withdrawal')",
    ).bind(userId).all<{ id: number; system_kind: string }>();
    const depositCategory = categories.results.find((category) => category.system_kind === "savings_deposit")!;
    const withdrawalCategory = categories.results.find((category) => category.system_kind === "savings_withdrawal")!;
    const accountIds: string[] = [];
    for (const name of ["Savings with withdrawals", "Destination savings"]) {
      const response = await SELF.fetch("http://localhost/api/finance-accounts", {
        method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ type: "savings", name }),
      });
      expect(response.status).toBe(201);
      const { account } = await response.json<{ account: { id: string } }>();
      accountIds.push(account.id);
    }
    const transactionIds: number[] = [];
    for (const movement of [
      { amount: 2000000, type: "expense", category_id: depositCategory.id },
      { amount: 500000, type: "income", category_id: withdrawalCategory.id },
    ]) {
      const response = await SELF.fetch("http://localhost/api/transactions", {
        method: "POST", headers: authHeaders(cookie),
        body: JSON.stringify({ ...movement, finance_account_id: accountIds[0], date: "2026-05-01" }),
      });
      expect(response.status).toBe(201);
      const { transaction } = await response.json<{ transaction: { id: number } }>();
      transactionIds.push(transaction.id);
    }
    async function readAccounts() {
      const response = await SELF.fetch("http://localhost/api/finance-accounts", { headers: authHeaders(cookie) });
      expect(response.status).toBe(200);
      return (await response.json<{ accounts: { id: string; balance: number; transactions: { id: number; amount: number }[] }[] }>()).accounts;
    }
    const withdrawalBefore = await env.DB.prepare('SELECT * FROM "transaction" WHERE id = ?').bind(transactionIds[1]).first();
    const edited = await SELF.fetch(`http://localhost/api/transactions/${transactionIds[0]}`, {
      method: "PATCH", headers: authHeaders(cookie), body: JSON.stringify({ amount: 300000 }),
    });
    expect(edited.status).toBe(422);
    expect(await edited.json()).toMatchObject({ code: "FINANCE_BALANCE_EXCEEDED" });
    expect((await readAccounts()).find((account) => account.id === accountIds[0])?.balance).toBe(-1500000);
    const moved = await SELF.fetch(`http://localhost/api/transactions/${transactionIds[0]}`, {
      method: "PATCH", headers: authHeaders(cookie), body: JSON.stringify({ finance_account_id: accountIds[1] }),
    });
    expect(moved.status).toBe(422);
    const accounts = await readAccounts();
    expect(accounts.find((account) => account.id === accountIds[0])?.balance).toBe(-1500000);
    expect(accounts.find((account) => account.id === accountIds[1])?.balance).toBe(0);
    expect(await env.DB.prepare('SELECT * FROM "transaction" WHERE id = ?').bind(transactionIds[1]).first()).toEqual(withdrawalBefore);
  });

  it("rejects an empty account name", async () => {
    const created = await SELF.fetch("http://localhost/api/finance-accounts", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ type: "savings", name: "Name validation" }),
    });
    const { account } = await created.json<{ account: { id: string } }>();

    const updated = await SELF.fetch(`http://localhost/api/finance-accounts/${account.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "   " }),
    });
    expect(updated.status).toBe(400);
  });

  it("does not delete an account linked to a transaction", async () => {
    const created = await SELF.fetch("http://localhost/api/finance-accounts", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ type: "savings", name: "Linked account" }),
    });
    const { account } = await created.json<{ account: { id: string } }>();

    await env.DB.prepare(
      "INSERT INTO \"transaction\" (user_id, amount, type, date, finance_account_id) VALUES (?, ?, ?, ?, ?)",
    ).bind(userId, 100_000, "expense", "2026-05-01", account.id).run();

    const deleted = await SELF.fetch(`http://localhost/api/finance-accounts/${account.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(deleted.status).toBe(400);
    expect(await deleted.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      error: expect.stringContaining("giao dịch"),
    });
  });

  it("deletes an unlinked account", async () => {
    const created = await SELF.fetch("http://localhost/api/finance-accounts", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ type: "savings", name: "Unlinked account" }),
    });
    const { account } = await created.json<{ account: { id: string } }>();

    const deleted = await SELF.fetch(`http://localhost/api/finance-accounts/${account.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(deleted.status).toBe(200);
    expect(await env.DB.prepare("SELECT id FROM finance_account WHERE id = ?").bind(account.id).first()).toBeNull();
  });
});
