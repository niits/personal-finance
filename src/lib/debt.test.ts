import { describe, it, expect } from "vitest";
import {
  debtOpeningTxType,
  repaymentTxType,
  computeRemaining,
  isOverdue,
} from "@/lib/debt";

// Cases trace to docs/specs/debt-tracking-tests.md §3 (UNIT-*).

describe("debtOpeningTxType / repaymentTxType (D-05, D-08)", () => {
  it("UNIT-TYPE-1: lend opens as expense, borrow opens as income", () => {
    expect(debtOpeningTxType("lend")).toBe("expense");
    expect(debtOpeningTxType("borrow")).toBe("income");
  });

  it("UNIT-TYPE-2: lend repays as income, borrow repays as expense", () => {
    expect(repaymentTxType("lend")).toBe("income");
    expect(repaymentTxType("borrow")).toBe("expense");
  });

  it("UNIT-TYPE-3: repayment type is always the inverse of the opening type", () => {
    for (const t of ["lend", "borrow"] as const) {
      expect(repaymentTxType(t)).not.toBe(debtOpeningTxType(t));
    }
  });
});

describe("computeRemaining (SRS §3.4)", () => {
  it("UNIT-CALC-1: full principal outstanding when nothing repaid", () => {
    expect(computeRemaining(1_000_000, 0)).toBe(1_000_000);
  });

  it("UNIT-CALC-2: partial repayment reduces remaining", () => {
    expect(computeRemaining(1_000_000, 400_000)).toBe(600_000);
  });

  it("UNIT-CALC-3: overpayment yields a negative remaining (D-09)", () => {
    expect(computeRemaining(1_000_000, 1_200_000)).toBe(-200_000);
  });

  it("UNIT-CALC-4: no opening transaction → remaining = -total_repaid (D-06)", () => {
    expect(computeRemaining(0, 0)).toBe(0);
    expect(computeRemaining(0, 300_000)).toBe(-300_000);
  });
});

describe("isOverdue (SRS §3.4)", () => {
  const TODAY = "2026-05-30";

  it("UNIT-OVERDUE-1: past due date + open → overdue", () => {
    expect(isOverdue("2026-05-01", "open", TODAY)).toBe(true);
  });

  it("UNIT-OVERDUE-2: past due date but settled → not overdue", () => {
    expect(isOverdue("2026-05-01", "settled", TODAY)).toBe(false);
  });

  it("UNIT-OVERDUE-3: future due date + open → not overdue", () => {
    expect(isOverdue("2026-06-15", "open", TODAY)).toBe(false);
  });

  it("UNIT-OVERDUE-4: no due date → not overdue", () => {
    expect(isOverdue(null, "open", TODAY)).toBe(false);
  });

  it("UNIT-OVERDUE-5: due date equal to today → not overdue (strict <)", () => {
    expect(isOverdue(TODAY, "open", TODAY)).toBe(false);
  });
});
