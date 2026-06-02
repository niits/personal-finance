// Pure category drill-down helpers, extracted from TransactionForm so the
// sorting / collapsed-view logic can be unit-tested without rendering React.

export type CategoryNode = {
  id: number;
  name: string;
  children: CategoryNode[];
};

// Name of the selected descendant within `cat`'s subtree, or null. The root
// itself is intentionally excluded — callers compare `cat.id === selectedId`
// separately when they need to match the root.
export function findSelectedChild(cat: CategoryNode, selectedId: number | null): string | null {
  if (!selectedId) return null;
  for (const child of cat.children) {
    if (child.id === selectedId) return child.name;
    const found = findSelectedChild(child, selectedId);
    if (found) return found;
  }
  return null;
}

// Breadcrumb of category names from root to the selected node (inclusive).
export function getCategoryPath(cats: CategoryNode[], selectedId: number | null): string[] {
  const result: string[] = [];
  function walk(list: CategoryNode[]): boolean {
    for (const c of list) {
      if (c.id === selectedId) { result.push(c.name); return true; }
      if (walk(c.children)) { result.unshift(c.name); return true; }
    }
    return false;
  }
  walk(cats);
  return result;
}

// Total transaction count across a category and all of its descendants.
export function subtreeCount(cat: CategoryNode, usageCounts: Record<number, number>): number {
  let n = usageCounts[cat.id] ?? 0;
  for (const child of cat.children) n += subtreeCount(child, usageCounts);
  return n;
}

// Root-level display model: roots sorted by subtree usage (descending), the
// collapsed slice (top `limit`, plus the selected root if it falls outside),
// and whether a "show more" affordance is needed. Subtree counts are computed
// once into a map so the comparator does O(1) lookups instead of re-walking.
export function rootDisplay<T extends CategoryNode>(
  roots: T[],
  usageCounts: Record<number, number>,
  selectedId: number | null,
  limit: number,
): { sorted: T[]; collapsed: T[]; hasMore: boolean } {
  const countById = new Map<number, number>();
  for (const r of roots) countById.set(r.id, subtreeCount(r, usageCounts));
  const sorted = [...roots].sort((a, b) => countById.get(b.id)! - countById.get(a.id)!);

  const top = sorted.slice(0, limit);
  const selectedRoot = selectedId !== null
    ? sorted.find((c) => c.id === selectedId || findSelectedChild(c, selectedId) !== null)
    : undefined;
  const collapsed = selectedRoot && !top.some((c) => c.id === selectedRoot.id)
    ? [...top, selectedRoot]
    : top;

  return { sorted, collapsed, hasMore: sorted.length > collapsed.length };
}
