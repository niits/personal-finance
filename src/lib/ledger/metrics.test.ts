import { describe, expect, it } from "vitest";
import { constructEvent, constructReversal } from "./events";
import {
  calculateBalances,
  calculateEnvelopeMetrics,
  calculatePeriodMetrics,
  calculateSafeToSpend,
  effectiveValue,
} from "./metrics";

const date = "2026-08-10";

describe("committed-event metrics", () => {
  const committedEvents = [
    { ...constructEvent({ type: "open_cash" as const, amount: 1_000, date }), id: "cash" },
    {
      ...constructEvent({
        type: "open_position" as const,
        balance: -200,
        positionId: "card",
        date,
      }),
      id: "card-opening",
    },
    {
      ...constructEvent({
        type: "record_income" as const,
        amount: 500,
        categoryId: 1,
        date,
      }),
      id: "income",
    },
    {
      ...constructEvent({
        type: "record_expense" as const,
        amount: 300,
        categoryId: 2,
        budgetPeriodId: 7,
        payment: { medium: "cash" as const },
        date,
      }),
      id: "expense",
    },
    {
      ...constructEvent({
        type: "move_position" as const,
        amount: 50,
        positionId: "card",
        direction: "cash_to_position" as const,
        date,
      }),
      id: "payment",
    },
  ];

  it("derives cash, position balances, and net worth without treating principal as operating activity", () => {
    expect(calculateBalances(committedEvents, "2026-08-31")).toEqual({
      cashBalance: 1_150,
      positionBalances: { card: -150 },
      netWorth: 1_000,
    });
  });

  it("derives period income, expense, savings, rate, and target gap", () => {
    expect(
      calculatePeriodMetrics(committedEvents, {
        budgetPeriodId: 7,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        asOf: "2026-08-31",
        savingsTarget: 250,
      }),
    ).toEqual({
      income: 500,
      expense: 300,
      actualSavings: 200,
      savingsRate: 0.4,
      savingsTargetGap: 50,
    });
  });

  it("nets exact reversals out of every metric", () => {
    const expense = committedEvents[3];
    const events = [...committedEvents, constructReversal(expense)];

    expect(
      calculatePeriodMetrics(events, {
        budgetPeriodId: 7,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        asOf: "2026-08-31",
        savingsTarget: 250,
      }).expense,
    ).toBe(0);
  });

  it("rejects an invalid asOf date before comparing event dates", () => {
    expect(() => calculateBalances(committedEvents, "2026-02-29")).toThrow(
      "As-of date must be a real canonical YYYY-MM-DD date: 2026-02-29",
    );
  });

  it("rejects invalid period dates before comparing them", () => {
    expect(() =>
      calculatePeriodMetrics(committedEvents, {
        budgetPeriodId: 7,
        startDate: "2026-08-01",
        endDate: "2026-09-31",
        asOf: "2026-08-31",
        savingsTarget: 250,
      }),
    ).toThrow("Period end date must be a real canonical YYYY-MM-DD date: 2026-09-31");
  });

  it("rejects invalid recorded event dates before comparing them", () => {
    const corrupt = [{ ...committedEvents[0], date: "2026-8-10" }];

    expect(() => calculateBalances(corrupt, "2026-08-31")).toThrow(
      "Event date must be a real canonical YYYY-MM-DD date: 2026-8-10",
    );
  });

  it("rejects aggregate balances outside Number safe range", () => {
    const event = constructEvent({
      type: "open_cash",
      amount: Number.MAX_SAFE_INTEGER,
      date,
    });

    expect(() => calculateBalances([event, event], "2026-08-31")).toThrow(
      "Cash balance is outside Number safe range",
    );
  });
});

describe("effectiveValue", () => {
  it("adds append-only adjustment deltas to the initial value", () => {
    expect(effectiveValue(1_000, [200, -50])).toBe(1_150);
  });

  it("rejects an effective value outside Number safe range", () => {
    expect(() => effectiveValue(Number.MAX_SAFE_INTEGER, [1])).toThrow(
      "Effective value is outside Number safe range",
    );
  });
});

describe("calculateSafeToSpend", () => {
  it("uses negative reserved payables and the lower of cash commitments and budget remaining", () => {
    expect(
      calculateSafeToSpend({
        cashBalance: 1_000,
        positions: [
          { balance: -300, reserveAgainstCash: true },
          { balance: -400, reserveAgainstCash: false },
          { balance: 200, reserveAgainstCash: true },
        ],
        minimumCashReserve: 100,
        spendingLimit: 900,
        periodExpense: 250,
      }),
    ).toEqual({
      reservedPayables: -300,
      cashAfterCommitments: 600,
      budgetRemaining: 650,
      safeToSpend: 600,
    });
  });

  it("returns null without an active budget", () => {
    expect(
      calculateSafeToSpend({
        cashBalance: 1_000,
        positions: [],
        minimumCashReserve: 100,
        spendingLimit: null,
        periodExpense: 0,
      }).safeToSpend,
    ).toBeNull();
  });
});

describe("calculateEnvelopeMetrics", () => {
  it("reconciles period remaining with unassigned plus every custom remaining", () => {
    expect(
      calculateEnvelopeMetrics({
        spendingLimit: 1_000,
        periodExpense: 500,
        customEnvelopes: [
          { effectiveAmount: 300, spent: 250 },
          { effectiveAmount: 200, spent: 100 },
        ],
      }),
    ).toEqual({
      periodRemaining: 500,
      periodUnallocatedExpense: 150,
      periodUnassignedRemaining: 350,
      customRemaining: [50, 100],
    });
  });
});
