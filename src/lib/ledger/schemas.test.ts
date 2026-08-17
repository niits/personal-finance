import { describe, expect, it } from "vitest";
import {
  expenseRequestSchema,
  initializeRequestSchema,
  movementRequestSchema,
  positionRequestSchema,
} from "./schemas";

describe("ledger request schemas", () => {
  it("rejects unknown fields and client-provided deltas", () => {
    expect(
      expenseRequestSchema.safeParse({
        amount: 10,
        categoryId: 1,
        date: "2026-08-10",
        cash_delta: -10,
      }).success,
    ).toBe(false);
  });

  it("does not coerce strings into monetary values", () => {
    expect(movementRequestSchema.safeParse({ amount: "10", date: "2026-08-10" }).success).toBe(
      false,
    );
  });

  it("validates nested initialization objects and real dates strictly", () => {
    expect(
      initializeRequestSchema.safeParse({
        ledgerStartDate: "2026-02-29",
        openingCash: 0,
        budget: {
          label: "Feb",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          plannedIncome: 100,
          savingsTarget: 0,
          spendingLimit: 100,
        },
      }).success,
    ).toBe(false);
    expect(
      initializeRequestSchema.safeParse({
        ledgerStartDate: "2026-08-01",
        openingCash: 0,
        budget: {
          label: "Aug",
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          plannedIncome: 100,
          savingsTarget: 0,
          spendingLimit: 100,
          extra: true,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects malformed allocations and position metadata", () => {
    expect(
      expenseRequestSchema.safeParse({
        amount: 10,
        categoryId: 1,
        date: "2026-08-10",
        allocations: [{ customBudgetId: "budget", amount: 0 }],
      }).success,
    ).toBe(false);
    expect(positionRequestSchema.safeParse({ name: "Card", kind: "credit_card", id: "client" }).success).toBe(
      false,
    );
  });
});
