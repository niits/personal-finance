import { assertSafeInteger, safeNumber } from "./money";

const zero = BigInt(0);
const one = BigInt(1);

type Allocation = { customBudgetId: string; amount: number };

type RefundAllocationInput = {
  expenseAmount: number;
  originalAllocations: Allocation[];
  cumulativeRefundAmount: number;
  previousCumulativeRefundAmount: number;
  previouslyReleased: Allocation[];
  previouslyReleasedUnallocated: number;
};

type RefundAllocationResult = {
  customBudgetAllocations: Array<{
    customBudgetId: string;
    allocatedExpenseDelta: number;
  }>;
  unallocatedAmount: number;
};

function assertNonnegativeSafeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < 0) throw new Error(`${label} must be nonnegative`);
}

export function allocateCumulativeRefund(input: RefundAllocationInput): RefundAllocationResult {
  assertNonnegativeSafeInteger(input.expenseAmount, "Expense amount");
  if (input.expenseAmount === 0) throw new Error("Expense amount must be positive");
  assertNonnegativeSafeInteger(input.cumulativeRefundAmount, "Cumulative refund amount");
  assertNonnegativeSafeInteger(
    input.previousCumulativeRefundAmount,
    "Previous cumulative refund amount",
  );
  assertNonnegativeSafeInteger(
    input.previouslyReleasedUnallocated,
    "Previously released unallocated amount",
  );
  if (input.cumulativeRefundAmount > input.expenseAmount) {
    throw new Error("Cumulative refund cannot exceed the expense amount");
  }
  if (input.cumulativeRefundAmount < input.previousCumulativeRefundAmount) {
    throw new Error("Cumulative refund cannot decrease");
  }

  const original = new Map<string, number>();
  let originalTotal = zero;
  for (const allocation of input.originalAllocations) {
    assertNonnegativeSafeInteger(allocation.amount, "Original allocation amount");
    if (allocation.amount === 0) throw new Error("Original allocation amount must be positive");
    if (original.has(allocation.customBudgetId)) {
      throw new Error(`Duplicate custom budget ID: ${allocation.customBudgetId}`);
    }
    original.set(allocation.customBudgetId, allocation.amount);
    originalTotal += BigInt(allocation.amount);
  }
  const allocatedTotal = safeNumber(originalTotal, "Original allocation total");
  if (allocatedTotal > input.expenseAmount) {
    throw new Error("Original allocations cannot exceed the expense amount");
  }

  const released = new Map<string, number>();
  let priorTotal = BigInt(input.previouslyReleasedUnallocated);
  for (const allocation of input.previouslyReleased) {
    assertNonnegativeSafeInteger(allocation.amount, "Previously released amount");
    const capacity = original.get(allocation.customBudgetId);
    if (capacity === undefined) {
      throw new Error(
        `Previously released custom budget is not in the expense: ${allocation.customBudgetId}`,
      );
    }
    if (released.has(allocation.customBudgetId)) {
      throw new Error(`Duplicate previously released custom budget ID: ${allocation.customBudgetId}`);
    }
    if (allocation.amount > capacity) {
      throw new Error(
        `Previously released amount exceeds capacity for custom budget ${allocation.customBudgetId}`,
      );
    }
    released.set(allocation.customBudgetId, allocation.amount);
    priorTotal += BigInt(allocation.amount);
  }

  const unallocatedCapacity = input.expenseAmount - allocatedTotal;
  if (input.previouslyReleasedUnallocated > unallocatedCapacity) {
    throw new Error("Previously released unallocated amount exceeds its capacity");
  }
  if (priorTotal !== BigInt(input.previousCumulativeRefundAmount)) {
    throw new Error("Prior releases must equal the previous cumulative refund amount");
  }

  const refundDelta = BigInt(input.cumulativeRefundAmount - input.previousCumulativeRefundAmount);
  const buckets = [
    ...[...original.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([id, capacity]) => ({
        id,
        remaining: BigInt(capacity - (released.get(id) ?? 0)),
        unallocated: false,
      })),
    {
      id: "",
      remaining: BigInt(unallocatedCapacity - input.previouslyReleasedUnallocated),
      unallocated: true,
    },
  ];
  const totalRemaining = BigInt(input.expenseAmount) - priorTotal;
  if (refundDelta > totalRemaining) {
    throw new Error("New refund exceeds remaining allocation capacity");
  }
  if (refundDelta === zero) {
    return { customBudgetAllocations: [], unallocatedAmount: 0 };
  }

  const apportioned = buckets.map((bucket) => {
    const numerator = refundDelta * bucket.remaining;
    return {
      ...bucket,
      release: numerator / totalRemaining,
      remainder: numerator % totalRemaining,
    };
  });
  let remainderUnits =
    refundDelta - apportioned.reduce((sum, bucket) => sum + bucket.release, zero);
  const remainderOrder = [...apportioned].sort((left, right) => {
    if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
    if (left.unallocated !== right.unallocated) return left.unallocated ? 1 : -1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  for (const bucket of remainderOrder) {
    if (remainderUnits === zero) break;
    if (bucket.release < bucket.remaining) {
      bucket.release += one;
      remainderUnits -= one;
    }
  }
  if (remainderUnits !== zero) {
    throw new Error("Refund allocation could not exhaust the new refund delta");
  }

  const customBudgetAllocations = apportioned
    .filter((bucket) => !bucket.unallocated && bucket.release > zero)
    .map((bucket) => ({
      customBudgetId: bucket.id,
      allocatedExpenseDelta: -safeNumber(bucket.release, "Custom refund allocation"),
    }));
  const unallocatedRelease = apportioned.find((bucket) => bucket.unallocated)?.release ?? zero;

  if (
    input.cumulativeRefundAmount === input.expenseAmount &&
    apportioned.some((bucket) => bucket.release !== bucket.remaining)
  ) {
    throw new Error("Full refund must exhaust every allocation capacity");
  }

  return {
    customBudgetAllocations,
    unallocatedAmount: safeNumber(unallocatedRelease, "Unallocated refund amount"),
  };
}
