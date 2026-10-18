import { describe, expect, it } from "vitest";
import { resolveCategoryTreePlan, type CategoryTreePlan, type CategoryTreeState } from "./category-tree-organize";

const category = (id: number, overrides: Partial<CategoryTreeState> = {}): CategoryTreeState => ({
  id, name: `Category ${id}`, type: "expense", parent_id: null, level: 1, sort_order: 0,
  system_kind: null, budget_behavior: "consumption", transaction_count: 0, ...overrides,
});
const plan = (categories: CategoryTreeState[], moves: Record<number, number | null> = {}): CategoryTreePlan => ({
  nodes: categories.map((item) => ({
    id: item.id, parent_id: item.id in moves ? moves[item.id] : item.parent_id,
    sort_order: item.sort_order, reason: "Group related categories together.",
  })),
});

describe("category tree organization contract", () => {
  it("derives descendant levels and paths while preserving transaction assignments", () => {
    const categories = [category(1), category(2), category(3, { parent_id: 2, level: 2, transaction_count: 3 })];
    const changes = resolveCategoryTreePlan(categories, plan(categories, { 2: 1 }));
    expect(changes).toEqual([
      expect.objectContaining({ id: 2, parent_id: 1, level: 2 }),
      expect.objectContaining({ id: 3, parent_id: 2, level: 3, after: "Category 1 / Category 2 / Category 3 · Vị trí 1" }),
    ]);
    expect(categories[2].transaction_count).toBe(3);
  });

  it("accepts an unchanged tree as a no-op", () => {
    const categories = [category(1)];
    expect(resolveCategoryTreePlan(categories, plan(categories))).toEqual([]);
  });

  it("reports actual sibling positions when stored order values contain gaps or ties", () => {
    const categories = [category(1), category(2, { sort_order: 20 }), category(3, { sort_order: 5 })];
    const proposal = plan(categories);
    proposal.nodes[1].sort_order = 1;
    const changes = resolveCategoryTreePlan(categories, proposal);
    expect(changes).toEqual([
      expect.objectContaining({ id: 2, before: "Category 2 · Vị trí 3", after: "Category 2 · Vị trí 2" }),
      expect.objectContaining({ id: 3, before: "Category 3 · Vị trí 2", after: "Category 3 · Vị trí 3" }),
    ]);
  });

  it("rejects cycles, unknown IDs, duplicate IDs, and missing nodes", () => {
    const categories = [category(1), category(2)];
    expect(resolveCategoryTreePlan(categories, plan(categories, { 1: 2, 2: 1 }))).toBeNull();
    expect(resolveCategoryTreePlan(categories, plan(categories, { 1: 99 }))).toBeNull();
    const proposal = plan(categories);
    expect(resolveCategoryTreePlan(categories, { nodes: [proposal.nodes[0], proposal.nodes[0]] })).toBeNull();
    expect(resolveCategoryTreePlan(categories, { nodes: [proposal.nodes[0]] })).toBeNull();
  });

  it("rejects changes that push any descendant past three levels", () => {
    const categories = [category(1), category(2), category(3, { parent_id: 2, level: 2 }), category(4, { parent_id: 3, level: 3 })];
    expect(resolveCategoryTreePlan(categories, plan(categories, { 2: 1 }))).toBeNull();
  });

  it("rejects cross-type parents and parents with assigned transactions", () => {
    for (const overrides of [{ type: "income" as const }, { transaction_count: 1 }]) {
      const categories = [category(1, overrides), category(2)];
      expect(resolveCategoryTreePlan(categories, plan(categories, { 2: 1 }))).toBeNull();
    }
  });

  it("preserves protected categories and rejects using them as parents", () => {
    const categories = [category(1, { system_kind: "lend", budget_behavior: "non_budget" }), category(2)];
    expect(resolveCategoryTreePlan(categories, plan(categories, { 1: 2 }))).toBeNull();
    expect(resolveCategoryTreePlan(categories, plan(categories, { 2: 1 }))).toBeNull();
    const proposal = plan(categories);
    proposal.nodes[0].sort_order = 1;
    expect(resolveCategoryTreePlan(categories, proposal)).toBeNull();
  });

  it("rejects new sibling name collisions", () => {
    const categories = [category(1), category(2, { name: "Same name" }), category(3, { name: "Same name", parent_id: 1, level: 2 })];
    expect(resolveCategoryTreePlan(categories, plan(categories, { 2: 1 }))).toBeNull();
  });
});
