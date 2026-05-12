import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { setupTestEnvironment, authenticatedDb, assertFails, uid } from "./helpers";
import {
  createMonthlyBudget,
  getBudgetByMonth,
  adjustMonthlyBudget,
  listAdjustments,
  BudgetError,
} from "@/lib/data/monthly-budgets";
import { collection, getDocs } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupTestEnvironment(); });
afterAll(async () => { await env.cleanup(); });

describe("createMonthlyBudget", () => {
  it("creates a budget with auto-computed period dates", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2026-06", amount: 10_000_000 });
    expect(budget.id).toBeTruthy();
    expect(budget.month).toBe("2026-06");
    expect(budget.amount).toBe(10_000_000);
    // startDate and endDate are computed from the budget period
    expect(budget.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(budget.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(budget.startDate! < budget.endDate!).toBe(true);
  });

  it("rejects invalid month format", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createMonthlyBudget(db, u, { month: "2026/06", amount: 5_000_000 })).rejects.toThrow(BudgetError);
    await expect(createMonthlyBudget(db, u, { month: "2026-6", amount: 5_000_000 })).rejects.toThrow(BudgetError);
  });

  it("rejects zero or negative amount", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(createMonthlyBudget(db, u, { month: "2026-06", amount: 0 })).rejects.toThrow(BudgetError);
    await expect(createMonthlyBudget(db, u, { month: "2026-07", amount: -1 })).rejects.toThrow(BudgetError);
  });

  it("rejects duplicate month", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await createMonthlyBudget(db, u, { month: "2026-08", amount: 10_000_000 });
    await expect(createMonthlyBudget(db, u, { month: "2026-08", amount: 8_000_000 })).rejects.toThrow(BudgetError);
  });

  it("allows the same month for different users", async () => {
    const u1 = uid();
    const u2 = uid();
    await createMonthlyBudget(authenticatedDb(env, u1), u1, { month: "2026-09", amount: 10_000_000 });
    const budget = await createMonthlyBudget(authenticatedDb(env, u2), u2, { month: "2026-09", amount: 8_000_000 });
    expect(budget.id).toBeTruthy();
  });
});

describe("getBudgetByMonth", () => {
  it("returns the budget when it exists", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await createMonthlyBudget(db, u, { month: "2026-10", amount: 12_000_000 });
    const found = await getBudgetByMonth(db, u, "2026-10");
    expect(found).not.toBeNull();
    expect(found!.amount).toBe(12_000_000);
  });

  it("returns null when no budget exists for the month", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    expect(await getBudgetByMonth(db, u, "2030-01")).toBeNull();
  });
});

describe("adjustMonthlyBudget", () => {
  it("increases the budget amount and creates an adjustment record", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2026-11", amount: 10_000_000 });

    const { budget: updated, adjustment } = await adjustMonthlyBudget(db, u, budget.id, {
      delta: 2_000_000,
      note: "Thêm lương thưởng",
    });

    expect(updated.amount).toBe(12_000_000);
    expect(adjustment.delta).toBe(2_000_000);
    expect(adjustment.note).toBe("Thêm lương thưởng");
  });

  it("decreases the budget amount with a negative delta", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2026-12", amount: 10_000_000 });

    const { budget: updated } = await adjustMonthlyBudget(db, u, budget.id, {
      delta: -3_000_000,
      note: null,
    });

    expect(updated.amount).toBe(7_000_000);
  });

  it("rejects delta that would bring budget to zero or below", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2027-01", amount: 5_000_000 });
    await expect(
      adjustMonthlyBudget(db, u, budget.id, { delta: -5_000_000, note: null }),
    ).rejects.toThrow(BudgetError);
  });

  it("rejects zero delta", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2027-02", amount: 5_000_000 });
    await expect(
      adjustMonthlyBudget(db, u, budget.id, { delta: 0, note: null }),
    ).rejects.toThrow(BudgetError);
  });

  it("rejects non-existent budget", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    await expect(
      adjustMonthlyBudget(db, u, "no-such-id", { delta: 1_000_000, note: null }),
    ).rejects.toThrow(BudgetError);
  });
});

describe("listAdjustments", () => {
  it("returns adjustments in chronological order", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2027-03", amount: 10_000_000 });

    await adjustMonthlyBudget(db, u, budget.id, { delta: 1_000_000, note: "first" });
    await adjustMonthlyBudget(db, u, budget.id, { delta: 2_000_000, note: "second" });

    const adjs = await listAdjustments(db, u, budget.id);
    expect(adjs).toHaveLength(2);
    expect(adjs[0].delta).toBe(1_000_000);
    expect(adjs[1].delta).toBe(2_000_000);
  });

  it("returns empty array when no adjustments", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2027-04", amount: 10_000_000 });
    expect(await listAdjustments(db, u, budget.id)).toHaveLength(0);
  });
});

describe("security rules — monthly budgets", () => {
  it("user B cannot read user A's budgets", async () => {
    const userA = uid();
    const userB = uid();
    await createMonthlyBudget(authenticatedDb(env, userA), userA, { month: "2027-05", amount: 10_000_000 });

    const bDb = authenticatedDb(env, userB);
    const snap = getDocs(collection(bDb, "users", userA, "monthlyBudgets"));
    await assertFails(snap);
  });

  it("adjustments cannot be updated or deleted (immutable by design)", async () => {
    const u = uid();
    const db = authenticatedDb(env, u);
    const budget = await createMonthlyBudget(db, u, { month: "2027-06", amount: 10_000_000 });
    const { adjustment } = await adjustMonthlyBudget(db, u, budget.id, { delta: 1_000_000, note: null });

    const { doc, updateDoc } = await import("firebase/firestore");
    const adjRef = doc(db, "users", u, "monthlyBudgets", budget.id, "adjustments", adjustment.id);

    await assertFails(updateDoc(adjRef, { delta: 9_999_999 }));
  });
});
