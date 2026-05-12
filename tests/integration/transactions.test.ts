import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { setupTestEnvironment, authenticatedDb, uid } from "./helpers";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listTransactionsInRange,
  summarize,
  TransactionError,
} from "@/lib/data/transactions";
import { createCategory } from "@/lib/data/categories";
import { createMonthlyBudget } from "@/lib/data/monthly-budgets";
import { createCustomBudget } from "@/lib/data/custom-budgets";

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnvironment(); });
afterAll(async () => { await env.cleanup(); });

// Build a test context: one leaf expense category + monthly budget for 2026-05.
async function makeCtx(u: string) {
  const db = authenticatedDb(env, u);
  const parent = await createCategory(db, u, { name: "Ăn uống", type: "expense", parentId: null });
  const leaf = await createCategory(db, u, { name: "Ăn ngoài", parentId: parent.id });
  const incRoot = await createCategory(db, u, { name: "Thu nhập", type: "income", parentId: null });
  const incLeaf = await createCategory(db, u, { name: "Lương", parentId: incRoot.id });
  const budget = await createMonthlyBudget(db, u, { month: "2026-05", amount: 10_000_000 });
  return { db, parent, leaf, incLeaf, budget };
}

describe("createTransaction — expense", () => {
  it("creates an expense linked to the monthly budget", async () => {
    const u = uid();
    const { db, leaf, budget } = await makeCtx(u);
    const tx = await createTransaction(db, u, {
      amount: 100_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-10",
      note: "Bữa trưa",
    });
    expect(tx.id).toBeTruthy();
    expect(tx.amount).toBe(100_000);
    expect(tx.type).toBe("expense");
    expect(tx.monthlyBudgetId).toBe(budget.id);
    expect(tx.note).toBe("Bữa trưa");
  });

  it("creates an expense with custom budgets", async () => {
    const u = uid();
    const { db, leaf } = await makeCtx(u);
    const cb = await createCustomBudget(db, u, { name: "Du lịch Đà Nẵng", amount: 5_000_000 });
    const tx = await createTransaction(db, u, {
      amount: 500_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-15",
      note: null,
      customBudgetIds: [cb.id],
    });
    expect(tx.customBudgetIds).toContain(cb.id);
  });

  it("rejects expense when no monthly budget exists for the date", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const parent = await createCategory(db, u, { name: "Cat", type: "expense", parentId: null });
    const leaf = await createCategory(db, u, { name: "Sub", parentId: parent.id });
    // No budget created for 2027-01
    await expect(
      createTransaction(db, u, {
        amount: 100_000,
        type: "expense",
        categoryId: leaf.id,
        date: "2027-01-10",
        note: null,
      }),
    ).rejects.toThrow(TransactionError);
  });

  it("rejects expense linked to a non-leaf (parent) category", async () => {
    const u = uid();
    const { db, parent } = await makeCtx(u);
    await expect(
      createTransaction(db, u, {
        amount: 100_000,
        type: "expense",
        categoryId: parent.id,
        date: "2026-05-10",
        note: null,
      }),
    ).rejects.toThrow(TransactionError);
  });

  it("rejects non-existent category", async () => {
    const u = uid();
    const { db } = await makeCtx(u);
    await expect(
      createTransaction(db, u, {
        amount: 100_000,
        type: "expense",
        categoryId: "no-such-cat",
        date: "2026-05-10",
        note: null,
      }),
    ).rejects.toThrow(TransactionError);
  });

  it("rejects zero or negative amount", async () => {
    const u = uid();
    const { db, leaf } = await makeCtx(u);
    await expect(
      createTransaction(db, u, { amount: 0, type: "expense", categoryId: leaf.id, date: "2026-05-10", note: null }),
    ).rejects.toThrow(TransactionError);
  });
});

describe("createTransaction — income", () => {
  it("creates an income with no monthly budget link", async () => {
    const u = uid();
    const { db, incLeaf } = await makeCtx(u);
    const tx = await createTransaction(db, u, {
      amount: 15_000_000,
      type: "income",
      categoryId: incLeaf.id,
      date: "2026-05-01",
      note: "Lương tháng 5",
    });
    expect(tx.type).toBe("income");
    expect(tx.monthlyBudgetId).toBeNull();
    expect(tx.customBudgetIds).toHaveLength(0);
  });

  it("rejects income with custom budget ids", async () => {
    const u = uid();
    const { db, incLeaf } = await makeCtx(u);
    const cb = await createCustomBudget(db, u, { name: "Custom", amount: 1_000_000 });
    await expect(
      createTransaction(db, u, {
        amount: 500_000,
        type: "income",
        categoryId: incLeaf.id,
        date: "2026-05-01",
        note: null,
        customBudgetIds: [cb.id],
      }),
    ).rejects.toThrow(TransactionError);
  });
});

describe("updateTransaction", () => {
  it("updates the amount", async () => {
    const u = uid();
    const { db, leaf } = await makeCtx(u);
    const tx = await createTransaction(db, u, {
      amount: 100_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-10",
      note: null,
    });
    const updated = await updateTransaction(db, u, tx.id, { amount: 200_000 });
    expect(updated.amount).toBe(200_000);
  });

  it("updates the note", async () => {
    const u = uid();
    const { db, leaf } = await makeCtx(u);
    const tx = await createTransaction(db, u, {
      amount: 100_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-10",
      note: null,
    });
    const updated = await updateTransaction(db, u, tx.id, { note: "Bữa tối" });
    expect(updated.note).toBe("Bữa tối");
  });

  it("re-links to a new monthly budget when the date changes to a different month", async () => {
    const u = uid();
    const { db, leaf } = await makeCtx(u);
    // Create a second budget for 2026-06.
    const budget2 = await createMonthlyBudget(db, u, { month: "2026-06", amount: 10_000_000 });
    const tx = await createTransaction(db, u, {
      amount: 100_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-10",
      note: null,
    });
    const updated = await updateTransaction(db, u, tx.id, { date: "2026-06-10" });
    expect(updated.monthlyBudgetId).toBe(budget2.id);
  });

  it("clears monthly budget link when changing type expense→income", async () => {
    const u = uid();
    const { db, leaf, incLeaf } = await makeCtx(u);
    const tx = await createTransaction(db, u, {
      amount: 100_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-10",
      note: null,
    });
    const updated = await updateTransaction(db, u, tx.id, { type: "income", categoryId: incLeaf.id });
    expect(updated.monthlyBudgetId).toBeNull();
  });

  it("rejects update on non-existent transaction", async () => {
    const u = uid();
    const { db } = await makeCtx(u);
    await expect(updateTransaction(db, u, "no-such-id", { amount: 500_000 })).rejects.toThrow(TransactionError);
  });
});

describe("deleteTransaction", () => {
  it("deletes an existing transaction", async () => {
    const u = uid();
    const { db, leaf } = await makeCtx(u);
    const tx = await createTransaction(db, u, {
      amount: 100_000,
      type: "expense",
      categoryId: leaf.id,
      date: "2026-05-10",
      note: null,
    });
    await deleteTransaction(db, u, tx.id);
    const list = await listTransactionsInRange(db, u, "2026-05-01", "2026-05-31");
    expect(list.find((t) => t.id === tx.id)).toBeUndefined();
  });

  it("rejects deleting a non-existent transaction", async () => {
    const u = uid();
    const { db } = await makeCtx(u);
    await expect(deleteTransaction(db, u, "no-such-id")).rejects.toThrow(TransactionError);
  });
});

describe("listTransactionsInRange", () => {
  it("returns transactions in the given date range, sorted descending", async () => {
    const u = uid();
    const { db, leaf, incLeaf } = await makeCtx(u);
    await createMonthlyBudget(db, u, { month: "2026-06", amount: 10_000_000 });

    const t1 = await createTransaction(db, u, { amount: 100_000, type: "expense", categoryId: leaf.id, date: "2026-05-03", note: null });
    const t2 = await createTransaction(db, u, { amount: 200_000, type: "expense", categoryId: leaf.id, date: "2026-05-15", note: null });
    const t3 = await createTransaction(db, u, { amount: 300_000, type: "expense", categoryId: leaf.id, date: "2026-06-01", note: null });

    const may = await listTransactionsInRange(db, u, "2026-05-01", "2026-05-31");
    const ids = may.map((t) => t.id);
    expect(ids).toContain(t1.id);
    expect(ids).toContain(t2.id);
    expect(ids).not.toContain(t3.id);
  });

  it("filters by type", async () => {
    const u = uid();
    const { db, leaf, incLeaf } = await makeCtx(u);
    await createTransaction(db, u, { amount: 100_000, type: "expense", categoryId: leaf.id, date: "2026-05-10", note: null });
    await createTransaction(db, u, { amount: 15_000_000, type: "income", categoryId: incLeaf.id, date: "2026-05-01", note: null });

    const expenses = await listTransactionsInRange(db, u, "2026-05-01", "2026-05-31", { type: "expense" });
    expect(expenses.every((t) => t.type === "expense")).toBe(true);
    expect(expenses).toHaveLength(1);
  });

  it("filters by categoryId", async () => {
    const u = uid();
    const { db, leaf, incLeaf } = await makeCtx(u);
    await createTransaction(db, u, { amount: 100_000, type: "expense", categoryId: leaf.id, date: "2026-05-10", note: null });
    const incTx = await createTransaction(db, u, { amount: 15_000_000, type: "income", categoryId: incLeaf.id, date: "2026-05-01", note: null });

    const byCat = await listTransactionsInRange(db, u, "2026-05-01", "2026-05-31", { categoryId: incLeaf.id });
    expect(byCat.every((t) => t.id === incTx.id)).toBe(true);
  });

  it("returns empty when no transactions in range", async () => {
    const u = uid();
    const { db } = await makeCtx(u);
    const list = await listTransactionsInRange(db, u, "2020-01-01", "2020-01-31");
    expect(list).toHaveLength(0);
  });
});

describe("summarize", () => {
  it("sums expenses and incomes correctly", () => {
    const fakeTx = (type: "expense" | "income", amount: number) => ({
      id: "x",
      amount,
      type,
      categoryId: "c",
      note: null,
      date: "2026-05-01",
      monthlyBudgetId: null,
      customBudgetIds: [],
      createdAt: {} as any,
      updatedAt: {} as any,
    });

    const result = summarize([
      fakeTx("expense", 100_000),
      fakeTx("expense", 200_000),
      fakeTx("income", 500_000),
    ]);

    expect(result.total_expense).toBe(300_000);
    expect(result.total_income).toBe(500_000);
    expect(result.savings).toBe(200_000);
  });

  it("returns zeros for empty list", () => {
    const result = summarize([]);
    expect(result.total_expense).toBe(0);
    expect(result.total_income).toBe(0);
    expect(result.savings).toBe(0);
  });
});
