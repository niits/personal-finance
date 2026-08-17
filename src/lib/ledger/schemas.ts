import { z } from "zod";
import { assertCanonicalDate } from "./date";

const safeInteger = z.number().int().safe();
const positiveAmount = safeInteger.positive();
const nonnegativeAmount = safeInteger.nonnegative();
const date = z.string().refine((value) => {
  try {
    assertCanonicalDate(value, "date");
    return true;
  } catch {
    return false;
  }
}, "Must be a real canonical YYYY-MM-DD date");
const nullableText = z.string().trim().min(1).nullable().optional();

const openingPositionSchema = z
  .object({
    name: z.string().trim().min(1),
    kind: z.enum(["term_deposit", "personal_receivable", "credit_card", "personal_payable"]),
    balance: safeInteger,
    counterparty: nullableText,
    dueDate: date.nullable().optional(),
    note: nullableText,
  })
  .strict()
  .superRefine((position, context) => {
    const isAsset = position.kind === "term_deposit" || position.kind === "personal_receivable";
    if ((isAsset && position.balance < 0) || (!isAsset && position.balance > 0)) {
      context.addIssue({ code: "custom", path: ["balance"], message: "Opening balance has the wrong sign for this position kind" });
    }
  });

export const initializeRequestSchema = z
  .object({
    ledgerStartDate: date,
    openingCash: nonnegativeAmount.optional(),
    minimumCashReserve: nonnegativeAmount.optional(),
    acceptLegacyDataFreshStart: z.boolean().optional(),
    positions: z.array(openingPositionSchema).optional(),
    budget: z
      .object({
        label: z.string().trim().min(1),
        startDate: date,
        endDate: date,
        plannedIncome: nonnegativeAmount,
        savingsTarget: nonnegativeAmount,
        spendingLimit: nonnegativeAmount,
        objective: nullableText,
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.budget.startDate > value.ledgerStartDate || value.budget.endDate < value.ledgerStartDate) {
      context.addIssue({ code: "custom", path: ["budget"], message: "Initial budget must cover the ledger start date" });
    }
    if (value.budget.spendingLimit + value.budget.savingsTarget > value.budget.plannedIncome) {
      context.addIssue({ code: "custom", path: ["budget"], message: "Spending limit and savings target cannot exceed planned income" });
    }
  });

export const incomeRequestSchema = z
  .object({
    amount: positiveAmount,
    categoryId: positiveAmount,
    note: nullableText,
    date,
  })
  .strict();

const allocationSchema = z
  .object({ customBudgetId: z.string().trim().min(1), amount: positiveAmount })
  .strict();

export const expenseRequestSchema = incomeRequestSchema
  .extend({
    positionId: z.string().trim().min(1).optional(),
    allocations: z.array(allocationSchema).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.allocations?.map((allocation) => allocation.customBudgetId) ?? [];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Custom budget IDs must be unique" });
    }
    const total = (value.allocations ?? []).reduce(
      (sum, allocation) => sum + BigInt(allocation.amount),
      BigInt(0),
    );
    if (total > BigInt(Number.MAX_SAFE_INTEGER) || total > BigInt(value.amount)) {
      context.addIssue({ code: "custom", message: "Allocations cannot exceed the expense" });
    }
  });

export const positionRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    kind: z.enum(["term_deposit", "personal_receivable", "credit_card", "personal_payable"]),
    counterparty: nullableText,
    dueDate: date.nullable().optional(),
    note: nullableText,
  })
  .strict();

export const movementRequestSchema = z.object({ amount: positiveAmount, date }).strict();
export const closeRequestSchema = z.object({ date }).strict();
export const refundRequestSchema = z
  .object({ amount: positiveAmount, date, note: nullableText })
  .strict();
export const reverseRequestSchema = z.object({}).strict();
export const adjustmentRequestSchema = z
  .object({ delta: safeInteger.refine((value) => value !== 0), note: z.string().trim().min(1) })
  .strict();
export const budgetAdjustmentRequestSchema = adjustmentRequestSchema.extend({
  target: z.enum(["planned_income", "savings_target", "spending_limit"]),
}).strict();
export const budgetPeriodRequestSchema = z
  .object({
    label: z.string().trim().min(1),
    startDate: date,
    endDate: date,
    plannedIncome: nonnegativeAmount,
    savingsTarget: nonnegativeAmount,
    spendingLimit: nonnegativeAmount,
    objective: nullableText,
  })
  .strict();
export const budgetPeriodPatchSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    objective: nullableText,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const customBudgetRequestSchema = z
  .object({ name: z.string().trim().min(1), amount: positiveAmount, seriesKey: nullableText })
  .strict();
export const customBudgetPatchSchema = z
  .object({ name: z.string().trim().min(1).optional(), seriesKey: nullableText })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const positionPatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    counterparty: nullableText,
    dueDate: date.nullable().optional(),
    note: nullableText,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const cashReconciliationSchema = z
  .object({
    amount: positiveAmount,
    direction: z.enum(["increase", "decrease"]),
    note: z.string().trim().min(1),
    date,
  })
  .strict();
export const positionReconciliationSchema = cashReconciliationSchema
  .extend({ positionId: z.string().trim().min(1) })
  .strict();
