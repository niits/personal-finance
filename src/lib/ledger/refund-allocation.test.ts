import { describe, expect, it } from "vitest";
import { allocateCumulativeRefund } from "./refund-allocation";

describe("allocateCumulativeRefund", () => {
  it("allocates only the new refund delta across remaining capacity", () => {
    expect(
      allocateCumulativeRefund({
        expenseAmount: 10,
        originalAllocations: [
          { customBudgetId: "a", amount: 4 },
          { customBudgetId: "b", amount: 4 },
        ],
        cumulativeRefundAmount: 6,
        previousCumulativeRefundAmount: 3,
        previouslyReleased: [
          { customBudgetId: "a", amount: 1 },
          { customBudgetId: "b", amount: 1 },
        ],
        previouslyReleasedUnallocated: 1,
      }),
    ).toEqual({
      customBudgetAllocations: [
        { customBudgetId: "a", allocatedExpenseDelta: -1 },
        { customBudgetId: "b", allocatedExpenseDelta: -1 },
      ],
      unallocatedAmount: 1,
    });
  });

  it("breaks equal remainders by custom ID ascending with unallocated last", () => {
    expect(
      allocateCumulativeRefund({
        expenseAmount: 3,
        originalAllocations: [
          { customBudgetId: "b", amount: 1 },
          { customBudgetId: "a", amount: 1 },
        ],
        cumulativeRefundAmount: 1,
        previousCumulativeRefundAmount: 0,
        previouslyReleased: [],
        previouslyReleasedUnallocated: 0,
      }),
    ).toEqual({
      customBudgetAllocations: [{ customBudgetId: "a", allocatedExpenseDelta: -1 }],
      unallocatedAmount: 0,
    });
  });

  it("remains monotonic for sequential refunds over capacities [1,3,3]", () => {
    const originalAllocations = [
      { customBudgetId: "a", amount: 1 },
      { customBudgetId: "b", amount: 3 },
    ];
    const released = new Map<string, number>();
    let releasedUnallocated = 0;
    const deltas: Array<{ custom: string[]; unallocated: number }> = [];

    for (let cumulative = 1; cumulative <= 7; cumulative += 1) {
      const result = allocateCumulativeRefund({
        expenseAmount: 7,
        originalAllocations,
        cumulativeRefundAmount: cumulative,
        previousCumulativeRefundAmount: cumulative - 1,
        previouslyReleased: [...released].map(([customBudgetId, amount]) => ({
          customBudgetId,
          amount,
        })),
        previouslyReleasedUnallocated: releasedUnallocated,
      });
      for (const allocation of result.customBudgetAllocations) {
        expect(allocation.allocatedExpenseDelta).toBeLessThan(0);
        released.set(
          allocation.customBudgetId,
          (released.get(allocation.customBudgetId) ?? 0) - allocation.allocatedExpenseDelta,
        );
      }
      expect(result.unallocatedAmount).toBeGreaterThanOrEqual(0);
      releasedUnallocated += result.unallocatedAmount;
      deltas.push({
        custom: result.customBudgetAllocations.map((allocation) => allocation.customBudgetId),
        unallocated: result.unallocatedAmount,
      });
    }

    expect(deltas).toEqual([
      { custom: ["b"], unallocated: 0 },
      { custom: [], unallocated: 1 },
      { custom: ["b"], unallocated: 0 },
      { custom: [], unallocated: 1 },
      { custom: ["a"], unallocated: 0 },
      { custom: ["b"], unallocated: 0 },
      { custom: [], unallocated: 1 },
    ]);
    expect([...released]).toEqual([
      ["b", 3],
      ["a", 1],
    ]);
    expect(releasedUnallocated).toBe(3);
  });

  it("exhausts every remaining bucket on a full cumulative refund", () => {
    expect(
      allocateCumulativeRefund({
        expenseAmount: 10,
        originalAllocations: [
          { customBudgetId: "a", amount: 4 },
          { customBudgetId: "b", amount: 3 },
        ],
        cumulativeRefundAmount: 10,
        previousCumulativeRefundAmount: 2,
        previouslyReleased: [{ customBudgetId: "a", amount: 1 }],
        previouslyReleasedUnallocated: 1,
      }),
    ).toEqual({
      customBudgetAllocations: [
        { customBudgetId: "a", allocatedExpenseDelta: -3 },
        { customBudgetId: "b", allocatedExpenseDelta: -3 },
      ],
      unallocatedAmount: 2,
    });
  });

  it("rejects a decreasing cumulative refund", () => {
    expect(() =>
      allocateCumulativeRefund({
        expenseAmount: 10,
        originalAllocations: [],
        cumulativeRefundAmount: 2,
        previousCumulativeRefundAmount: 3,
        previouslyReleased: [],
        previouslyReleasedUnallocated: 3,
      }),
    ).toThrow("Cumulative refund cannot decrease");
  });

  it("rejects prior custom releases above their bucket capacity", () => {
    expect(() =>
      allocateCumulativeRefund({
        expenseAmount: 10,
        originalAllocations: [{ customBudgetId: "a", amount: 4 }],
        cumulativeRefundAmount: 6,
        previousCumulativeRefundAmount: 5,
        previouslyReleased: [{ customBudgetId: "a", amount: 5 }],
        previouslyReleasedUnallocated: 0,
      }),
    ).toThrow("Previously released amount exceeds capacity for custom budget a");
  });

  it("rejects prior unallocated releases above capacity", () => {
    expect(() =>
      allocateCumulativeRefund({
        expenseAmount: 10,
        originalAllocations: [{ customBudgetId: "a", amount: 4 }],
        cumulativeRefundAmount: 7,
        previousCumulativeRefundAmount: 7,
        previouslyReleased: [],
        previouslyReleasedUnallocated: 7,
      }),
    ).toThrow("Previously released unallocated amount exceeds its capacity");
  });

  it("rejects a prior release total inconsistent with previous cumulative refund", () => {
    expect(() =>
      allocateCumulativeRefund({
        expenseAmount: 10,
        originalAllocations: [{ customBudgetId: "a", amount: 4 }],
        cumulativeRefundAmount: 5,
        previousCumulativeRefundAmount: 4,
        previouslyReleased: [{ customBudgetId: "a", amount: 1 }],
        previouslyReleasedUnallocated: 1,
      }),
    ).toThrow("Prior releases must equal the previous cumulative refund amount");
  });

  it("rejects over-refunds", () => {
    expect(() =>
      allocateCumulativeRefund({
        expenseAmount: 5,
        originalAllocations: [],
        cumulativeRefundAmount: 6,
        previousCumulativeRefundAmount: 0,
        previouslyReleased: [],
        previouslyReleasedUnallocated: 0,
      }),
    ).toThrow("Cumulative refund cannot exceed the expense amount");
  });

  it("rejects overflowing original allocation totals", () => {
    expect(() =>
      allocateCumulativeRefund({
        expenseAmount: Number.MAX_SAFE_INTEGER,
        originalAllocations: [
          { customBudgetId: "a", amount: Number.MAX_SAFE_INTEGER },
          { customBudgetId: "b", amount: 1 },
        ],
        cumulativeRefundAmount: 0,
        previousCumulativeRefundAmount: 0,
        previouslyReleased: [],
        previouslyReleasedUnallocated: 0,
      }),
    ).toThrow("Original allocation total is outside Number safe range");
  });
});
