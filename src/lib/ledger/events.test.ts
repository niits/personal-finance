import { describe, expect, it } from "vitest";
import {
  assertAccountingEquation,
  constructEvent,
  constructReversal,
} from "./events";
import type {
  EventEffects,
  NormalSemanticCommand,
  RecordedLedgerEvent,
} from "./types";

const date = "2026-08-16";

const cashExpense: RecordedLedgerEvent = {
  id: "cash-expense",
  kind: "expense_cash",
  amount: 100,
  date,
  effects: { cash: -100, position: 0, income: 0, expense: 100, equity: 0 },
  positionId: null,
  categoryId: 1,
  budgetPeriodId: 2,
  relatedEventId: null,
  refundPriorTotal: null,
  reversalOfEventId: null,
  note: null,
};

const cardExpense: RecordedLedgerEvent = {
  ...cashExpense,
  id: "card-expense",
  kind: "expense_position",
  effects: { cash: 0, position: -100, income: 0, expense: 100, equity: 0 },
  positionId: "card",
};

const fixtures: Array<{
  command: NormalSemanticCommand;
  kind: string;
  effects: EventEffects;
}> = [
  {
    command: { type: "open_cash", amount: 100, date },
    kind: "opening_cash",
    effects: { cash: 100, position: 0, income: 0, expense: 0, equity: 100 },
  },
  {
    command: {
      type: "open_position",
      balance: 100,
      positionId: "deposit",
      date,
    },
    kind: "opening_position",
    effects: { cash: 0, position: 100, income: 0, expense: 0, equity: 100 },
  },
  {
    command: {
      type: "open_position",
      balance: -100,
      positionId: "card",
      date,
    },
    kind: "opening_position",
    effects: { cash: 0, position: -100, income: 0, expense: 0, equity: -100 },
  },
  {
    command: { type: "record_income", amount: 100, categoryId: 1, date },
    kind: "income_cash",
    effects: { cash: 100, position: 0, income: 100, expense: 0, equity: 0 },
  },
  {
    command: {
      type: "record_expense",
      amount: 100,
      categoryId: 1,
      budgetPeriodId: 2,
      payment: { medium: "cash" },
      date,
    },
    kind: "expense_cash",
    effects: { cash: -100, position: 0, income: 0, expense: 100, equity: 0 },
  },
  {
    command: {
      type: "record_expense",
      amount: 100,
      categoryId: 1,
      budgetPeriodId: 2,
      payment: { medium: "position", positionId: "card" },
      date,
    },
    kind: "expense_position",
    effects: { cash: 0, position: -100, income: 0, expense: 100, equity: 0 },
  },
  {
    command: {
      type: "record_refund",
      amount: 100,
      originalExpense: cashExpense,
      priorRefundTotal: 0,
      date,
    },
    kind: "refund_cash",
    effects: { cash: 100, position: 0, income: 0, expense: -100, equity: 0 },
  },
  {
    command: {
      type: "record_refund",
      amount: 100,
      originalExpense: cardExpense,
      priorRefundTotal: 0,
      date,
    },
    kind: "refund_position",
    effects: { cash: 0, position: 100, income: 0, expense: -100, equity: 0 },
  },
  {
    command: {
      type: "move_position",
      amount: 100,
      positionId: "deposit",
      direction: "cash_to_position",
      date,
    },
    kind: "cash_to_position",
    effects: { cash: -100, position: 100, income: 0, expense: 0, equity: 0 },
  },
  {
    command: {
      type: "move_position",
      amount: 100,
      positionId: "deposit",
      direction: "position_to_cash",
      date,
    },
    kind: "position_to_cash",
    effects: { cash: 100, position: -100, income: 0, expense: 0, equity: 0 },
  },
  {
    command: { type: "adjust_cash", amount: 100, direction: "increase", note: "Reconcile", date },
    kind: "cash_adjustment",
    effects: { cash: 100, position: 0, income: 0, expense: 0, equity: 100 },
  },
  {
    command: { type: "adjust_cash", amount: 100, direction: "decrease", note: "Reconcile", date },
    kind: "cash_adjustment",
    effects: { cash: -100, position: 0, income: 0, expense: 0, equity: -100 },
  },
  {
    command: {
      type: "adjust_position",
      amount: 100,
      positionId: "deposit",
      direction: "increase",
      note: "Reconcile",
      date,
    },
    kind: "position_adjustment",
    effects: { cash: 0, position: 100, income: 0, expense: 0, equity: 100 },
  },
  {
    command: {
      type: "adjust_position",
      amount: 100,
      positionId: "deposit",
      direction: "decrease",
      note: "Reconcile",
      date,
    },
    kind: "position_adjustment",
    effects: { cash: 0, position: -100, income: 0, expense: 0, equity: -100 },
  },
];

describe("constructEvent", () => {
  it.each(fixtures)("maps $kind to its only permitted effect shape", ({ command, kind, effects }) => {
    const event = constructEvent(command);

    expect(event.kind).toBe(kind);
    expect(event.effects).toEqual(effects);
  });

  it.each(fixtures)("balances the accounting equation for $kind", ({ command }) => {
    expect(() => assertAccountingEquation(constructEvent(command).effects)).not.toThrow();
  });

  it("rejects non-positive normal-event amounts", () => {
    expect(() => constructEvent({ type: "open_cash", amount: 0, date })).toThrow(
      "Event amount must be a positive safe integer",
    );
  });

  it.each(["2026-02-29", "2026-8-16", "2026-13-01"])(
    "rejects invalid or non-canonical event date %s",
    (invalidDate) => {
      expect(() =>
        constructEvent({ type: "open_cash", amount: 100, date: invalidDate }),
      ).toThrow(`Event date must be a real canonical YYYY-MM-DD date: ${invalidDate}`);
    },
  );

  it("derives every refund attribution field from the original cash expense", () => {
    expect(
      constructEvent({
        type: "record_refund",
        amount: 25,
        originalExpense: cashExpense,
        priorRefundTotal: 0,
        date,
      }),
    ).toMatchObject({
      kind: "refund_cash",
      positionId: null,
      categoryId: 1,
      budgetPeriodId: 2,
      relatedEventId: "cash-expense",
    });
  });

  it("rejects a refund whose original is not an expense", () => {
    const originalIncome: RecordedLedgerEvent = {
      ...cashExpense,
      id: "income",
      kind: "income_cash",
      effects: { cash: 100, position: 0, income: 100, expense: 0, equity: 0 },
      budgetPeriodId: null,
    };

    expect(() =>
      constructEvent({
        type: "record_refund",
        amount: 25,
        originalExpense: originalIncome,
        priorRefundTotal: 0,
        date,
      }),
    ).toThrow("Refund original must be an expense event");
  });

  it("rejects expense attribution inconsistent with its payment medium", () => {
    expect(() =>
      constructEvent({
        type: "record_refund",
        amount: 25,
        originalExpense: { ...cardExpense, positionId: null },
        priorRefundTotal: 0,
        date,
      }),
    ).toThrow("Position expense original must reference a position");
  });
});

describe("constructReversal", () => {
  it("negates every effect and copies attribution except the refund relationship", () => {
    const original = {
      ...constructEvent({
        type: "record_refund" as const,
        amount: 30,
        originalExpense: {
          ...cardExpense,
          categoryId: 4,
          budgetPeriodId: 5,
        },
        priorRefundTotal: 0,
        date,
      }),
      id: "refund",
    };

    expect(constructReversal(original)).toEqual({
      kind: "reversal",
      amount: 30,
      date,
      effects: { cash: 0, position: -30, income: 0, expense: 30, equity: 0 },
      positionId: "card",
      categoryId: 4,
      budgetPeriodId: 5,
      relatedEventId: null,
      refundPriorTotal: null,
      reversalOfEventId: "refund",
      note: null,
    });
  });

  it("rejects reversal of opening events", () => {
    const opening = {
      ...constructEvent({ type: "open_cash" as const, amount: 30, date }),
      id: "opening",
    };

    expect(() => constructReversal(opening)).toThrow("Opening events cannot be reversed");
  });

  it("also satisfies the accounting equation", () => {
    const income = {
      ...constructEvent({
        type: "record_income" as const,
        amount: 30,
        categoryId: 4,
        date,
      }),
      id: "income",
    };

    expect(() => assertAccountingEquation(constructReversal(income).effects)).not.toThrow();
  });

  it("rejects reversal of a reversal", () => {
    const income = {
      ...constructEvent({ type: "record_income" as const, amount: 30, categoryId: 4, date }),
      id: "income",
    };
    const reversal = { ...constructReversal(income), id: "reversal" };

    expect(() => constructReversal(reversal)).toThrow("Reversal events cannot be reversed");
  });
});

describe("assertAccountingEquation", () => {
  it("rejects balanced arithmetic whose intermediate total exceeds Number safe range", () => {
    expect(() =>
      assertAccountingEquation({
        cash: Number.MAX_SAFE_INTEGER,
        position: 1,
        equity: Number.MAX_SAFE_INTEGER,
        income: 1,
        expense: 0,
      }),
    ).toThrow("Accounting equation total is outside Number safe range");
  });
});
