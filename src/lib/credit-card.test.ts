import { describe, it, expect } from "vitest";
import { isCreditCardOveruse, cashAlignedRemaining, CREDIT_CARD_OVERUSE_THRESHOLD } from "@/lib/credit-card";

describe("isCreditCardOveruse", () => {
  it("returns false when totalExpense is 0 (no division by zero)", () => {
    expect(isCreditCardOveruse(0, 0)).toBe(false);
  });

  it("returns false when creditCardSpend is 0", () => {
    expect(isCreditCardOveruse(0, 1_000_000)).toBe(false);
  });

  it("returns false exactly at the threshold", () => {
    const total = 1_000_000;
    const creditCardSpend = total * CREDIT_CARD_OVERUSE_THRESHOLD;
    expect(isCreditCardOveruse(creditCardSpend, total)).toBe(false);
  });

  it("returns true just above the threshold", () => {
    const total = 1_000_000;
    const creditCardSpend = total * CREDIT_CARD_OVERUSE_THRESHOLD + 1;
    expect(isCreditCardOveruse(creditCardSpend, total)).toBe(true);
  });

  it("returns true when all spend is by credit card", () => {
    expect(isCreditCardOveruse(1_000_000, 1_000_000)).toBe(true);
  });
});

describe("cashAlignedRemaining", () => {
  it("adds credit-card spend back to remaining", () => {
    expect(cashAlignedRemaining(500_000, 200_000)).toBe(700_000);
  });

  it("is a no-op when credit-card spend is 0", () => {
    expect(cashAlignedRemaining(500_000, 0)).toBe(500_000);
  });

  it("works when remaining is negative (over budget)", () => {
    expect(cashAlignedRemaining(-100_000, 300_000)).toBe(200_000);
  });
});
