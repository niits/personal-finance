import { describe, it, expect } from "vitest";
import { parseAmount, parseDate, parseMonth, getMonthFromDate } from "@/lib/validators";

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
