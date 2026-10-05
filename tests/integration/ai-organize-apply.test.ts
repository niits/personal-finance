import { beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import type { NextRequest } from "next/server";
import { applyMigrations, seedCategory, seedMonthlyBudget, seedUser } from "./helpers";

vi.mock("@/lib/db", () => ({ getDB: async () => env.DB }));
vi.mock("@/lib/session", () => ({
  requireSession: async () => ({ user: { id: "user-organize" } }),
}));

import { POST } from "@/app/api/ai/organize/apply/route";

let userId: string;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser({ id: "user-organize", email: "organize@example.com" });
});

const emptySelection = {
  new_categories: [],
  emoji_assignments: [],
  recategorizations: [],
  emoji_reassignments: [],
};

async function apply(selection: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/ai/organize/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selection),
  }) as NextRequest);
}

describe("AI Organize apply", () => {
  it("creates a root category at level 1 and a child at level 2", async () => {
    const parentId = await seedCategory(userId, "Sức khỏe", null, 1);
    const response = await apply({
      ...emptySelection,
      new_categories: [
        { temp_id: "new:0", name: "Giáo dục", emoji: "📚", type: "expense", parent_category_id: null, parent_category_name: null, example_notes: [] },
        { temp_id: "new:1", name: "Thuốc", emoji: "💊", type: "expense", parent_category_id: parentId, parent_category_name: "Sức khỏe", example_notes: [] },
      ],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      created_categories: 2, emoji_updated: 0, transactions_moved: 0,
    });
    const rows = await env.DB.prepare(
      "SELECT name, level, parent_id, emoji FROM category WHERE user_id = ? AND name IN ('Giáo dục', 'Thuốc') ORDER BY name",
    ).bind(userId).all<{ name: string; level: number; parent_id: number | null; emoji: string }>();
    expect(rows.results).toEqual([
      { name: "Giáo dục", level: 1, parent_id: null, emoji: "📚" },
      { name: "Thuốc", level: 2, parent_id: parentId, emoji: "💊" },
    ]);
  });

  it("rejects a stale emoji patch before writing a new category", async () => {
    const categoryId = await seedCategory(userId, "Di chuyển");
    await env.DB.prepare("UPDATE category SET emoji = '🚗' WHERE id = ?").bind(categoryId).run();
    const response = await apply({
      ...emptySelection,
      new_categories: [
        { temp_id: "new:0", name: "Không được tạo", emoji: "📁", type: "expense", parent_category_id: null, parent_category_name: null, example_notes: [] },
      ],
      emoji_assignments: [{ category_id: categoryId, category_name: "Di chuyển", current_emoji: null, emoji: "🚌" }],
    });
    expect(response.status).toBe(409);
    const created = await env.DB.prepare("SELECT id FROM category WHERE user_id = ? AND name = ?")
      .bind(userId, "Không được tạo").first();
    expect(created).toBeNull();
  });

  it("rejects a category proposal when its parent was renamed", async () => {
    const parentId = await seedCategory(userId, "Học tập");
    await env.DB.prepare("UPDATE category SET name = 'Đào tạo' WHERE id = ?").bind(parentId).run();
    const response = await apply({
      ...emptySelection,
      new_categories: [{
        temp_id: "new:0", name: "Sách giáo khoa", emoji: "📚", type: "expense",
        parent_category_id: parentId, parent_category_name: "Học tập", example_notes: [],
      }],
    });
    expect(response.status).toBe(409);
  });

  it("applies category emoji only while it is missing", async () => {
    const categoryId = await seedCategory(userId, "Giải trí");
    const selection = {
      ...emptySelection,
      emoji_assignments: [{ category_id: categoryId, category_name: "Giải trí", current_emoji: null, emoji: "🎬" }],
    };
    const response = await apply(selection);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      created_categories: 0, emoji_updated: 1, transactions_moved: 0,
    });
    expect(await apply(selection).then((result) => result.status)).toBe(409);
  });

  it("moves a transaction to the newly inserted category", async () => {
    const parentId = await seedCategory(userId, "Sinh hoạt");
    const oldId = await seedCategory(userId, "Chi phí khác", parentId, 2);
    const budget = await seedMonthlyBudget(userId, "2026-10", 1000000);
    const transaction = await env.DB.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id)
       VALUES (?, 100000, 'expense', ?, 'Mua thuốc', '2026-10-01', ?) RETURNING id, updated_at`,
    ).bind(userId, oldId, budget.id).first<{ id: number; updated_at: number }>();
    const response = await apply({
      ...emptySelection,
      new_categories: [
        { temp_id: "new:0", name: "Thuốc men", emoji: "💊", type: "expense", parent_category_id: parentId, parent_category_name: "Sinh hoạt", example_notes: ["Mua thuốc"] },
      ],
      recategorizations: [{
        transaction_id: transaction!.id,
        note: "Mua thuốc",
        current_category_id: oldId,
        current_category_name: "Chi phí khác",
        current_updated_at: transaction!.updated_at,
        suggested_category_id: "new:0",
        suggested_category_name: "Thuốc men",
        reason: "Ghi chú mô tả thuốc.",
      }],
    });
    expect(response.status).toBe(200);
    const row = await env.DB.prepare(
      `SELECT c.name, c.level FROM "transaction" t JOIN category c ON c.id = t.category_id WHERE t.id = ?`,
    ).bind(transaction!.id).first<{ name: string; level: number }>();
    expect(row).toEqual({ name: "Thuốc men", level: 2 });
  });

  it("rolls back category creation when a later D1 statement fails", async () => {
    const categoryId = await seedCategory(userId, "Sách");
    await env.DB.prepare(`CREATE TRIGGER fail_organize_emoji BEFORE UPDATE OF emoji ON category
      WHEN NEW.id = ${categoryId} BEGIN SELECT RAISE(ABORT, 'Test failure'); END`).run();
    try {
      const response = await apply({
        ...emptySelection,
        new_categories: [
          { temp_id: "new:0", name: "Danh mục hoàn tác", emoji: "📁", type: "expense", parent_category_id: null, parent_category_name: null, example_notes: [] },
        ],
        emoji_assignments: [{ category_id: categoryId, category_name: "Sách", current_emoji: null, emoji: "📚" }],
      });
      expect(response.status).toBe(409);
      const created = await env.DB.prepare("SELECT id FROM category WHERE user_id = ? AND name = ?")
        .bind(userId, "Danh mục hoàn tác").first();
      expect(created).toBeNull();
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_organize_emoji").run();
    }
  });

  it("rolls back the batch when a conditional update affects no rows", async () => {
    const categoryId = await seedCategory(userId, "Bảo hiểm");
    await env.DB.prepare(`CREATE TRIGGER skip_organize_emoji BEFORE UPDATE OF emoji ON category
      WHEN NEW.id = ${categoryId} BEGIN SELECT RAISE(IGNORE); END`).run();
    try {
      const response = await apply({
        ...emptySelection,
        new_categories: [{
          temp_id: "new:0", name: "Danh mục không được lưu", emoji: "📁",
          type: "expense", parent_category_id: null, parent_category_name: null, example_notes: [],
        }],
        emoji_assignments: [{
          category_id: categoryId, category_name: "Bảo hiểm", current_emoji: null, emoji: "🛡️",
        }],
      });
      expect(response.status).toBe(409);
      const created = await env.DB.prepare("SELECT id FROM category WHERE user_id = ? AND name = ?")
        .bind(userId, "Danh mục không được lưu").first();
      expect(created).toBeNull();
    } finally {
      await env.DB.prepare("DROP TRIGGER skip_organize_emoji").run();
    }
  });
});
