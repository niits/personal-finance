import { describe, it, expect } from "vitest";
import { deriveDashboard, buildCategoryPath, getRootCategoryName } from "@/lib/derive/dashboard";
import type { Transaction, MonthlyBudget, Adjustment } from "@/lib/schema";
import type { Timestamp } from "firebase/firestore";

// Deterministic period: 2026-04-30 → 2026-05-28 (29 days), stored explicitly.
const BUDGET: MonthlyBudget = {
  id: "mb1",
  month: "2026-05",
  amount: 10_000_000,
  startDate: "2026-04-30",
  endDate: "2026-05-28",
  createdAt: {} as Timestamp,
};

const NO_ADJUSTMENTS: Adjustment[] = [];

// today = May 15, 2026 → daysElapsed = 16, daysRemaining = 13
const TODAY = new Date("2026-05-15T00:00:00Z");

function tx(overrides: Partial<Transaction> & { date: string; amount: number; type: "expense" | "income" }): Transaction {
  return {
    id: "tx-" + Math.random(),
    categoryId: "cat1",
    note: null,
    monthlyBudgetId: "mb1",
    customBudgetIds: [],
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

describe("deriveDashboard — no budget", () => {
  it("returns no_budget pace_status and null monthly_budget", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: null,
      adjustments: NO_ADJUSTMENTS,
      transactions: [],
      today: TODAY,
    });
    expect(result.pace_status).toBe("no_budget");
    expect(result.monthly_budget).toBeNull();
  });

  it("returns zero totals with no transactions", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: null,
      adjustments: NO_ADJUSTMENTS,
      transactions: [],
      today: TODAY,
    });
    expect(result.total_expense).toBe(0);
    expect(result.total_income).toBe(0);
    expect(result.savings).toBe(0);
  });
});

describe("deriveDashboard — with budget", () => {
  it("calculates correct period metadata", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [],
      today: TODAY,
    });
    expect(result.period_start).toBe("2026-04-30");
    expect(result.period_end).toBe("2026-05-28");
    expect(result.days_in_period).toBe(29);
    expect(result.days_elapsed).toBe(16);
    expect(result.days_remaining).toBe(13);
  });

  it("pace_status is under when expense < ideal", () => {
    // ideal at day 16 of 29 = round(10_000_000 * 16/29) = 5_517_241
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [tx({ date: "2026-05-10", amount: 5_000_000, type: "expense" })],
      today: TODAY,
    });
    expect(result.pace_status).toBe("under");
  });

  it("pace_status is over when expense > ideal", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [tx({ date: "2026-05-10", amount: 6_000_000, type: "expense" })],
      today: TODAY,
    });
    expect(result.pace_status).toBe("over");
  });

  it("totals and savings are correct with mixed types", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [
        tx({ date: "2026-05-02", amount: 2_000_000, type: "expense" }),
        tx({ date: "2026-05-05", amount: 500_000, type: "expense" }),
        tx({ date: "2026-05-01", amount: 15_000_000, type: "income" }),
      ],
      today: TODAY,
    });
    expect(result.total_expense).toBe(2_500_000);
    expect(result.total_income).toBe(15_000_000);
    expect(result.savings).toBe(12_500_000);
  });

  it("monthly_budget.remaining = amount - total_expense", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [tx({ date: "2026-05-10", amount: 3_000_000, type: "expense" })],
      today: TODAY,
    });
    expect(result.monthly_budget?.remaining).toBe(7_000_000);
  });

  it("excludes transactions outside the period", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [
        tx({ date: "2026-05-10", amount: 1_000_000, type: "expense" }),
        // After period end (endDate = 2026-05-28; exclusive end = 2026-05-29)
        tx({ date: "2026-05-29", amount: 9_999_999, type: "expense" }),
        // Before period start
        tx({ date: "2026-04-29", amount: 9_999_999, type: "expense" }),
      ],
      today: TODAY,
    });
    expect(result.total_expense).toBe(1_000_000);
  });

  it("groups daily_expenses by date, sorted ascending", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [
        tx({ date: "2026-05-05", amount: 300_000, type: "expense" }),
        tx({ date: "2026-05-03", amount: 100_000, type: "expense" }),
        tx({ date: "2026-05-05", amount: 200_000, type: "expense" }),
      ],
      today: TODAY,
    });
    expect(result.daily_expenses).toEqual([
      { date: "2026-05-03", amount: 100_000 },
      { date: "2026-05-05", amount: 500_000 },
    ]);
  });

  it("income does not appear in daily_expenses", () => {
    const result = deriveDashboard({
      month: "2026-05",
      budget: BUDGET,
      adjustments: NO_ADJUSTMENTS,
      transactions: [
        tx({ date: "2026-05-01", amount: 15_000_000, type: "income" }),
      ],
      today: TODAY,
    });
    expect(result.daily_expenses).toHaveLength(0);
  });
});

describe("deriveDashboard — past month", () => {
  it("daysElapsed equals days_in_period for a past month", () => {
    const pastBudget: MonthlyBudget = {
      ...BUDGET,
      id: "mb-past",
      month: "2026-01",
      startDate: "2025-12-31",
      endDate: "2026-01-29",
    };
    const result = deriveDashboard({
      month: "2026-01",
      budget: pastBudget,
      adjustments: NO_ADJUSTMENTS,
      transactions: [],
      today: TODAY, // May 15, well past Jan
    });
    expect(result.days_elapsed).toBe(result.days_in_period);
    expect(result.days_remaining).toBe(0);
  });
});

describe("buildCategoryPath", () => {
  const catMap = new Map([
    ["l1", { name: "Ăn uống", parentId: null }],
    ["l2", { name: "Ăn ngoài", parentId: "l1" }],
    ["l3", { name: "Phở bò", parentId: "l2" }],
  ]);

  it("builds full path for leaf category", () => {
    expect(buildCategoryPath("l3", catMap)).toBe("Ăn uống > Ăn ngoài > Phở bò");
  });

  it("builds single-level path for root category", () => {
    expect(buildCategoryPath("l1", catMap)).toBe("Ăn uống");
  });

  it("builds two-level path", () => {
    expect(buildCategoryPath("l2", catMap)).toBe("Ăn uống > Ăn ngoài");
  });

  it("returns empty string for unknown id", () => {
    expect(buildCategoryPath("unknown", catMap)).toBe("");
  });
});

describe("getRootCategoryName", () => {
  const catMap = new Map([
    ["l1", { name: "Đi lại", parentId: null }],
    ["l2", { name: "Xăng xe", parentId: "l1" }],
    ["l3", { name: "Xăng A95", parentId: "l2" }],
  ]);

  it("returns root name for a deep leaf", () => {
    expect(getRootCategoryName("l3", catMap)).toBe("Đi lại");
  });

  it("returns root name for a l2 category", () => {
    expect(getRootCategoryName("l2", catMap)).toBe("Đi lại");
  });

  it("returns own name for a root category", () => {
    expect(getRootCategoryName("l1", catMap)).toBe("Đi lại");
  });

  it("returns empty string for unknown id", () => {
    expect(getRootCategoryName("missing", catMap)).toBe("");
  });
});
