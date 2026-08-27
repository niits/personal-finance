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
    ).bind(userId, 100_000, "income", "2026-05-01", account.id).run();

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
