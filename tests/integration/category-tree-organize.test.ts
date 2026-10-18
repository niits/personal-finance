import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import type { NextRequest } from "next/server";
import { applyMigrations, seedCategory, seedMonthlyBudget, seedUser } from "./helpers";
import type { CategoryTreePlan, CategoryTreeState } from "@/lib/category-tree-organize";

const state = vi.hoisted(() => ({
  authenticated: true,
  targetId: 0,
  movedId: 0,
  beforeBatch: null as null | (() => Promise<void>),
  failBatch: false,
}));
vi.mock("@/lib/db", () => ({ getDB: async () => ({
  prepare: (sql: string) => env.DB.prepare(sql),
  batch: async (statements: D1PreparedStatement[]) => {
    if (state.beforeBatch) await state.beforeBatch();
    if (state.failBatch) statements.splice(2, 0, env.DB.prepare("SELECT json_extract('invalid JSON', '$')"));
    return env.DB.batch(statements);
  },
}) }));
vi.mock("@/lib/session", () => ({ requireSession: async () => state.authenticated ? { user: { id: "tree-user" } } : null }));
vi.mock("@/lib/llm", () => ({ runAIObject: async ({ prompt }: { prompt: string }) => ({
  nodes: (JSON.parse(prompt) as CategoryTreeState[]).map((item) => ({
    id: item.id, parent_id: item.id === state.movedId ? state.targetId : item.parent_id,
    sort_order: item.sort_order, reason: "Group related housing categories together.",
  })),
}) }));

import { POST as preview } from "@/app/api/categories/organize/route";
import { POST as apply } from "@/app/api/categories/organize/apply/route";

function request(body?: unknown) {
  return new Request("http://localhost/api/categories/organize", {
    method: "POST", headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as NextRequest;
}

beforeAll(async () => {
  await applyMigrations();
  await seedUser({ id: "tree-user", email: "tree@example.com" });
  await seedUser({ id: "tree-other", email: "tree-other@example.com" });
});
beforeEach(() => {
  state.authenticated = true;
  state.beforeBatch = null;
  state.failBatch = false;
});

async function fixture() {
  state.targetId = await seedCategory("tree-user", "Nhà ở");
  state.movedId = await seedCategory("tree-user", "Tiền thuê nhà");
  const childId = await seedCategory("tree-user", "Thuê căn hộ", state.movedId, 2);
  const response = await preview(request());
  expect(response.status).toBe(200);
  return { childId, proposal: await response.json<CategoryTreePlan & { snapshot: string }>() };
}

describe("AI category tree preview and atomic apply", () => {
  it("requires authentication for preview and apply", async () => {
    state.authenticated = false;
    expect((await preview(request())).status).toBe(401);
    expect((await apply(request({}))).status).toBe(401);
  });

  it("previews without writes and applies descendant levels together", async () => {
    const { proposal, childId } = await fixture();
    const otherId = await seedCategory("tree-other", "Other user's category");
    expect(await env.DB.prepare("SELECT parent_id, level FROM category WHERE id = ?").bind(state.movedId).first()).toMatchObject({ parent_id: null, level: 1 });
    const response = await apply(request(proposal));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated_categories: 2 });
    expect(await env.DB.prepare("SELECT parent_id, level FROM category WHERE id = ?").bind(childId).first()).toMatchObject({ parent_id: state.movedId, level: 3 });
    expect(await env.DB.prepare("SELECT parent_id, level FROM category WHERE id = ?").bind(otherId).first()).toMatchObject({ parent_id: null, level: 1 });
  });

  it("rejects stale snapshots and cross-user nodes without writes", async () => {
    const { proposal } = await fixture();
    const otherId = await seedCategory("tree-other", "Foreign category");
    const foreignPlan = { ...proposal, nodes: proposal.nodes.map((node, index) => index === 0 ? { ...node, id: otherId } : node) };
    expect((await apply(request(foreignPlan))).status).toBe(409);
    await seedCategory("tree-user", "A newly added category");
    expect((await apply(request(proposal))).status).toBe(409);
    expect(await env.DB.prepare("SELECT parent_id FROM category WHERE id = ?").bind(state.movedId).first()).toMatchObject({ parent_id: null });
  });

  it("rejects invalid complete trees", async () => {
    const { proposal } = await fixture();
    const cyclic = { ...proposal, nodes: proposal.nodes.map((node) => node.id === state.targetId ? { ...node, parent_id: state.movedId } : node) };
    expect((await apply(request(cyclic))).status).toBe(409);
    expect((await apply(request({ snapshot: proposal.snapshot, nodes: [] }))).status).toBe(409);
    expect((await apply(request({ nodes: [] }))).status).toBe(422);
  });

  it("detects a new transaction on a proposed parent between validation and commit", async () => {
    const { proposal } = await fixture();
    const budget = await seedMonthlyBudget("tree-user", "2026-10", 1000000);
    state.beforeBatch = async () => {
      await env.DB.prepare(`INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id)
        VALUES ('tree-user', 10000, 'expense', ?, 'Rent', '2026-10-01', ?)`)
        .bind(state.targetId, budget.id).run();
    };
    expect((await apply(request(proposal))).status).toBe(409);
    expect(await env.DB.prepare("SELECT parent_id FROM category WHERE id = ?").bind(state.movedId).first()).toMatchObject({ parent_id: null });
  });

  it("rolls back all category updates when a later batch statement fails", async () => {
    const { proposal, childId } = await fixture();
    state.failBatch = true;
    expect((await apply(request(proposal))).status).toBe(409);
    expect(await env.DB.prepare("SELECT parent_id, level FROM category WHERE id = ?").bind(state.movedId).first()).toMatchObject({ parent_id: null, level: 1 });
    expect(await env.DB.prepare("SELECT level FROM category WHERE id = ?").bind(childId).first()).toMatchObject({ level: 2 });
  });
});
