import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import {
  applyMigrations,
  seedUser,
  createTestSession,
  seedCategory,
  authHeaders,
} from "./helpers";

let cookie: string;
let userId: string;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser({ id: "user-cat", email: "cat@example.com" });
  cookie = await createTestSession(userId);
});

describe("GET /api/categories", () => {
  it("returns empty list for new user (before seed)", async () => {
    const res = await SELF.fetch("http://localhost/api/categories", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ categories: unknown[] }>();
    expect(Array.isArray(body.categories)).toBe(true);
  });
});

describe("POST /api/categories", () => {
  it("creates a level-1 category", async () => {
    const res = await SELF.fetch("http://localhost/api/categories", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Ăn uống" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ category: { level: number; parent_id: null } }>();
    expect(body.category.level).toBe(1);
    expect(body.category.parent_id).toBeNull();
  });

  it("creates a level-2 category under level-1", async () => {
    const parentId = await seedCategory(userId, "Đi lại", null, 1);

    const res = await SELF.fetch("http://localhost/api/categories", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Xăng", parent_id: parentId }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ category: { level: number; parent_id: number } }>();
    expect(body.category.level).toBe(2);
    expect(body.category.parent_id).toBe(parentId);
  });

  it("creates a level-3 category under level-2", async () => {
    const l1Id = await seedCategory(userId, "Sức khoẻ L1", null, 1);
    const l2Id = await seedCategory(userId, "Thuốc L2", l1Id, 2);

    const res = await SELF.fetch("http://localhost/api/categories", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Vitamin", parent_id: l2Id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ category: { level: number } }>();
    expect(body.category.level).toBe(3);
  });

  it("returns 409 when trying to add child to level-3 category", async () => {
    const l1Id = await seedCategory(userId, "Giải trí L1", null, 1);
    const l2Id = await seedCategory(userId, "Game L2", l1Id, 2);
    const l3Id = await seedCategory(userId, "Mobile L3", l2Id, 3);

    const res = await SELF.fetch("http://localhost/api/categories", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Too deep", parent_id: l3Id }),
    });

    expect(res.status).toBe(409);
  });

  it("returns 400 for empty name", async () => {
    const res = await SELF.fetch("http://localhost/api/categories", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/categories/:id", () => {
  it("deletes a leaf category with no transactions", async () => {
    const catId = await seedCategory(userId, "Temp category", null, 1);

    const res = await SELF.fetch(`http://localhost/api/categories/${catId}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
  });

  it("returns 409 when category has children", async () => {
    const parentId = await seedCategory(userId, "Parent with child", null, 1);
    await seedCategory(userId, "Child", parentId, 2);

    const res = await SELF.fetch(`http://localhost/api/categories/${parentId}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(409);
  });

  it("returns 404 for non-existent category", async () => {
    const res = await SELF.fetch("http://localhost/api/categories/99999", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});
