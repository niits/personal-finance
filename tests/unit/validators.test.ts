import { describe, it, expect } from "vitest";
import {
  parseAmount,
  parseDate,
  parseMonth,
  getMonthFromDate,
  getBudgetMonthForDate,
  getBudgetPeriod,
  getBudgetPeriodInclusive,
  lastWorkingDay,
} from "@/lib/validators";

describe("parseAmount", () => {
  it("accepts positive integers", () => expect(parseAmount(50000)).toBe(50000));
  it("accepts numeric string", () => expect(parseAmount("50000")).toBe(50000));
  it("rejects 0", () => expect(parseAmount(0)).toBeNull());
  it("rejects negative", () => expect(parseAmount(-1000)).toBeNull());
  it("rejects decimal", () => expect(parseAmount(1500.5)).toBeNull());
  it("rejects null", () => expect(parseAmount(null)).toBeNull());
  it("rejects undefined", () => expect(parseAmount(undefined)).toBeNull());
  it("rejects empty string", () => expect(parseAmount("")).toBeNull());
  it("rejects non-numeric string", () => expect(parseAmount("abc")).toBeNull());
});

describe("parseDate", () => {
  it("accepts valid date", () => expect(parseDate("2026-04-29")).toBe("2026-04-29"));
  it("rejects wrong format (DD-MM-YYYY)", () => expect(parseDate("29-04-2026")).toBeNull());
  it("rejects partial date", () => expect(parseDate("2026-04")).toBeNull());
  it("rejects non-string", () => expect(parseDate(20260429)).toBeNull());
  it("rejects invalid month 13", () => expect(parseDate("2026-13-01")).toBeNull());
  it("rejects invalid day 32", () => expect(parseDate("2026-01-32")).toBeNull());
});

describe("parseMonth", () => {
  it("accepts valid month", () => expect(parseMonth("2026-04")).toBe("2026-04"));
  it("rejects full date string", () => expect(parseMonth("2026-04-29")).toBeNull());
  it("rejects wrong format", () => expect(parseMonth("04-2026")).toBeNull());
  it("rejects non-string", () => expect(parseMonth(202604)).toBeNull());
});

describe("getMonthFromDate", () => {
  it("extracts month from date", () => {
    expect(getMonthFromDate("2026-04-29")).toBe("2026-04");
  });

  it("works for first day of month", () => {
    expect(getMonthFromDate("2026-01-01")).toBe("2026-01");
  });
});

describe("lastWorkingDay", () => {
  // May 2026: May 31 = Sunday, May 30 = Saturday → last working day = Friday May 29.
  it("skips Saturday and Sunday at end of May 2026", () => {
    expect(lastWorkingDay(2026, 5)).toBe("2026-05-29");
  });

  // June 2026: June 30 is a Tuesday → last working day = Tuesday June 30.
  it("returns the last calendar day when it is a weekday", () => {
    expect(lastWorkingDay(2026, 6)).toBe("2026-06-30");
  });

  // April 2026: April 30 = national holiday (Reunification Day), April 29 = Wednesday.
  it("skips national holidays (April 2026 — 30/4 is a holiday)", () => {
    expect(lastWorkingDay(2026, 4)).toBe("2026-04-29");
  });
});

describe("getBudgetMonthForDate", () => {
  // May 2026 last working day = 2026-05-29.
  // Dates before that → budget month stays "2026-05".
  // Dates on or after that → budget month becomes "2026-06" (next month's salary period).

  it("returns the same month for a mid-month date", () => {
    expect(getBudgetMonthForDate("2026-05-15")).toBe("2026-05");
  });

  it("returns the same month for the day before the last working day", () => {
    expect(getBudgetMonthForDate("2026-05-28")).toBe("2026-05");
  });

  it("returns the NEXT month for the last working day itself", () => {
    expect(getBudgetMonthForDate("2026-05-29")).toBe("2026-06");
  });

  it("returns the NEXT month for dates after the last working day", () => {
    // May 30 and 31 are weekend — still belong to next month's budget.
    expect(getBudgetMonthForDate("2026-05-30")).toBe("2026-06");
    expect(getBudgetMonthForDate("2026-05-31")).toBe("2026-06");
  });
});

describe("getBudgetPeriod", () => {
  // 2026-05 budget period:
  //   start = last working day of April 2026 = 2026-04-29 (Wednesday)
  //           30/4 is Reunification Day (national holiday), so it is skipped
  //   end   = last working day of May 2026   = 2026-05-29 (exclusive end)
  it("returns correct start and end for 2026-05", () => {
    const { start, end } = getBudgetPeriod("2026-05");
    expect(start).toBe("2026-04-29");
    expect(end).toBe("2026-05-29");
  });

  it("start is always before end", () => {
    const { start, end } = getBudgetPeriod("2026-07");
    expect(start < end).toBe(true);
  });
});

describe("getBudgetPeriodInclusive", () => {
  // The inclusive end is one day BEFORE the exclusive end.
  it("end_date is the day before getBudgetPeriod end", () => {
    const { end } = getBudgetPeriod("2026-05");
    const { end_date } = getBudgetPeriodInclusive("2026-05");
    const exclusive = new Date(end + "T00:00:00Z");
    const inclusive = new Date(end_date + "T00:00:00Z");
    expect(exclusive.getTime() - inclusive.getTime()).toBe(86_400_000);
  });

  it("start_date matches getBudgetPeriod start", () => {
    expect(getBudgetPeriodInclusive("2026-05").start_date).toBe(getBudgetPeriod("2026-05").start);
  });
});
