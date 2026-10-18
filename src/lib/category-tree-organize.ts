import { z } from "zod";

export const CategoryTreePlanSchema = z.object({
  nodes: z.array(z.object({
    id: z.number().int().positive(),
    parent_id: z.number().int().positive().nullable(),
    sort_order: z.number().int().min(0).max(100000),
    reason: z.string().trim().min(1).max(500),
  })).max(500),
});

export type CategoryTreePlan = z.infer<typeof CategoryTreePlanSchema>;
export type CategoryTreeState = {
  id: number;
  name: string;
  type: "income" | "expense";
  parent_id: number | null;
  level: number;
  sort_order: number;
  system_kind: string | null;
  budget_behavior: string;
  transaction_count: number;
};

export type CategoryTreeChange = {
  id: number;
  name: string;
  before: string;
  after: string;
  reason: string;
  parent_id: number | null;
  level: number;
  sort_order: number;
};

/** Validate the complete resulting tree, including descendants of moved nodes. */
export function resolveCategoryTreePlan(
  categories: CategoryTreeState[],
  plan: CategoryTreePlan,
): CategoryTreeChange[] | null {
  const current = new Map(categories.map((category) => [category.id, category]));
  const proposed = new Map(plan.nodes.map((node) => [node.id, node]));
  if (plan.nodes.length !== categories.length || proposed.size !== categories.length ||
      plan.nodes.some((node) => !current.has(node.id))) return null;

  const levels = new Map<number, number>();
  function depth(id: number, ancestors = new Set<number>()): number {
    if (ancestors.has(id)) return 4;
    if (levels.has(id)) return levels.get(id)!;
    const node = proposed.get(id);
    if (!node) return 4;
    const next = new Set(ancestors).add(id);
    const level = node.parent_id === null ? 1 : depth(node.parent_id, next) + 1;
    levels.set(id, level);
    return level;
  }

  for (const category of categories) {
    const node = proposed.get(category.id)!;
    const level = depth(category.id);
    if (level > 3) return null;
    if (category.system_kind || category.budget_behavior !== "consumption") {
      if (node.parent_id !== category.parent_id || node.sort_order !== category.sort_order ||
          level !== category.level) return null;
    }
    if (node.parent_id !== null) {
      const parent = current.get(node.parent_id);
      if (!parent || parent.type !== category.type || parent.system_kind ||
          parent.budget_behavior !== "consumption" || parent.transaction_count > 0) return null;
    }
    if (node.parent_id !== category.parent_id && categories.some((sibling) =>
      sibling.id !== category.id && sibling.type === category.type &&
      sibling.name.trim().toLocaleLowerCase("vi") === category.name.trim().toLocaleLowerCase("vi") &&
      proposed.get(sibling.id)!.parent_id === node.parent_id)) return null;
  }

  function path(id: number, proposedTree: boolean): string {
    const category = current.get(id)!;
    const parentId = proposedTree ? proposed.get(id)!.parent_id : category.parent_id;
    return parentId === null ? category.name : `${path(parentId, proposedTree)} / ${category.name}`;
  }

  function positions(proposedTree: boolean): Map<number, number> {
    const siblings = new Map<string, Array<{ id: number; order: number }>>();
    for (const category of categories) {
      const node = proposedTree ? proposed.get(category.id)! : category;
      const key = `${category.type}:${node.parent_id ?? "root"}`;
      const group = siblings.get(key) ?? [];
      group.push({ id: category.id, order: node.sort_order });
      siblings.set(key, group);
    }
    const result = new Map<number, number>();
    for (const group of siblings.values()) {
      group.sort((first, second) => first.order - second.order || first.id - second.id);
      group.forEach((node, index) => result.set(node.id, index + 1));
    }
    return result;
  }
  const beforePositions = positions(false);
  const afterPositions = positions(true);

  return categories.flatMap((category) => {
    const node = proposed.get(category.id)!;
    const level = levels.get(category.id)!;
    const before = path(category.id, false);
    const after = path(category.id, true);
    if (before === after && node.parent_id === category.parent_id &&
        node.sort_order === category.sort_order && level === category.level &&
        beforePositions.get(category.id) === afterPositions.get(category.id)) return [];
    return [{
      id: category.id, name: category.name,
      before: `${before} · Vị trí ${beforePositions.get(category.id)}`,
      after: `${after} · Vị trí ${afterPositions.get(category.id)}`,
      reason: node.reason, parent_id: node.parent_id, level, sort_order: node.sort_order,
    }];
  });
}
