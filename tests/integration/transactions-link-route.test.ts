import { beforeAll, describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedUser } from "./helpers";

let cookie: string;
beforeAll(async () => { await applyMigrations(); cookie = await createTestSession(await seedUser()); });

describe("credit card management", () => {
  it("creates a group and card scoped to the authenticated user", async () => {
    const group = await SELF.fetch("http://localhost/api/credit-card-groups", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ name: "Chi tiêu", statement_close_day: 15 }) });
    expect(group.status).toBe(201);
    const { group: created } = await group.json() as { group: { id: string } };
    const card = await SELF.fetch("http://localhost/api/credit-cards", { method: "POST", headers: authHeaders(cookie), body: JSON.stringify({ group_id: created.id, name: "Visa" }) });
    expect(card.status).toBe(201);
  });
});
