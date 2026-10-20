import { describe, expect, it } from "vitest";
import { financeAccountScope, matchesFinanceAccountScope } from "./finance-account-scope";

const families = [
  { type: "debt", debt_direction: "lend" },
  { type: "debt", debt_direction: "borrow" },
  { type: "savings", debt_direction: null },
] as const;

// Contract: docs/product/behavior/transactions.md, Debt And Savings Movements.
describe("Finance account compatibility", () => {
  it.each([
    ["lend", 0, "Tài khoản cho vay"],
    ["debt_collection", 0, "Tài khoản cho vay"],
    ["borrow", 1, "Tài khoản đi vay"],
    ["debt_repayment", 1, "Tài khoản đi vay"],
    ["savings_deposit", 2, "Tài khoản tiền gửi"],
    ["savings_withdrawal", 2, "Tài khoản tiền gửi"],
  ] as const)("restricts %s to the correct family", (kind, index, label) => {
    const scope = financeAccountScope(kind);
    expect(scope).toEqual({ ...families[index], label });
    expect(families.map((account) => matchesFinanceAccountScope(account, scope)))
      .toEqual(families.map((_, familyIndex) => familyIndex === index));
  });

  it.each([null, undefined, "consumption", "unknown"])("does not infer a family for %s", (kind) => {
    const scope = financeAccountScope(kind);
    expect(scope).toBeNull();
    expect(families.every((account) => !matchesFinanceAccountScope(account, scope))).toBe(true);
  });
});
