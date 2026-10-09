import { beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import type { NextRequest } from "next/server";
import { applyMigrations, seedCategory, seedMonthlyBudget, seedUser } from "./helpers";

const state = vi.hoisted(() => ({
  beforeWriteBatch: null as null | (() => Promise<void>),
  userId: "user-organize" as string | null,
}));
vi.mock("@/lib/db", () => ({ getDB: async () => ({
  prepare: env.DB.prepare.bind(env.DB),
  batch: async (statements: D1PreparedStatement[]) => {
    if (statements.length > 2 && state.beforeWriteBatch) {
      const hook = state.beforeWriteBatch;
      state.beforeWriteBatch = null;
      await hook();
    }
    return env.DB.batch(statements);
  },
}) }));
vi.mock("@/lib/session", () => ({
  requireSession: async () => state.userId ? ({ user: { id: state.userId } }) : null,
}));

import { OrganizePatchSchema, loadOrganizePatchState } from "@/lib/organize-patch";

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
      created_categories: 2, emoji_updated: 0, transactions_moved: 0, merged_categories: 0, reorganized_categories: 0,
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
      created_categories: 0, emoji_updated: 1, transactions_moved: 0, merged_categories: 0, reorganized_categories: 0,
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


// Contract: docs/features/ai-organize.md, structural changes preserve transaction history.
describe("AI Organize structural apply", () => {
  async function snapshot() {
    return (await loadOrganizePatchState(env.DB, userId, OrganizePatchSchema.parse(emptySelection))).categories;
  }

  it("moves historical and unnoted transactions before deleting a merged category", async () => {
    const target = await seedCategory(userId, "Chi phí y tế");
    const source = await seedCategory(userId, "Khám chữa bệnh");
    const budget = await seedMonthlyBudget(userId, "2025-01", 1000000);
    for (const categoryId of [target, target, source, source]) {
      await env.DB.prepare(`INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id, emoji)
        VALUES (?, 100000, 'expense', ?, NULL, '2025-01-01', ?, '🪼')`).bind(userId, categoryId, budget.id).run();
    }
    const selection = { ...emptySelection, category_snapshot: await snapshot(), category_merges: [{
      source_category_id: source, source_category_name: "Khám chữa bệnh", target_category_id: target,
      target_category_name: "Chi phí y tế", transaction_count: 2, reason: "Hợp nhất danh mục trùng nghĩa.",
    }] };
    const response = await apply(selection);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ merged_categories: 1, transactions_moved: 2 });
    expect(await env.DB.prepare("SELECT id FROM category WHERE id = ?").bind(source).first()).toBeNull();
    const transactions = await env.DB.prepare(`SELECT category_id, amount, note, date, monthly_budget_id, emoji
      FROM "transaction" WHERE user_id = ? AND category_id = ?`).bind(userId, target).all();
    expect(transactions.results).toHaveLength(4);
    expect(transactions.results.every((row) => row.amount === 100000 && row.note === null && row.date === "2025-01-01" && row.monthly_budget_id === budget.id && row.emoji === "🪼")).toBe(true);
    expect((await apply(selection)).status).toBe(409);
  });

  it("moves a subtree and persists descendant depth and sibling order", async () => {
    const parent = await seedCategory(userId, "Sinh hoạt chung");
    const branch = await seedCategory(userId, "Hoạt động học tập");
    const child = await seedCategory(userId, "Học phí", branch, 2);
    const response = await apply({ ...emptySelection, category_snapshot: await snapshot(), category_moves: [{
      category_id: branch, category_name: "Hoạt động học tập", parent_category_id: parent,
      parent_category_name: "Sinh hoạt chung", sort_order: 2, reason: "Sắp xếp nhóm chi phí.",
    }] });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reorganized_categories: 1 });
    expect(await env.DB.prepare("SELECT parent_id, level, sort_order FROM category WHERE id = ?").bind(branch).first()).toEqual({ parent_id: parent, level: 2, sort_order: 2 });
    expect(await env.DB.prepare("SELECT level FROM category WHERE id = ?").bind(child).first()).toEqual({ level: 3 });
  });

  it("rolls back transferred transactions if source deletion fails", async () => {
    const target = await seedCategory(userId, "Nguồn giữ lại");
    const source = await seedCategory(userId, "Nguồn hợp nhất");
    const budget = await seedMonthlyBudget(userId, "2026-09", 1000000);
    for (const categoryId of [target, source]) {
      await env.DB.prepare(`INSERT INTO "transaction" (user_id, amount, type, category_id, date, monthly_budget_id)
        VALUES (?, 100000, 'expense', ?, '2026-09-01', ?)`).bind(userId, categoryId, budget.id).run();
    }
    await env.DB.prepare(`CREATE TRIGGER fail_organize_merge BEFORE DELETE ON category
      WHEN OLD.id = ${source} BEGIN SELECT RAISE(ABORT, 'Test failure'); END`).run();
    try {
      const response = await apply({ ...emptySelection, category_snapshot: await snapshot(), category_merges: [{
        source_category_id: source, source_category_name: "Nguồn hợp nhất", target_category_id: target,
        target_category_name: "Nguồn giữ lại", transaction_count: 1, reason: "Hợp nhất danh mục.",
      }] });
      expect(response.ok).toBe(false);
      expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM "transaction" WHERE category_id = ?').bind(source).first()).toEqual({ count: 1 });
      expect(await env.DB.prepare('SELECT id FROM category WHERE id = ?').bind(source).first()).not.toBeNull();
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_organize_merge").run();
    }
  });
});


describe("AI Organize structural authorization and concurrency", () => {
  it("rejects unauthenticated requests", async () => {
    state.userId = null;
    try { expect((await apply(emptySelection)).status).toBe(401); }
    finally { state.userId = "user-organize"; }
  });

  it("rejects foreign category IDs even with a current owned snapshot", async () => {
    const foreignUser = await seedUser({ id: "foreign-organize", email: "foreign-organize@example.com" });
    const foreignCategory = await seedCategory(foreignUser, "Danh mục riêng");
    const { categories } = await loadOrganizePatchState(env.DB, userId, OrganizePatchSchema.parse(emptySelection));
    const response = await apply({ ...emptySelection, category_snapshot: categories, category_moves: [{
      category_id: foreignCategory, category_name: "Danh mục riêng", parent_category_id: null,
      parent_category_name: null, sort_order: 1, reason: "Sắp xếp thứ tự.",
    }] });
    expect(response.status).toBe(409);
  });

  it("rejects data changed after validation and before the atomic write", async () => {
    const categoryId = await seedCategory(userId, "Danh mục kiểm tra đồng thời");
    const { categories } = await loadOrganizePatchState(env.DB, userId, OrganizePatchSchema.parse(emptySelection));
    state.beforeWriteBatch = async () => {
      await env.DB.prepare("UPDATE category SET name = 'Danh mục đã đổi' WHERE id = ?").bind(categoryId).run();
    };
    const response = await apply({ ...emptySelection, category_snapshot: categories, category_moves: [{
      category_id: categoryId, category_name: "Danh mục kiểm tra đồng thời", parent_category_id: null,
      parent_category_name: null, sort_order: 1, reason: "Sắp xếp thứ tự.",
    }] });
    expect(response.status).toBe(409);
    expect(await env.DB.prepare("SELECT sort_order FROM category WHERE id = ?").bind(categoryId).first()).toEqual({ sort_order: 0 });
  });
});
