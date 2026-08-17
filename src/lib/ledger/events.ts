import type {
  EventEffects,
  LedgerEvent,
  NormalSemanticCommand,
  RecordedLedgerEvent,
} from "./types";
import { assertCanonicalDate } from "./date";
import { assertSafeInteger, safeNumber } from "./money";

const zeroEffects: EventEffects = {
  cash: 0,
  position: 0,
  income: 0,
  expense: 0,
  equity: 0,
};

function assertPositiveAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Event amount must be a positive safe integer");
  }
}

function createEvent(
  command: NormalSemanticCommand,
  kind: LedgerEvent["kind"],
  amount: number,
  effects: EventEffects,
  attribution: Partial<
    Pick<LedgerEvent, "positionId" | "categoryId" | "budgetPeriodId" | "relatedEventId" | "refundPriorTotal">
  > = {},
): LedgerEvent {
  assertPositiveAmount(amount);
  assertCanonicalDate(command.date, "Event date");

  return {
    kind,
    amount,
    date: command.date,
    effects,
    positionId: attribution.positionId ?? null,
    categoryId: attribution.categoryId ?? null,
    budgetPeriodId: attribution.budgetPeriodId ?? null,
    relatedEventId: attribution.relatedEventId ?? null,
    refundPriorTotal: attribution.refundPriorTotal ?? null,
    reversalOfEventId: null,
    note: "note" in command ? command.note ?? null : null,
  };
}

export function constructEvent(command: NormalSemanticCommand): LedgerEvent {
  switch (command.type) {
    case "open_cash":
      return createEvent(command, "opening_cash", command.amount, {
        ...zeroEffects,
        cash: command.amount,
        equity: command.amount,
      });
    case "open_position": {
      assertSafeInteger(command.balance, "Opening position balance");
      const amount = Math.abs(command.balance);
      return createEvent(
        command,
        "opening_position",
        amount,
        { ...zeroEffects, position: command.balance, equity: command.balance },
        { positionId: command.positionId },
      );
    }
    case "record_income":
      return createEvent(
        command,
        "income_cash",
        command.amount,
        { ...zeroEffects, cash: command.amount, income: command.amount },
        { categoryId: command.categoryId },
      );
    case "record_expense":
      if (command.payment.medium === "cash") {
        return createEvent(
          command,
          "expense_cash",
          command.amount,
          { ...zeroEffects, cash: -command.amount, expense: command.amount },
          { categoryId: command.categoryId, budgetPeriodId: command.budgetPeriodId },
        );
      }
      return createEvent(
        command,
        "expense_position",
        command.amount,
        { ...zeroEffects, position: -command.amount, expense: command.amount },
        {
          positionId: command.payment.positionId,
          categoryId: command.categoryId,
          budgetPeriodId: command.budgetPeriodId,
        },
      );
    case "record_refund": {
      const original = command.originalExpense;
      if (original.kind !== "expense_cash" && original.kind !== "expense_position") {
        throw new Error("Refund original must be an expense event");
      }
      assertPositiveAmount(original.amount);
      assertCanonicalDate(original.date, "Original expense date");
      assertAccountingEquation(original.effects);
      if (!Number.isSafeInteger(command.priorRefundTotal) || command.priorRefundTotal < 0) {
        throw new Error("Prior refund total must be a nonnegative safe integer");
      }
      if (original.categoryId === null || original.budgetPeriodId === null) {
        throw new Error("Expense original must have category and budget period attribution");
      }
      if (original.kind === "expense_cash") {
        if (original.positionId !== null) {
          throw new Error("Cash expense original cannot reference a position");
        }
        return createEvent(
          command,
          "refund_cash",
          command.amount,
          { ...zeroEffects, cash: command.amount, expense: -command.amount },
          {
            categoryId: original.categoryId,
            budgetPeriodId: original.budgetPeriodId,
            relatedEventId: original.id,
            refundPriorTotal: command.priorRefundTotal,
          },
        );
      }
      if (original.positionId === null) {
        throw new Error("Position expense original must reference a position");
      }
      return createEvent(
        command,
        "refund_position",
        command.amount,
        { ...zeroEffects, position: command.amount, expense: -command.amount },
        {
          positionId: original.positionId,
          categoryId: original.categoryId,
          budgetPeriodId: original.budgetPeriodId,
          relatedEventId: original.id,
          refundPriorTotal: command.priorRefundTotal,
        },
      );
    }
    case "move_position":
      return command.direction === "cash_to_position"
        ? createEvent(
            command,
            "cash_to_position",
            command.amount,
            { ...zeroEffects, cash: -command.amount, position: command.amount },
            { positionId: command.positionId },
          )
        : createEvent(
            command,
            "position_to_cash",
            command.amount,
            { ...zeroEffects, cash: command.amount, position: -command.amount },
            { positionId: command.positionId },
          );
    case "adjust_cash": {
      const delta = command.direction === "increase" ? command.amount : -command.amount;
      return createEvent(command, "cash_adjustment", command.amount, {
        ...zeroEffects,
        cash: delta,
        equity: delta,
      });
    }
    case "adjust_position": {
      const delta = command.direction === "increase" ? command.amount : -command.amount;
      return createEvent(
        command,
        "position_adjustment",
        command.amount,
        { ...zeroEffects, position: delta, equity: delta },
        { positionId: command.positionId },
      );
    }
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}

export function constructReversal(original: RecordedLedgerEvent): LedgerEvent {
  if (original.kind === "opening_cash" || original.kind === "opening_position") {
    throw new Error("Opening events cannot be reversed");
  }
  if (original.kind === "reversal") {
    throw new Error("Reversal events cannot be reversed");
  }
  assertPositiveAmount(original.amount);
  assertCanonicalDate(original.date, "Event date");
  assertAccountingEquation(original.effects);

  const negate = (value: number) => (value === 0 ? 0 : -value);

  return {
    kind: "reversal",
    amount: original.amount,
    date: original.date,
    effects: {
      cash: negate(original.effects.cash),
      position: negate(original.effects.position),
      income: negate(original.effects.income),
      expense: negate(original.effects.expense),
      equity: negate(original.effects.equity),
    },
    positionId: original.positionId,
    categoryId: original.categoryId,
    budgetPeriodId: original.budgetPeriodId,
    relatedEventId: null,
    refundPriorTotal: null,
    reversalOfEventId: original.id,
    note: null,
  };
}

export function assertAccountingEquation(effects: EventEffects): void {
  for (const [name, value] of Object.entries(effects)) {
    assertSafeInteger(value, `${name} effect`);
  }

  const left = BigInt(effects.cash) + BigInt(effects.position);
  const right = BigInt(effects.equity) + BigInt(effects.income) - BigInt(effects.expense);
  safeNumber(left, "Accounting equation total");
  safeNumber(right, "Accounting equation total");
  if (left !== right) {
    throw new Error("Event effects violate the accounting equation");
  }
}
