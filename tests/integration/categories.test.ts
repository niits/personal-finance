import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  setupTestEnvironment,
  authenticatedDb,
  assertFails,
  assertSucceeds,
  uid,
} from "./helpers";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  listCategories,
  isLeafCategory,
  CategoryError,
} from "@/lib/data/categories";
import { createTransaction } from "@/lib/data/transactions";
import { createMonthlyBudget } from "@/lib/data/monthly-budgets";
import { collection, getDocs } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnvironment(); });
afterAll(async () => { await env.cleanup(); });

describe("createCategory", () => {
  it("creates a root expense category", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Ăn uống", type: "expense", parentId: null });
    expect(cat.id).toBeTruthy();
    expect(cat.name).toBe("Ăn uống");
    expect(cat.level).toBe(1);
    expect(cat.type).toBe("expense");
    expect(cat.parentId).toBeNull();
  });

  it("creates a root income category", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Thu nhập", type: "income", parentId: null });
    expect(cat.type).toBe("income");
    expect(cat.level).toBe(1);
  });

  it("creates a level-2 child — inherits parent type", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const parent = await createCategory(db, u, { name: "Ăn uống", type: "expense", parentId: null });
    const child = await createCategory(db, u, { name: "Ăn ngoài", parentId: parent.id });
    expect(child.level).toBe(2);
    expect(child.type).toBe("expense");
    expect(child.parentId).toBe(parent.id);
  });

  it("creates a level-3 category", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const l1 = await createCategory(db, u, { name: "L1", type: "expense", parentId: null });
    const l2 = await createCategory(db, u, { name: "L2", parentId: l1.id });
    const l3 = await createCategory(db, u, { name: "L3", parentId: l2.id });
    expect(l3.level).toBe(3);
  });

  it("rejects level-4 (parent is level-3)", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const l1 = await createCategory(db, u, { name: "L1", type: "expense", parentId: null });
    const l2 = await createCategory(db, u, { name: "L2", parentId: l1.id });
    const l3 = await createCategory(db, u, { name: "L3", parentId: l2.id });
    await expect(createCategory(db, u, { name: "L4", parentId: l3.id })).rejects.toThrow(CategoryError);
  });

  it("rejects empty name", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createCategory(db, u, { name: "  ", type: "expense", parentId: null })).rejects.toThrow(CategoryError);
  });

  it("rejects name longer than 100 chars", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(
      createCategory(db, u, { name: "a".repeat(101), type: "expense", parentId: null }),
    ).rejects.toThrow(CategoryError);
  });

  it("rejects root category without type", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createCategory(db, u, { name: "No type", parentId: null })).rejects.toThrow(CategoryError);
  });

  it("rejects non-existent parent", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createCategory(db, u, { name: "Child", parentId: "no-such-id" })).rejects.toThrow(CategoryError);
  });
});

describe("listCategories", () => {
  it("returns categories sorted by level then sortOrder", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const l1a = await createCategory(db, u, { name: "A", type: "expense", parentId: null });
    const l1b = await createCategory(db, u, { name: "B", type: "expense", parentId: null });
    await createCategory(db, u, { name: "A2", parentId: l1a.id });
    await createCategory(db, u, { name: "B2", parentId: l1b.id });

    const list = await listCategories(db, u);
    expect(list[0].level).toBe(1);
    expect(list[1].level).toBe(1);
    expect(list[2].level).toBe(2);
    expect(list[3].level).toBe(2);
  });

  it("returns empty array when no categories", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    expect(await listCategories(db, u)).toHaveLength(0);
  });
});

describe("updateCategory", () => {
  it("updates name", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Old name", type: "expense", parentId: null });
    await updateCategory(db, u, cat.id, { name: "New name" });
    const list = await listCategories(db, u);
    expect(list.find((c) => c.id === cat.id)?.name).toBe("New name");
  });

  it("updates sortOrder", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Cat", type: "expense", parentId: null });
    await updateCategory(db, u, cat.id, { sortOrder: 5 });
    const list = await listCategories(db, u);
    expect(list.find((c) => c.id === cat.id)?.sortOrder).toBe(5);
  });

  it("rejects empty name on update", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Cat", type: "expense", parentId: null });
    await expect(updateCategory(db, u, cat.id, { name: "" })).rejects.toThrow(CategoryError);
  });

  it("rejects update with no fields", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Cat", type: "expense", parentId: null });
    await expect(updateCategory(db, u, cat.id, {})).rejects.toThrow(CategoryError);
  });
});

describe("deleteCategory", () => {
  it("deletes a leaf category with no transactions", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Cat", type: "expense", parentId: null });
    await deleteCategory(db, u, cat.id);
    expect(await listCategories(db, u)).toHaveLength(0);
  });

  it("rejects deleting a category that has children", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const parent = await createCategory(db, u, { name: "Parent", type: "expense", parentId: null });
    await createCategory(db, u, { name: "Child", parentId: parent.id });
    await expect(deleteCategory(db, u, parent.id)).rejects.toThrow(CategoryError);
  });

  it("rejects deleting a category used by a transaction", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const parent = await createCategory(db, u, { name: "Parent", type: "expense", parentId: null });
    const child = await createCategory(db, u, { name: "Child", parentId: parent.id });
    await createMonthlyBudget(db, u, { month: "2026-05", amount: 10_000_000 });
    await createTransaction(db, u, {
      amount: 100_000,
      type: "expense",
      categoryId: child.id,
      date: "2026-05-10",
      note: null,
    });
    await expect(deleteCategory(db, u, child.id)).rejects.toThrow(CategoryError);
  });
});

describe("isLeafCategory", () => {
  it("returns true for a category with no children", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cat = await createCategory(db, u, { name: "Leaf", type: "expense", parentId: null });
    expect(await isLeafCategory(db, u, cat.id)).toBe(true);
  });

  it("returns false for a category with children", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const parent = await createCategory(db, u, { name: "Parent", type: "expense", parentId: null });
    await createCategory(db, u, { name: "Child", parentId: parent.id });
    expect(await isLeafCategory(db, u, parent.id)).toBe(false);
  });
});

describe("security rules — categories", () => {
  it("unauthenticated user cannot read categories", async () => {
    const u = uid();
    const adb = authenticatedDb(env, u);
    await createCategory(adb, u, { name: "Cat", type: "expense", parentId: null });

    // Read as a different (unauthenticated) context.
    const unauthDb = env.unauthenticatedContext().firestore();
    const snap = getDocs(collection(unauthDb as unknown as import("firebase/firestore").Firestore, "users", u, "categories"));
    await assertFails(snap);
  });

  it("user B cannot read user A's categories", async () => {
    const userA = uid();
    const userB = uid();
    const adb = authenticatedDb(env, userA);
    await createCategory(adb, userA, { name: "Private", type: "expense", parentId: null });

    const bdb = authenticatedDb(env, userB);
    const snap = getDocs(collection(bdb, "users", userA, "categories"));
    await assertFails(snap);
  });

  it("user can read their own categories", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await createCategory(db, u, { name: "Mine", type: "expense", parentId: null });
    const snap = getDocs(collection(db, "users", u, "categories"));
    await assertSucceeds(snap);
  });
});
