import { describe, it, expect } from "vitest";
import { isHoliday } from "@/lib/holidays";

describe("isHoliday — known years", () => {
  it("returns true for Tết Dương lịch (2026-01-01)", () => {
    expect(isHoliday("2026-01-01")).toBe(true);
  });

  it("returns true for Ngày Giải phóng miền Nam (2026-04-30)", () => {
    expect(isHoliday("2026-04-30")).toBe(true);
  });

  it("returns true for Quốc tế Lao động (2026-05-01)", () => {
    expect(isHoliday("2026-05-01")).toBe(true);
  });

  it("returns true for Quốc khánh (2026-09-02)", () => {
    expect(isHoliday("2026-09-02")).toBe(true);
  });

  it("returns true for Tết Nguyên Đán days (2026-02-16 to 2026-02-20)", () => {
    expect(isHoliday("2026-02-16")).toBe(true);
    expect(isHoliday("2026-02-17")).toBe(true);
    expect(isHoliday("2026-02-18")).toBe(true);
    expect(isHoliday("2026-02-19")).toBe(true);
    expect(isHoliday("2026-02-20")).toBe(true);
  });

  it("returns true for compensatory holiday (2026-04-27 Giỗ Tổ Hùng Vương)", () => {
    expect(isHoliday("2026-04-27")).toBe(true);
  });

  it("returns false for a regular weekday (2026-03-16)", () => {
    expect(isHoliday("2026-03-16")).toBe(false);
  });

  it("returns false for the day before a holiday (2026-04-29)", () => {
    expect(isHoliday("2026-04-29")).toBe(false);
  });

  it("returns false for the day after a holiday (2026-05-02)", () => {
    expect(isHoliday("2026-05-02")).toBe(false);
  });

  it("handles 2024 holidays correctly", () => {
    expect(isHoliday("2024-04-30")).toBe(true);
    expect(isHoliday("2024-05-01")).toBe(true);
    expect(isHoliday("2024-09-02")).toBe(true);
    expect(isHoliday("2024-09-03")).toBe(true); // compensatory
  });

  it("handles 2025 holidays correctly", () => {
    expect(isHoliday("2025-04-30")).toBe(true);
    expect(isHoliday("2025-05-01")).toBe(true);
    expect(isHoliday("2025-09-02")).toBe(true);
  });
});

describe("isHoliday — fallback for unknown years", () => {
  // 2030 is not in the HOLIDAYS map, so it falls back to FIXED_MMDD.
  it("returns true for 01-01 in unknown year", () => {
    expect(isHoliday("2030-01-01")).toBe(true);
  });

  it("returns true for 04-30 in unknown year", () => {
    expect(isHoliday("2030-04-30")).toBe(true);
  });

  it("returns true for 05-01 in unknown year", () => {
    expect(isHoliday("2030-05-01")).toBe(true);
  });

  it("returns true for 09-02 in unknown year", () => {
    expect(isHoliday("2030-09-02")).toBe(true);
  });

  it("returns true for 09-03 in unknown year", () => {
    expect(isHoliday("2030-09-03")).toBe(true);
  });

  it("returns false for compensatory days in unknown year (not in FIXED_MMDD)", () => {
    // Compensatory/make-up days vary year-to-year, so they're NOT in the fallback set.
    expect(isHoliday("2030-04-27")).toBe(false);
    expect(isHoliday("2030-09-01")).toBe(false);
  });

  it("returns false for a regular day in unknown year", () => {
    expect(isHoliday("2030-06-15")).toBe(false);
  });
});
