import type { EventEffects, EventKind, PositionKind } from "./types";

export type LedgerProfileMode = "ledger" | "legacy-empty" | "legacy-data";

export type LedgerProfileDto = {
  ledgerStartDate: string;
  minimumCashReserve: number;
  initializedAt: number;
  legacyDataConsentAt: number | null;
  legacyDataArchiveState: "not_applicable" | "preserved";
};

export type LedgerProfileResponse = {
  mode: LedgerProfileMode;
  legacyFinancialData: {
    hasData: boolean;
    transactionCount: number;
    monthlyBudgetCount: number;
    customBudgetCount: number;
    debtCount: number;
  };
  consentRequired: boolean;
  profile: LedgerProfileDto | null;
};

export type FinancialEventDto = {
  id: string;
  kind: EventKind;
  amount: number;
  remainingRefundableAmount?: number | null;
  date: string;
  note: string | null;
  category: { id: number; name: string; emoji: string | null; path: string } | null;
  position: { id: string; name: string; kind: PositionKind } | null;
  allocations: Array<{ customBudgetId: string; name: string; amount: number }>;
  reversal: { reversesEventId: string | null; reversedByEventId: string | null; relatedEventId: string | null };
  effects: EventEffects;
  activity: {
    type: "opening" | "income" | "expense" | "refund" | "transfer" | "reconciliation" | "correction";
    label: string;
    actions: { canRefund: boolean; canReverse: boolean };
  };
};

export type FinancialEventFeedDto = {
  events: FinancialEventDto[];
  pagination: { nextCursor: string | null };
};

export type LedgerSummaryDto = {
  asOf: string;
  balances: {
    cash: number;
    positions: number;
    netWorth: number;
    reservedCardDebt: number;
    reservedPayables: number;
    minimumCashReserve: number;
    cashAfterCommitments: number;
  };
  activePeriod: null | {
    id: number;
    label: string;
    startDate: string;
    endDate: string;
    plan: { plannedIncome: number; savingsTarget: number; spendingLimit: number };
    actual: { income: number; expense: number; savings: number; savingsRate: number | null; savingsTargetGap: number; remaining: number };
    allocationBreakdown: { customCapacity: number; customSpent: number; unallocatedExpense: number; unassignedRemaining: number; reconciledRemaining: number };
    customEnvelopes: Array<{ id: string; name: string; effectiveAmount: number; spent: number; remaining: number }>;
  };
  safeToSpend: number | null;
};

export type BudgetPeriodDto = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  objective: string | null;
  isLocked: boolean;
  initial: { plannedIncome: number; savingsTarget: number; spendingLimit: number };
  effective: { plannedIncome: number; savingsTarget: number; spendingLimit: number };
  actual: { expense: number; remaining: number };
  capacity: {
    customCapacity: number;
    customSpent: number;
    customRemaining: number;
    unallocatedExpense: number;
    unassignedRemaining: number;
    reconciledRemaining: number;
    reconciles: boolean;
  };
};

export type CustomEnvelopeDto = {
  id: string;
  budgetPeriodId: number;
  name: string;
  seriesKey: string | null;
  initialAmount: number;
  effectiveAmount: number;
  spent: number;
  remaining: number;
  locked: boolean;
};
