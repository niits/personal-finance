// Fraction of period expense spend paid by credit card above which we flag
// "overuse" in the UI. Tune here only — no other file should hardcode this.
export const CREDIT_CARD_OVERUSE_THRESHOLD = 0.5;

export function isCreditCardOveruse(creditCardSpend: number, totalExpense: number): boolean {
  if (totalExpense <= 0) return false;
  return creditCardSpend / totalExpense > CREDIT_CARD_OVERUSE_THRESHOLD;
}

// remaining = budget - all expense spend (existing formula, unchanged).
// Credit-card spend is subtracted from `remaining` but hasn't actually left
// the bank account yet, so add it back to approximate real cash on hand.
export function cashAlignedRemaining(remaining: number, creditCardSpend: number): number {
  return remaining + creditCardSpend;
}
