import { describe, expect, it } from "vitest";
import { isPaidStatement, statementPeriodForDate } from "@/lib/credit-cards";

describe("statementPeriodForDate", () => {
  it("keeps purchases before close day in the statement closing that month", () => {
    expect(statementPeriodForDate("2026-08-10", 15)).toEqual({ start: "2026-07-15", end: "2026-08-15" });
  });

  it("moves purchases on close day into the next statement", () => {
    expect(statementPeriodForDate("2026-08-15", 15)).toEqual({ start: "2026-08-15", end: "2026-09-15" });
  });
});

describe("isPaidStatement", () => {
  it("requires payment metadata for a paid statement", () => {
    expect(isPaidStatement("paid", "2026-08-20")).toBe(true);
    expect(isPaidStatement("unpaid", null)).toBe(false);
  });
});
