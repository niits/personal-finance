import { describe, expect, it } from "vitest";
import { financeCounterpart, financeReduction } from "./finance-counterpart";

// Contract: docs/product/behavior/transactions.md, Debt And Savings Movements.
describe("Finance counterpart defaults", () => {
  it.each([
    ["debt", "lend", "expense", "income", "debt_collection", "Nhận tiền trả nợ"],
    ["debt", "borrow", "income", "expense", "debt_repayment", "Trả nợ"],
    ["debt", "lend", "income", "expense", "lend", "Cho vay"],
    ["debt", "borrow", "expense", "income", "borrow", "Nhận tiền vay"],
    ["savings", null, "expense", "income", "savings_withdrawal", "Rút tiền gửi"],
    ["savings", null, "income", "expense", "savings_deposit", "Gửi tiền"],
  ] as const)("maps %s %s %s to %s %s", (accountType, direction, sourceType, type, systemKind, label) => {
    const account = Object.freeze({ id: "account-1", name: "Tài khoản", type: accountType, debt_direction: direction });
    const source = Object.freeze({ amount: 2500000, type: sourceType });
    expect(financeCounterpart(account, source)).toEqual({
      account: { id: account.id, name: account.name }, amount: source.amount, type, systemKind, label,
    });
  });
});

describe("Finance balance reductions", () => {
  it.each([
    ["savings", null, -1500000, "savings_withdrawal"],
    ["debt", "lend", -1500000, "debt_collection"],
    ["debt", "borrow", 1500000, "debt_repayment"],
  ] as const)("reduces the remaining balance for %s %s", (type, debt_direction, balance, systemKind) => {
    expect(financeReduction({ id: "account", name: "Tài khoản", type, debt_direction, balance }))
      .toMatchObject({ amount: 1500000, systemKind });
  });

  it.each([
    ["savings", null, 0], ["savings", null, 500000],
    ["debt", "lend", 0], ["debt", "lend", 500000],
    ["debt", "borrow", 0], ["debt", "borrow", -500000],
  ] as const)("does not offer another reduction for a settled or reverse balance", (type, debt_direction, balance) => {
    expect(financeReduction({ id: "account", name: "Tài khoản", type, debt_direction, balance })).toBeNull();
  });
});
