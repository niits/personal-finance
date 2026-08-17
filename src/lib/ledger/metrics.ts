import { assertCanonicalDate } from "./date";
import { assertAccountingEquation } from "./events";
import { assertSafeInteger, safeDifference, safeNumber, safeSum } from "./money";
import type { LedgerEvent } from "./types";

const zero = BigInt(0);

function validateEvent(event: LedgerEvent): void {
  assertCanonicalDate(event.date, "Event date");
  assertSafeInteger(event.amount, "Event amount");
  assertAccountingEquation(event.effects);
}

export function calculateBalances(events: LedgerEvent[], asOf: string): {
  cashBalance: number;
  positionBalances: Record<string, number>;
  netWorth: number;
} {
  assertCanonicalDate(asOf, "As-of date");
  let cashBalance = zero;
  const positionTotals = new Map<string, bigint>();

  for (const event of events) {
    validateEvent(event);
    if (event.date > asOf) continue;
    cashBalance += BigInt(event.effects.cash);
    if (event.positionId) {
      positionTotals.set(
        event.positionId,
        (positionTotals.get(event.positionId) ?? zero) + BigInt(event.effects.position),
      );
    }
  }

  const cash = safeNumber(cashBalance, "Cash balance");
  const positionBalances = Object.fromEntries(
    [...positionTotals].map(([positionId, balance]) => [
      positionId,
      safeNumber(balance, `Position balance for ${positionId}`),
    ]),
  );
  const positionTotal = [...positionTotals.values()].reduce(
    (sum, balance) => sum + balance,
    zero,
  );

  return {
    cashBalance: cash,
    positionBalances,
    netWorth: safeNumber(cashBalance + positionTotal, "Net worth"),
  };
}

type PeriodMetricInput = {
  budgetPeriodId: number;
  startDate: string;
  endDate: string;
  asOf: string;
  savingsTarget: number;
};

export function calculatePeriodMetrics(events: LedgerEvent[], period: PeriodMetricInput): {
  income: number;
  expense: number;
  actualSavings: number;
  savingsRate: number | null;
  savingsTargetGap: number;
} {
  assertCanonicalDate(period.startDate, "Period start date");
  assertCanonicalDate(period.endDate, "Period end date");
  assertCanonicalDate(period.asOf, "As-of date");
  if (period.startDate > period.endDate) {
    throw new Error("Period start date cannot be after period end date");
  }
  assertSafeInteger(period.savingsTarget, "Savings target");
  const reportEnd = period.endDate < period.asOf ? period.endDate : period.asOf;
  let incomeTotal = zero;
  let expenseTotal = zero;

  for (const event of events) {
    validateEvent(event);
    if (event.date >= period.startDate && event.date <= reportEnd) {
      incomeTotal += BigInt(event.effects.income);
    }
    if (event.budgetPeriodId === period.budgetPeriodId && event.date <= period.asOf) {
      expenseTotal += BigInt(event.effects.expense);
    }
  }

  const income = safeNumber(incomeTotal, "Period income");
  const expense = safeNumber(expenseTotal, "Period expense");
  const actualSavings = safeNumber(incomeTotal - expenseTotal, "Actual savings");
  return {
    income,
    expense,
    actualSavings,
    savingsRate: income === 0 ? null : actualSavings / income,
    savingsTargetGap: safeNumber(
      BigInt(period.savingsTarget) - BigInt(actualSavings),
      "Savings target gap",
    ),
  };
}

export function effectiveValue(initialValue: number, adjustmentDeltas: number[]): number {
  return safeSum([initialValue, ...adjustmentDeltas], "Effective value");
}

type SafeToSpendInput = {
  cashBalance: number;
  positions: Array<{ balance: number; reserveAgainstCash: boolean }>;
  minimumCashReserve: number;
  spendingLimit: number | null;
  periodExpense: number;
};

export function calculateSafeToSpend(input: SafeToSpendInput): {
  reservedPayables: number;
  cashAfterCommitments: number;
  budgetRemaining: number | null;
  safeToSpend: number | null;
} {
  assertSafeInteger(input.cashBalance, "Cash balance");
  assertSafeInteger(input.minimumCashReserve, "Minimum cash reserve");
  assertSafeInteger(input.periodExpense, "Period expense");
  const reservedPayables = safeSum(
    input.positions.map((position) => {
      assertSafeInteger(position.balance, "Position balance");
      return position.reserveAgainstCash && position.balance < 0 ? position.balance : 0;
    }),
    "Reserved payables",
  );
  const cashAfterCommitments = safeNumber(
    BigInt(input.cashBalance) + BigInt(reservedPayables) - BigInt(input.minimumCashReserve),
    "Cash after commitments",
  );
  if (input.spendingLimit !== null) {
    assertSafeInteger(input.spendingLimit, "Spending limit");
  }
  const budgetRemaining =
    input.spendingLimit === null
      ? null
      : safeDifference(input.spendingLimit, input.periodExpense, "Budget remaining");

  return {
    reservedPayables,
    cashAfterCommitments,
    budgetRemaining,
    safeToSpend:
      budgetRemaining === null ? null : Math.min(cashAfterCommitments, budgetRemaining),
  };
}

type EnvelopeMetricInput = {
  spendingLimit: number;
  periodExpense: number;
  customEnvelopes: Array<{ effectiveAmount: number; spent: number }>;
};

export function calculateEnvelopeMetrics(input: EnvelopeMetricInput): {
  periodRemaining: number;
  periodUnallocatedExpense: number;
  periodUnassignedRemaining: number;
  customRemaining: number[];
} {
  assertSafeInteger(input.spendingLimit, "Spending limit");
  assertSafeInteger(input.periodExpense, "Period expense");
  const customAmount = safeSum(
    input.customEnvelopes.map((envelope) => envelope.effectiveAmount),
    "Custom envelope amount",
  );
  const customSpent = safeSum(
    input.customEnvelopes.map((envelope) => envelope.spent),
    "Custom envelope spending",
  );
  const customRemaining = input.customEnvelopes.map((envelope) =>
    safeDifference(envelope.effectiveAmount, envelope.spent, "Custom envelope remaining"),
  );
  const periodUnallocatedExpense = safeDifference(
    input.periodExpense,
    customSpent,
    "Period unallocated expense",
  );
  const periodUnassignedRemaining = safeNumber(
    BigInt(input.spendingLimit) - BigInt(customAmount) - BigInt(periodUnallocatedExpense),
    "Period unassigned remaining",
  );
  const periodRemaining = safeDifference(
    input.spendingLimit,
    input.periodExpense,
    "Period remaining",
  );
  const breakdownTotal = safeSum(
    [periodUnassignedRemaining, ...customRemaining],
    "Period remaining breakdown",
  );

  if (periodRemaining !== breakdownTotal) {
    throw new Error("Custom envelope metrics do not reconcile to period remaining");
  }

  return {
    periodRemaining,
    periodUnallocatedExpense,
    periodUnassignedRemaining,
    customRemaining,
  };
}
