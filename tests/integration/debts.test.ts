import { beforeAll, describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedUser } from "./helpers";

let cookie: string;

beforeAll(async () => {
  await applyMigrations();
  cookie = await createTestSession(await seedUser());
});

describe("finance accounts", () => {
  it("creates scoped debt and savings accounts", async () => {
    const debt = await SELF.fetch("http://localhost/api/finance-accounts", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ type: "debt", name: "Minh", debt_direction: "lend" }) });
    expect(debt.status).toBe(201);
    const savings = await SELF.fetch("http://localhost/api/finance-accounts", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ type: "savings", name: "Tiết kiệm 12 tháng" }) });
    expect(savings.status).toBe(201);
    const list = await SELF.fetch("http://localhost/api/finance-accounts", { headers: authHeaders(cookie) });
    expect((await list.json() as { accounts: { name: string }[] }).accounts.map((account) => account.name)).toEqual(expect.arrayContaining(["Minh", "Tiết kiệm 12 tháng"]));
  });

  it("rejects debt accounts without a direction", async () => {
    const response = await SELF.fetch("http://localhost/api/finance-accounts", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ type: "debt", name: "Thiếu loại" }) });
    expect(response.status).toBe(400);
  });
});
