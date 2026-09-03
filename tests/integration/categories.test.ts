import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
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

  it("returns hierarchy, system status, and transaction usage counts", async () => {
    const parentId = await seedCategory(userId, "Nhà cửa", null, 1);
    const childId = await seedCategory(userId, "Tiền thuê nhà", parentId, 2);
    await env.DB.prepare("UPDATE category SET system_kind = 'savings_deposit', budget_behavior = 'non_budget' WHERE id = ?")
      .bind(parentId)
      .run();
    const budgetId = (await env.DB.prepare(
      "INSERT INTO monthly_budget (user_id, month, amount) VALUES (?, '2026-09', 10000000) RETURNING id",
    ).bind(userId).first<{ id: number }>())!.id;
    await env.DB.prepare(
      "INSERT INTO `transaction` (user_id, amount, type, category_id, note, date, monthly_budget_id) VALUES (?, 5000000, 'expense', ?, 'Tiền nhà', '2026-09-01', ?)",
    ).bind(userId, childId, budgetId).run();

    const res = await SELF.fetch("http://localhost/api/categories", {
      headers: { Cookie: cookie },
    });
    const body = await res.json<{
      categories: Array<{ id: number; system_kind: string | null; children: Array<{ id: number }> }>;
      usage_counts: Record<string, number>;
    }>();
    const parent = body.categories.find((category) => category.id === parentId);

    expect(parent?.system_kind).toBe("savings_deposit");
    expect(parent?.children).toContainEqual(expect.objectContaining({ id: childId }));
    expect(body.usage_counts[String(childId)]).toBe(1);
  });
});

describe("POST /api/categories", () => {
  it("creates a level-1 category", async () => {
    const res = await SELF.fetch("http://localhost/api/categories", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Ăn uống", type: "expense" }),
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

describe("PATCH /api/categories/:id", () => {
  it("renames a category and updates its emoji", async () => {
    const catId = await seedCategory(userId, "Tên cũ", null, 1);

    const res = await SELF.fetch(`http://localhost/api/categories/${catId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "  Tên mới  ", emoji: "🧾" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json<{ category: { name: string; emoji: string | null } }>();
    expect(body.category).toEqual(expect.objectContaining({ name: "Tên mới", emoji: "🧾" }));
  });

  it("rejects changes to a protected system category", async () => {
    const catId = await seedCategory(userId, "Gửi tiết kiệm", null, 1);
    await env.DB.prepare("UPDATE category SET system_kind = 'savings_deposit', budget_behavior = 'non_budget' WHERE id = ?")
      .bind(catId)
      .run();

    const res = await SELF.fetch(`http://localhost/api/categories/${catId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ name: "Không được đổi" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual(expect.objectContaining({
      error: "Danh mục hệ thống không thể chỉnh sửa",
      code: "VALIDATION_ERROR",
    }));
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

  it("returns the transaction count when a category is in use", async () => {
    const catId = await seedCategory(userId, "Đang sử dụng", null, 1);
    const budgetId = (await env.DB.prepare(
      "INSERT INTO monthly_budget (user_id, month, amount) VALUES (?, '2026-10', 10000000) RETURNING id",
    ).bind(userId).first<{ id: number }>())!.id;
    await env.DB.prepare(
      "INSERT INTO `transaction` (user_id, amount, type, category_id, date, monthly_budget_id) VALUES (?, 100000, 'expense', ?, '2026-10-01', ?), (?, 200000, 'expense', ?, '2026-10-02', ?)",
    ).bind(userId, catId, budgetId, userId, catId, budgetId).run();

    const res = await SELF.fetch(`http://localhost/api/categories/${catId}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Danh mục đang được dùng bởi 2 giao dịch",
      code: "CATEGORY_IN_USE",
      details: { transaction_count: 2 },
    });
  });

  it("returns 404 for non-existent category", async () => {
    const res = await SELF.fetch("http://localhost/api/categories/99999", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});
