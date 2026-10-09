import { describe, expect, it } from "vitest";
import { OrganizePatchSchema, resolveOrganizeTree, validateOrganizePatch, type OrganizeCategoryState } from "./organize-patch";

const category = (id: number, overrides: Partial<OrganizeCategoryState> = {}): OrganizeCategoryState => ({
  id, name: `Danh mục ${id}`, type: "expense", parent_id: null, level: 1,
  sort_order: 0, emoji: null, system_kind: null, budget_behavior: "consumption",
  child_count: 0, transaction_count: 0, ...overrides,
});
const patch = (categories: OrganizeCategoryState[], overrides: Record<string, unknown>) => OrganizePatchSchema.parse({
  category_snapshot: categories, new_categories: [], emoji_assignments: [], recategorizations: [], emoji_reassignments: [], ...overrides,
});
const move = (id: number, parent: number | null, sort = 0) => ({
  category_id: id, category_name: `Danh mục ${id}`, parent_category_id: parent,
  parent_category_name: parent === null ? null : `Danh mục ${parent}`, sort_order: sort, reason: "Tổ chức lại cây danh mục.",
});

describe("AI Organize category structure", () => {
  it("recalculates every descendant level when a branch moves", () => {
    const categories = [category(1), category(2, { child_count: 1 }), category(3, { parent_id: 2, level: 2, transaction_count: 5 })];
    const selection = patch(categories, { category_moves: [move(2, 1)] });
    expect(validateOrganizePatch(selection, categories, [])).toBe(true);
    expect(resolveOrganizeTree(selection, categories)?.map(({ id, level }) => [id, level])).toEqual([[1, 1], [2, 2], [3, 3]]);
  });

  it("rejects cycles, excessive depth, used parents, protected parents, and cross-type parents", () => {
    const categories = [category(1, { child_count: 1 }), category(2, { parent_id: 1, level: 2, child_count: 1 }), category(3, { parent_id: 2, level: 3 }), category(4)];
    expect(validateOrganizePatch(patch(categories, { category_moves: [move(1, 3)] }), categories, [])).toBe(false);
    expect(validateOrganizePatch(patch(categories, { category_moves: [move(1, 4)] }), categories, [])).toBe(false);
    for (const overrides of [{ transaction_count: 1 }, { system_kind: "debt" }, { type: "income" as const }]) {
      const rows = [category(1, overrides), category(2)];
      expect(validateOrganizePatch(patch(rows, { category_moves: [move(2, 1)] }), rows, [])).toBe(false);
    }
  });

  it("rejects stale snapshots and conflicting sibling names", () => {
    const rows = [category(1), category(2), category(3, { name: "Danh mục 2", parent_id: 1, level: 2 })];
    const selection = patch(rows, { category_moves: [move(2, 1)] });
    expect(validateOrganizePatch(selection, rows, [])).toBe(false);
    const ordered = patch(rows, { category_moves: [move(2, null, 1)] });
    expect(validateOrganizePatch(ordered, rows.map((row) => row.id === 2 ? { ...row, transaction_count: 1 } : row), [])).toBe(false);
  });

  it("merges eligible leaves and rejects merge chains or non-leaf sources", () => {
    const rows = [category(1, { transaction_count: 3 }), category(2, { transaction_count: 2 }), category(3)];
    const merge = { source_category_id: 2, source_category_name: "Danh mục 2", target_category_id: 1, target_category_name: "Danh mục 1", transaction_count: 2, reason: "Hợp nhất danh mục trùng nghĩa." };
    expect(validateOrganizePatch(patch(rows, { category_merges: [merge] }), rows, [])).toBe(true);
    expect(validateOrganizePatch(patch(rows, { category_merges: [merge, { ...merge, source_category_id: 1, source_category_name: "Danh mục 1", target_category_id: 3, target_category_name: "Danh mục 3", transaction_count: 3 }] }), rows, [])).toBe(false);
    const branch = rows.map((row) => row.id === 2 ? { ...row, child_count: 1 } : row);
    expect(validateOrganizePatch(patch(branch, { category_merges: [merge] }), branch, [])).toBe(false);
  });

  it("accepts Unicode emoji beyond a fixed picker, including composed sequences", () => {
    const rows = [category(1)];
    for (const emoji of ["🪼", "🧑🏽‍🚀", "🏳️‍🌈"]) {
      expect(validateOrganizePatch(patch(rows, { emoji_assignments: [{ category_id: 1, category_name: "Danh mục 1", current_emoji: null, emoji }] }), rows, [])).toBe(true);
    }
  });
});
