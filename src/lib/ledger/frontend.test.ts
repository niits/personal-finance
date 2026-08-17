import { describe, expect, it } from "vitest";
import {
  calendarMonthDefaults,
  flattenLeafCategories,
  mergeEventPage,
  validatePeriodAdjustment,
  validatePeriodDraft,
} from "./frontend";
import type { FinancialEventDto } from "./contracts";

const event = (id: string): FinancialEventDto => ({
  id,
  kind: "expense_cash",
  amount: 100,
  remainingRefundableAmount: 100,
  date: "2026-08-17",
  note: null,
  category: null,
  position: null,
  allocations: [],
  reversal: { reversesEventId: null, reversedByEventId: null, relatedEventId: null },
  effects: { cash: -100, position: 0, income: 0, expense: 100, equity: 0 },
  activity: { type: "expense", label: "Expense", actions: { canRefund: true, canReverse: true } },
});

describe("ledger frontend plan validation", () => {
  const period = {
    plannedIncome: 10_000,
    savingsTarget: 2_000,
    spendingLimit: 8_000,
  };

  it("accepts a nonnegative balanced period draft", () => {
    expect(validatePeriodDraft({
      label: "August",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      ...period,
      objective: null,
    })).toBeNull();
  });

  it("rejects invalid dates, negative values, and overcommitted plans", () => {
    expect(validatePeriodDraft({
      label: "February",
      startDate: "2026-02-01",
      endDate: "2026-02-30",
      ...period,
      objective: null,
    })).toMatch(/ngày/i);
    expect(validatePeriodDraft({
      label: "August",
      startDate: "2026-09-01",
      endDate: "2026-08-31",
      plannedIncome: 10_000,
      savingsTarget: 2_000,
      spendingLimit: 8_001,
      objective: null,
    })).toMatch(/ngày/i);
    expect(validatePeriodDraft({
      label: "August",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      plannedIncome: -1,
      savingsTarget: 0,
      spendingLimit: 0,
      objective: null,
    })).toMatch(/không âm/i);
    expect(validatePeriodDraft({
      label: "August",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      plannedIncome: 10_000,
      savingsTarget: 2_000,
      spendingLimit: 8_001,
      objective: null,
    })).toMatch(/vượt thu nhập/i);
  });

  it("rejects adjustments that make an effective value negative or overcommit income", () => {
    expect(validatePeriodAdjustment(period, "savings_target", -2_001)).toMatch(/không âm/i);
    expect(validatePeriodAdjustment(period, "spending_limit", 1)).toMatch(/vượt thu nhập/i);
    expect(validatePeriodAdjustment(period, "planned_income", -1)).toMatch(/vượt thu nhập/i);
    expect(validatePeriodAdjustment(period, "planned_income", 1_000)).toBeNull();
  });
});

describe("ledger calendar defaults", () => {
  it("builds month boundaries without converting local dates through UTC", () => {
    expect(calendarMonthDefaults(new Date(2026, 1, 10, 23, 30))).toEqual({
      label: "Tháng 2/2026",
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(calendarMonthDefaults(new Date(2028, 1, 1))).toMatchObject({ end: "2028-02-29" });
  });
});

describe("ledger category and feed presentation", () => {
  it("returns only leaf categories and preserves their hierarchy labels", () => {
    expect(flattenLeafCategories([
      {
        id: 1,
        name: "Chi tiêu",
        emoji: null,
        type: "expense",
        children: [
          { id: 2, name: "Ăn uống", emoji: "🍜", type: "expense", children: [] },
          {
            id: 3,
            name: "Đi lại",
            emoji: null,
            type: "expense",
            children: [
              { id: 4, name: "Taxi", emoji: "🚕", type: "expense", children: [] },
            ],
          },
        ],
      },
    ])).toEqual([
      { id: 2, name: "Ăn uống", label: "Chi tiêu › Ăn uống", emoji: "🍜", type: "expense" },
      { id: 4, name: "Taxi", label: "Chi tiêu › Đi lại › Taxi", emoji: "🚕", type: "expense" },
    ]);
  });

  it("appends cursor pages without duplicate financial events", () => {
    expect(mergeEventPage([event("3"), event("2")], [event("2"), event("1")]).map((item) => item.id))
      .toEqual(["3", "2", "1"]);
  });
});
