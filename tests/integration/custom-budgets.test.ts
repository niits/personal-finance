import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { setupTestEnvironment, authenticatedDb, uid } from "./helpers";
import {
  createCustomBudget,
  updateCustomBudget,
  deleteCustomBudget,
  listCustomBudgets,
  CustomBudgetError,
} from "@/lib/data/custom-budgets";
import { createCategory } from "@/lib/data/categories";
import { createMonthlyBudget } from "@/lib/data/monthly-budgets";
import { createTransaction } from "@/lib/data/transactions";
import { doc, getDoc } from "firebase/firestore";
import { transactionsCol } from "@/lib/firestore-refs";

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnvironment(); });
afterAll(async () => { await env.cleanup(); });

describe("createCustomBudget", () => {
  it("creates a custom budget and sets isActive=true", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "Du lịch Đà Nẵng", amount: 5_000_000 });
    expect(cb.id).toBeTruthy();
    expect(cb.name).toBe("Du lịch Đà Nẵng");
    expect(cb.amount).toBe(5_000_000);
    expect(cb.isActive).toBe(true);
  });

  it("trims whitespace from name", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "  Giải trí  ", amount: 1_000_000 });
    expect(cb.name).toBe("Giải trí");
  });

  it("rejects empty name", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createCustomBudget(db, u, { name: "  ", amount: 1_000_000 })).rejects.toThrow(CustomBudgetError);
  });

  it("rejects name longer than 100 chars", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createCustomBudget(db, u, { name: "x".repeat(101), amount: 1_000_000 })).rejects.toThrow(CustomBudgetError);
  });

  it("rejects zero or negative amount", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createCustomBudget(db, u, { name: "Bad", amount: 0 })).rejects.toThrow(CustomBudgetError);
    await expect(createCustomBudget(db, u, { name: "Bad", amount: -1000 })).rejects.toThrow(CustomBudgetError);
  });
});

describe("updateCustomBudget", () => {
  it("updates name", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "Old", amount: 1_000_000 });
    await updateCustomBudget(db, u, cb.id, { name: "New" });
    const list = await listCustomBudgets(db, u);
    expect(list.find((b) => b.id === cb.id)?.name).toBe("New");
  });

  it("updates amount", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "Budget", amount: 1_000_000 });
    await updateCustomBudget(db, u, cb.id, { amount: 3_000_000 });
    const list = await listCustomBudgets(db, u);
    expect(list.find((b) => b.id === cb.id)?.amount).toBe(3_000_000);
  });

  it("deactivates a budget", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "Budget", amount: 1_000_000 });
    await updateCustomBudget(db, u, cb.id, { isActive: false });
    const list = await listCustomBudgets(db, u);
    expect(list.find((b) => b.id === cb.id)?.isActive).toBe(false);
  });

  it("rejects update with no fields", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "Budget", amount: 1_000_000 });
    await expect(updateCustomBudget(db, u, cb.id, {})).rejects.toThrow(CustomBudgetError);
  });
});

describe("deleteCustomBudget", () => {
  it("deletes a budget with no associated transactions", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "Budget", amount: 1_000_000 });
    await deleteCustomBudget(db, u, cb.id);
    const list = await listCustomBudgets(db, u);
    expect(list.find((b) => b.id === cb.id)).toBeUndefined();
  });

  it("scrubs the budget id from associated transactions when deleted", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const parent = await createCategory(db, u, { name: "Cat", type: "expense", parentId: null });
    const leaf = await createCategory(db, u, { name: "Sub", parentId: parent.id });
    await createMonthlyBudget(db, u, { month: "2026-05", amount: 10_000_000 });
    const cb = await createCustomBudget(db, u, { name: "Trip", amount: 5_000_000 });

    const tx = await createTransaction(db, u, {
      amount: 200_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-10",
      note: null,
      customBudgetIds: [cb.id],
    });

    await deleteCustomBudget(db, u, cb.id);

    const txRef = doc(transactionsCol(db, u), tx.id);
    const txSnap = await getDoc(txRef);
    expect(txSnap.data()?.customBudgetIds).not.toContain(cb.id);
  });
});

describe("listCustomBudgets", () => {
  it("includes spent amount from associated expense transactions", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const parent = await createCategory(db, u, { name: "Cat", type: "expense", parentId: null });
    const leaf = await createCategory(db, u, { name: "Sub", parentId: parent.id });
    await createMonthlyBudget(db, u, { month: "2026-05", amount: 10_000_000 });
    const cb = await createCustomBudget(db, u, { name: "Trip", amount: 5_000_000 });

    await createTransaction(db, u, { amount: 300_000, type: "expense", categoryId: leaf.id, date: "2026-05-10", note: null, customBudgetIds: [cb.id] });
    await createTransaction(db, u, { amount: 200_000, type: "expense", categoryId: leaf.id, date: "2026-05-11", note: null, customBudgetIds: [cb.id] });

    const list = await listCustomBudgets(db, u);
    expect(list.find((b) => b.id === cb.id)?.spent).toBe(500_000);
  });

  it("shows spent=0 for a budget with no transactions", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const cb = await createCustomBudget(db, u, { name: "Unused", amount: 2_000_000 });
    const list = await listCustomBudgets(db, u);
    expect(list.find((b) => b.id === cb.id)?.spent).toBe(0);
  });

  it("activeOnly filter returns only active budgets", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const active = await createCustomBudget(db, u, { name: "Active", amount: 1_000_000 });
    const inactive = await createCustomBudget(db, u, { name: "Inactive", amount: 1_000_000 });
    await updateCustomBudget(db, u, inactive.id, { isActive: false });

    const list = await listCustomBudgets(db, u, { activeOnly: true });
    expect(list.find((b) => b.id === active.id)).toBeTruthy();
    expect(list.find((b) => b.id === inactive.id)).toBeUndefined();
  });
});
