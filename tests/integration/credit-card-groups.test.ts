import { beforeAll, describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedUser } from "./helpers";

let cookie: string;

beforeAll(async () => {
  await applyMigrations();
  cookie = await createTestSession(await seedUser());
});

describe("credit-card groups", () => {
  it("creates, updates, and deletes a group", async () => {
    const created = await SELF.fetch("http://localhost/api/credit-card-groups", {
      method: "POST", headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Chi tiêu chung", statement_close_day: 15 }),
    });
    expect(created.status).toBe(201);
    const { group } = await created.json() as { group: { id: string } };

    const updated = await SELF.fetch(`http://localhost/api/credit-card-groups/${group.id}`, {
      method: "PATCH", headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Chi tiêu gia đình", statement_close_day: 20 }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ group: { name: "Chi tiêu gia đình", statement_close_day: 20 } });

    const deleted = await SELF.fetch(`http://localhost/api/credit-card-groups/${group.id}`, {
      method: "DELETE", headers: authHeaders(cookie),
    });
    expect(deleted.status).toBe(200);
    expect((await env.DB.prepare("SELECT id FROM credit_card_group WHERE id = ?").bind(group.id).first())).toBeNull();
  });
});
