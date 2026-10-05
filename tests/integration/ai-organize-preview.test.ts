import { beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import type { NextRequest } from "next/server";
import { applyMigrations, seedCategory, seedMonthlyBudget, seedUser } from "./helpers";

const generation = vi.hoisted(() => ({ beforeEmojiResponse: null as null | (() => Promise<void>) }));

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
