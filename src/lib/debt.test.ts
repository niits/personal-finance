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

  // linked_amount contract: callers pass COALESCE(linked_amount, amount) for each
  // transaction; computeRemaining itself is just arithmetic on those resolved values.

  it("UNIT-CALC-LA-1: partial opening + partial repayment → correct remaining", () => {
    // opening tx: 900k but only 300k is the debt obligation
    // repayment tx: 200k but only 150k goes toward the debt
    expect(computeRemaining(300_000, 150_000)).toBe(150_000);
  });

  it("UNIT-CALC-LA-2: partial opening, full repayments can fully settle", () => {
    // opening obligation 400k; two repayments 250k + 150k = 400k
    expect(computeRemaining(400_000, 400_000)).toBe(0);
  });

  it("UNIT-CALC-LA-3: partial opening overpaid by partial repayments", () => {
    // obligation 200k; partial repayments sum to 300k
    expect(computeRemaining(200_000, 300_000)).toBe(-100_000);
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
