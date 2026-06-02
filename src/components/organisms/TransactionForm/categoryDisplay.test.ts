import { describe, it, expect } from "vitest";
import {
  type CategoryNode,
  findSelectedChild,
  getCategoryPath,
  subtreeCount,
  rootDisplay,
} from "./categoryDisplay";

// Build a category node with optional children.
function cat(id: number, name: string, children: CategoryNode[] = []): CategoryNode {
  return { id, name, children };
}

// Roots a..e with a couple of nested children, used across rootDisplay tests.
function sampleRoots(): CategoryNode[] {
  return [
    cat(1, "Ăn uống", [cat(11, "Cà phê"), cat(12, "Nhà hàng")]),
    cat(2, "Di chuyển", [cat(21, "Taxi")]),
    cat(3, "Hóa đơn"),
    cat(4, "Giải trí"),
    cat(5, "Sức khỏe"),
  ];
}

describe("subtreeCount", () => {
  it("sums a node's own count with all descendants", () => {
    const tree = cat(1, "root", [cat(11, "a", [cat(111, "a1")]), cat(12, "b")]);
    const counts = { 1: 2, 11: 3, 111: 4, 12: 5 };
    expect(subtreeCount(tree, counts)).toBe(14);
  });

  it("treats missing counts as zero", () => {
    expect(subtreeCount(cat(1, "root", [cat(2, "child")]), {})).toBe(0);
  });
});

describe("findSelectedChild", () => {
  const root = cat(1, "root", [cat(11, "child", [cat(111, "grandchild")])]);

  it("returns the name of a nested descendant", () => {
    expect(findSelectedChild(root, 111)).toBe("grandchild");
  });

  it("excludes the root itself", () => {
    expect(findSelectedChild(root, 1)).toBeNull();
  });

  it("returns null when not found or when no selection", () => {
    expect(findSelectedChild(root, 999)).toBeNull();
    expect(findSelectedChild(root, null)).toBeNull();
  });
});

describe("getCategoryPath", () => {
  it("builds a root-to-selected breadcrumb", () => {
    expect(getCategoryPath(sampleRoots(), 11)).toEqual(["Ăn uống", "Cà phê"]);
  });

  it("returns the root name for a root selection", () => {
    expect(getCategoryPath(sampleRoots(), 3)).toEqual(["Hóa đơn"]);
  });

  it("returns an empty path when the id is absent", () => {
    expect(getCategoryPath(sampleRoots(), 999)).toEqual([]);
  });
});

describe("rootDisplay", () => {
  it("sorts roots by subtree usage descending", () => {
    // Giải trí(4)=10, Ăn uống via children=5+1, Di chuyển=4, others 0.
    const counts = { 11: 5, 12: 1, 21: 4, 4: 10 };
    const { sorted } = rootDisplay(sampleRoots(), counts, null, 3);
    expect(sorted.map((c) => c.id)).toEqual([4, 1, 2, 3, 5]);
  });

  it("collapses to the top `limit` and flags hasMore when nothing is selected", () => {
    const counts = { 11: 5, 12: 1, 21: 4, 4: 10 };
    const { collapsed, hasMore } = rootDisplay(sampleRoots(), counts, null, 3);
    expect(collapsed.map((c) => c.id)).toEqual([4, 1, 2]);
    expect(hasMore).toBe(true);
  });

  it("appends the selected root when it falls outside the top slice", () => {
    const counts = { 11: 5, 12: 1, 21: 4, 4: 10 };
    // Select a child of "Sức khỏe"? It has none; select root 5 directly (rank last).
    const { collapsed } = rootDisplay(sampleRoots(), counts, 5, 3);
    expect(collapsed.map((c) => c.id)).toEqual([4, 1, 2, 5]);
  });

  it("keeps a selected root visible via a nested selection", () => {
    const counts = { 11: 5, 12: 1, 21: 4, 4: 10 };
    // id 21 (Taxi) lives under root 2 (Di chuyển), which is already in the top.
    const { collapsed } = rootDisplay(sampleRoots(), counts, 21, 2);
    // top-2 = [4, 1]; selected root 2 is outside, so it is appended.
    expect(collapsed.map((c) => c.id)).toEqual([4, 1, 2]);
  });

  it("does not duplicate a selected root already in the top slice", () => {
    const counts = { 4: 10, 11: 5 };
    const { collapsed } = rootDisplay(sampleRoots(), counts, 4, 3);
    expect(collapsed.filter((c) => c.id === 4)).toHaveLength(1);
  });

  it("reports hasMore=false once the collapsed view covers every root", () => {
    const roots = sampleRoots().slice(0, 3);
    const { collapsed, hasMore } = rootDisplay(roots, {}, null, 3);
    expect(collapsed).toHaveLength(3);
    expect(hasMore).toBe(false);
  });
});
