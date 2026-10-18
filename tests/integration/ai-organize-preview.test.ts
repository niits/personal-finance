import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import type { NextRequest } from "next/server";
import { applyMigrations, seedCategory, seedMonthlyBudget, seedUser } from "./helpers";

const generation = vi.hoisted(() => ({
  beforeEmojiResponse: null as null | (() => Promise<void>),
  prompt: "",
  system: "",
  moves: null as null | Array<{ transaction_id: number; suggested_category_id: number; reason: string }>,
}));

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
  generateObject: async ({ prompt, system }: { prompt: string; system: string }) => {
    if (!prompt.startsWith("[")) {
      generation.prompt = prompt;
      generation.system = system;
      if (generation.moves) return { object: { new_categories: [], recategorizations: generation.moves, emoji_reassignments: [] } };
      return { object: {
        new_categories: [{
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
        ({ category_id }) => ({ category_id, emoji: "📁" }),
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
  generation.moves = null;
  generation.prompt = "";
  generation.system = "";
  generation.beforeEmojiResponse = null;
});

describe("AI Organize preview", () => {
  it("includes old Other transactions before 300 recent ordinary transactions and proposes a specific existing leaf", async () => {
    const userId = "user-organize-preview";
    const otherId = await seedCategory(userId, "Khác");
    const targetId = await seedCategory(userId, "Thuốc");
    const budget = await seedMonthlyBudget(userId, "2026-10", 1000000);
    const oldTransaction = await env.DB.prepare(`INSERT INTO "transaction"
      (user_id, amount, type, category_id, note, date, monthly_budget_id, updated_at)
      VALUES (?, 10000, 'expense', ?, 'Mua thuốc cảm', '2026-10-01', ?, 1) RETURNING id`)
      .bind(userId, otherId, budget.id).first<{ id: number }>();
    await env.DB.batch(Array.from({ length: 300 }, (_, index) => env.DB.prepare(`INSERT INTO "transaction"
      (user_id, amount, type, category_id, note, date, monthly_budget_id, updated_at)
      VALUES (?, 10000, 'expense', ?, 'Mua thuốc', '2026-10-01', ?, ?)`)
      .bind(userId, targetId, budget.id, 100 + index)));
    const protectedId = await seedCategory(userId, "Cho vay");
    await env.DB.prepare("UPDATE category SET system_kind = 'lend', budget_behavior = 'non_budget' WHERE id = ?").bind(protectedId).run();
    await env.DB.prepare(`INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id, updated_at)
      VALUES (?, 10000, 'expense', ?, 'Protected movement', '2026-10-01', ?, 9999)`).bind(userId, protectedId, budget.id).run();
    generation.moves = [{ transaction_id: oldTransaction!.id, suggested_category_id: targetId, reason: "Ghi chú xác định khoản mua thuốc." }];
    const response = await POST(new Request("http://localhost/api/ai/organize", { method: "POST" }) as NextRequest);
    expect(response.status).toBe(200);
    const preview = await response.json<{ recategorizations: Array<{ transaction_id: number; suggested_category_id: number }> }>();
    expect(preview.recategorizations).toEqual([expect.objectContaining({ transaction_id: oldTransaction!.id, suggested_category_id: targetId })]);
    const transactions = JSON.parse(generation.prompt.split("\n").at(-1)!) as Array<{ id: number; category_id: number }>;
    expect(transactions).toHaveLength(300);
    expect(transactions[0].id).toBe(oldTransaction!.id);
    expect(transactions.some((transaction) => transaction.category_id === protectedId)).toBe(false);
    expect(generation.system).toContain("Nhóm Khác là phân loại tạm thời");
    expect(generation.system).toContain("kể cả chỉ có một giao dịch");
    expect(await env.DB.prepare('SELECT category_id FROM "transaction" WHERE id = ?').bind(oldTransaction!.id).first()).toMatchObject({ category_id: otherId });
  });

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
