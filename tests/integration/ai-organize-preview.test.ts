import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import type { NextRequest } from "next/server";
import { applyMigrations, seedCategory, seedMonthlyBudget, seedUser } from "./helpers";

const generation = vi.hoisted(() => ({ beforeEmojiResponse: null as null | (() => Promise<void>),
  proposal: null as null | Record<string, unknown>,
  emoji: "📁", }));

vi.mock("@/lib/db", () => ({ getDB: async () => env.DB }));
vi.mock("@/lib/session", () => ({
  requireSession: async () => ({ user: { id: "user-organize-preview" } }),
}));
vi.mock("@/lib/llm", () => ({ getOpenAIModel: async () => ({}) }));
vi.mock("@/lib/telemetry", () => ({
  startAITrace: () => ({ telemetry: undefined, flush: async () => {} }),
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {}, ctx: { waitUntil: () => {} } }),
}));
vi.mock("ai", () => ({
  generateObject: async ({ prompt }: { prompt: string }) => {
    if (!prompt.startsWith("[")) {
      if (generation.proposal) return { object: generation.proposal };
      return { object: {
        category_merges: [], category_moves: [],
        new_categories: prompt.endsWith("[]") ? [] : [{
          temp_id: "new:0", name: "Thuốc men", type: "expense",
          parent_category_id: null, emoji: "💊", example_notes: ["Mua thuốc"],
        }],
        recategorizations: [],
        emoji_reassignments: [],
      } };
    }
    if (generation.beforeEmojiResponse) {
      await generation.beforeEmojiResponse();
      generation.beforeEmojiResponse = null;
    }
    return { object: {
      assignments: (JSON.parse(prompt) as Array<{ category_id: number }>).map(
        ({ category_id }) => ({ category_id, emoji: generation.emoji }),
      ),
    } };
  },
}));

import { POST } from "@/app/api/ai/organize/route";

beforeAll(async () => {
  await applyMigrations();
  await seedUser({ id: "user-organize-preview", email: "organize-preview@example.com" });
});

beforeEach(() => {
  generation.proposal = null;
  generation.emoji = "📁";
  generation.beforeEmojiResponse = null;
});

const emptyProposal = {
  new_categories: [], recategorizations: [], emoji_reassignments: [],
  category_moves: [], category_merges: [],
};

const requestPreview = () => POST(new Request("http://localhost/api/ai/organize", {
  method: "POST",
}) as NextRequest);

describe("AI Organize preview", () => {
  it("proposes emoji for every missing category without noted transactions", async () => {
    const firstId = await seedCategory("user-organize-preview", "Ăn uống");
    const secondId = await seedCategory("user-organize-preview", "Di chuyển");
    const alreadySetId = await seedCategory("user-organize-preview", "Lương", null, 1, "income");
    await env.DB.prepare("UPDATE category SET emoji = '💰' WHERE id = ?").bind(alreadySetId).run();

    const response = await POST(new Request("http://localhost/api/ai/organize", {
      method: "POST",
    }) as NextRequest);
    expect(response.status).toBe(200);
    const preview = await response.json<{
      new_categories: unknown[];
      emoji_assignments: Array<{ category_id: number; category_name: string; current_emoji: null; emoji: string }>;
    }>();
    expect(preview.new_categories).toEqual([]);
    expect(preview.emoji_assignments).toEqual([
      { category_id: firstId, category_name: "Ăn uống", current_emoji: null, emoji: "📁" },
      { category_id: secondId, category_name: "Di chuyển", current_emoji: null, emoji: "📁" },
    ]);
  });

  it("includes an emoji with each proposed new category", async () => {
    const categoryId = await seedCategory("user-organize-preview", "Chi phí khác");
    const budget = await seedMonthlyBudget("user-organize-preview", "2026-10", 1000000);
    await env.DB.prepare(`INSERT INTO "transaction"
      (user_id, amount, type, category_id, note, date, monthly_budget_id)
      VALUES (?, 50000, 'expense', ?, 'Mua thuốc', '2026-10-01', ?)`)
      .bind("user-organize-preview", categoryId, budget.id).run();
    const response = await POST(new Request("http://localhost/api/ai/organize", {
      method: "POST",
    }) as NextRequest);
    expect(response.status).toBe(200);
    const preview = await response.json<{
      new_categories: Array<{ name: string; emoji: string; parent_category_name: string | null }>;
    }>();
    expect(preview.new_categories).toEqual([
      expect.objectContaining({ name: "Thuốc men", emoji: "💊", parent_category_name: null }),
    ]);
  });

  it("rejects the whole proposal when category data changes during generation", async () => {
    const categoryId = await seedCategory("user-organize-preview", "Danh mục mới");
    generation.beforeEmojiResponse = async () => {
      await env.DB.prepare("UPDATE category SET emoji = '📌' WHERE id = ?").bind(categoryId).run();
    };
    const response = await POST(new Request("http://localhost/api/ai/organize", {
      method: "POST",
    }) as NextRequest);
    expect(response.status).toBe(409);
    expect(await response.json<{ code: string }>()).toMatchObject({ code: "STALE_PROPOSAL" });
  });
});


describe("AI Organize structural preview", () => {
  it("returns a usable preview when AI repeats the current parent and order", async () => {
    const categoryId = await seedCategory("user-organize-preview", "Sinh hoạt");
    generation.proposal = { ...emptyProposal, category_moves: [{
      category_id: categoryId, parent_category_id: null, sort_order: 0,
      reason: "Giữ vị trí hiện tại.",
    }] };

    const response = await requestPreview();
    expect(response.status).toBe(200);
    const preview = await response.json<{ category_moves: unknown[]; emoji_assignments: unknown[] }>();
    expect(preview.category_moves).toEqual([]);
    expect(preview.emoji_assignments).toHaveLength(1);
  });

  it("preserves a valid tree change alongside unchanged parent and order suggestions", async () => {
    const parent = await seedCategory("user-organize-preview", "Sinh hoạt");
    const branch = await seedCategory("user-organize-preview", "Học tập");
    generation.proposal = { ...emptyProposal, category_moves: [
      { category_id: parent, parent_category_id: null, sort_order: 0, reason: "Giữ vị trí hiện tại." },
      { category_id: branch, parent_category_id: parent, sort_order: 1, reason: "Sắp xếp nhóm học tập." },
    ] };

    const response = await requestPreview();
    expect(response.status).toBe(200);
    const preview = await response.json<{ category_moves: Array<{ category_id: number }> }>();
    expect(preview.category_moves).toEqual([expect.objectContaining({ category_id: branch })]);
    expect(await env.DB.prepare("SELECT parent_id FROM category WHERE id = ?").bind(branch).first())
      .toEqual({ parent_id: null });
  });

  it("reports an invalid AI tree as a model proposal error when data did not change", async () => {
    const parent = await seedCategory("user-organize-preview", "Sinh hoạt");
    const child = await seedCategory("user-organize-preview", "Học tập", parent, 2);
    generation.proposal = { ...emptyProposal, category_moves: [{
      category_id: parent, parent_category_id: child, sort_order: 1,
      reason: "Sắp xếp nhóm danh mục.",
    }] };

    const response = await requestPreview();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "AI_INVALID_PATCH" });
    expect(await env.DB.prepare("SELECT parent_id FROM category WHERE id = ?").bind(parent).first())
      .toEqual({ parent_id: null });
  });

  it("omits protected finance recategorizations while preserving valid suggestions", async () => {
    const lending = await seedCategory("user-organize-preview", "Cho vay");
    await env.DB.prepare("UPDATE category SET system_kind = 'lend', budget_behavior = 'non_budget' WHERE id = ?")
      .bind(lending).run();
    const original = await seedCategory("user-organize-preview", "Chi phí khác");
    const target = await seedCategory("user-organize-preview", "Điện nước");
    const budget = await seedMonthlyBudget("user-organize-preview", "2026-10", 1000000);
    const transactionIds = [];
    for (const categoryId of [lending, original]) {
      const result = await env.DB.prepare(`INSERT INTO "transaction"
        (user_id, amount, type, category_id, note, date, monthly_budget_id)
        VALUES (?, 50000, 'expense', ?, 'Tiền điện nước tháng 9', '2026-10-01', ?)`)
        .bind("user-organize-preview", categoryId, budget.id).run();
      transactionIds.push(result.meta.last_row_id);
    }
    generation.proposal = { ...emptyProposal, recategorizations: transactionIds.map((transactionId) => ({
      transaction_id: transactionId, suggested_category_id: target,
      reason: "Phân loại chi phí điện nước.",
    })) };

    const response = await requestPreview();
    expect(response.status).toBe(200);
    const preview = await response.json<{ recategorizations: Array<{ transaction_id: number }> }>();
    expect(preview.recategorizations).toEqual([
      expect.objectContaining({ transaction_id: transactionIds[1] }),
    ]);
    expect(await env.DB.prepare('SELECT category_id FROM "transaction" WHERE id = ?')
      .bind(transactionIds[0]).first()).toEqual({ category_id: lending });
  });

  it("analyzes structure without noted transactions and resolves review metadata", async () => {
    const target = await seedCategory("user-organize-preview", "Đi lại");
    const source = await seedCategory("user-organize-preview", "Di chuyển");
    generation.proposal = { new_categories: [], recategorizations: [], emoji_reassignments: [], category_moves: [], category_merges: [{
      source_category_id: source, target_category_id: target, reason: "Hai danh mục cùng mô tả việc đi lại.",
    }] };
    generation.emoji = "🧑🏽‍🚀";
    try {
      const response = await POST(new Request("http://localhost/api/ai/organize", { method: "POST" }) as NextRequest);
      expect(response.status).toBe(200);
      const preview = await response.json<{ category_merges: unknown[]; category_snapshot: unknown[]; emoji_assignments: Array<{ category_id: number; emoji: string }> }>();
      expect(preview.category_merges).toEqual([{
        source_category_id: source, source_category_name: "Di chuyển", target_category_id: target,
        target_category_name: "Đi lại", transaction_count: 0, reason: "Hai danh mục cùng mô tả việc đi lại.",
      }]);
      expect(preview.category_snapshot).toHaveLength(2);
      expect(preview.emoji_assignments).toEqual([{ category_id: target, category_name: "Đi lại", current_emoji: null, emoji: "🧑🏽‍🚀" }]);
      expect(await env.DB.prepare("SELECT id FROM category WHERE id = ?").bind(source).first()).not.toBeNull();
    } finally { generation.proposal = null; generation.emoji = "📁"; }
  });
});
