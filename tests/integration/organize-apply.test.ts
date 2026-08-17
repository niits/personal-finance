import { beforeAll, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedCategory, seedUser } from "./helpers";

let ownerCookie: string;
let otherCategoryId: number;

const emptyApply = {
  new_categories: [], emoji_assignments: [], recategorizations: [], emoji_reassignments: [],
};

beforeAll(async () => {
  await applyMigrations();
  await seedUser({ id: "organize-owner", email: "organize-owner@example.com" });
  await seedUser({ id: "organize-other", email: "organize-other@example.com" });
  ownerCookie = await createTestSession("organize-owner");
  otherCategoryId = await seedCategory("organize-other", "Private parent", null, 1);
});

describe("POST /api/ai/organize/apply", () => {
  it("rejects a parent category owned by another tenant", async () => {
    const response = await SELF.fetch("http://localhost/api/ai/organize/apply", {
      method: "POST",
      headers: authHeaders(ownerCookie),
      body: JSON.stringify({
        ...emptyApply,
        new_categories: [{ temp_id: "new", name: "Child", type: "expense", parent_category_id: otherCategoryId, example_notes: [] }],
      }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
    expect(await env.DB.prepare("SELECT COUNT(*) count FROM category WHERE user_id='organize-owner'").first()).toEqual({ count: 0 });
  });

  it("rejects apply after ledger activation", async () => {
    await env.DB.prepare("INSERT INTO financial_profile (user_id,ledger_start_date) VALUES ('organize-owner','2026-08-01')").run();
    const response = await SELF.fetch("http://localhost/api/ai/organize/apply", {
      method: "POST", headers: authHeaders(ownerCookie), body: JSON.stringify(emptyApply),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "LEDGER_CUTOVER_ACTIVE" });
  });
});
