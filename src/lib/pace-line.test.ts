import { describe, it, expect } from "vitest";
import {
  idealBudgetAtDay,
  isOverPace,
  getDaysInMonth,
  buildIdealLine,
  buildActualLine,
} from "@/lib/pace-line";

describe("idealBudgetAtDay", () => {
  it("returns 0 at day 0", () => {
    expect(idealBudgetAtDay({ budget: 3_000_000, daysInMonth: 30, day: 0 })).toBe(0);
  });

  it("returns full budget at last day", () => {
    expect(idealBudgetAtDay({ budget: 3_000_000, daysInMonth: 30, day: 30 })).toBe(3_000_000);
  });

  it("returns proportional value mid-month", () => {
    expect(idealBudgetAtDay({ budget: 3_000_000, daysInMonth: 30, day: 15 })).toBe(1_500_000);
  });

  it("rounds to nearest integer", () => {
    const result = idealBudgetAtDay({ budget: 10_000_000, daysInMonth: 31, day: 1 });
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("isOverPace", () => {
  it("returns false when actual < ideal", () => {
    expect(isOverPace({ actual: 800_000, ideal: 1_000_000 })).toBe(false);
  });

  it("returns false when actual equals ideal", () => {
    expect(isOverPace({ actual: 1_000_000, ideal: 1_000_000 })).toBe(false);
  });

  it("returns true when actual > ideal", () => {
    expect(isOverPace({ actual: 1_200_000, ideal: 1_000_000 })).toBe(true);
  });
});

describe("getDaysInMonth", () => {
  it("returns 31 for January", () => expect(getDaysInMonth(2026, 1)).toBe(31));
  it("returns 28 for Feb 2025 (non-leap)", () => expect(getDaysInMonth(2025, 2)).toBe(28));
  it("returns 29 for Feb 2024 (leap year)", () => expect(getDaysInMonth(2024, 2)).toBe(29));
  it("returns 30 for April", () => expect(getDaysInMonth(2026, 4)).toBe(30));
});

describe("buildIdealLine", () => {
  it("has daysInMonth points", () => {
    const line = buildIdealLine(3_000_000, 30);
    expect(line).toHaveLength(30);
  });

  it("first point is day 1", () => {
    const line = buildIdealLine(3_000_000, 30);
    expect(line[0].day).toBe(1);
  });

  it("last point equals budget", () => {
    const line = buildIdealLine(3_000_000, 30);
    expect(line[29].amount).toBe(3_000_000);
  });

  it("is monotonically increasing", () => {
    const line = buildIdealLine(3_000_000, 30);
    for (let i = 1; i < line.length; i++) {
      expect(line[i].amount).toBeGreaterThanOrEqual(line[i - 1].amount);
    }
  });
});

describe("buildActualLine", () => {
  it("returns empty for day 0", () => {
    expect(buildActualLine(new Map(), 0)).toHaveLength(0);
  });

  it("accumulates correctly", () => {
    const expenses = new Map([
      [1, 100_000],
      [3, 200_000],
    ]);
    const line = buildActualLine(expenses, 4);
    expect(line).toEqual([
      { day: 1, amount: 100_000 },
      { day: 2, amount: 100_000 },
      { day: 3, amount: 300_000 },
      { day: 4, amount: 300_000 },
    ]);
  });

  it("zero for days with no expenses", () => {
    const line = buildActualLine(new Map(), 3);
    expect(line).toEqual([
      { day: 1, amount: 0 },
      { day: 2, amount: 0 },
      { day: 3, amount: 0 },
    ]);
  });
});
