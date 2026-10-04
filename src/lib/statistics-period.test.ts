import { describe, expect, it } from "vitest";
import { reportEndDate } from "./statistics-period";

describe("reportEndDate", () => {
  it("includes transactions dated today in an active period", () => {
    expect(reportEndDate("2026-10-29", "2026-10-04")).toBe("2026-10-04");
  });

  it("stops at the stored end date for a completed period", () => {
    expect(reportEndDate("2026-09-29", "2026-10-04")).toBe("2026-09-29");
  });
});
