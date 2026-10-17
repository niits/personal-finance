export type FinanceBalanceAccount = {
  type: "debt" | "savings";
  debt_direction: "lend" | "borrow" | null;
  balance: number;
};

export type FinanceMovement = { amount: number; type: "income" | "expense" };

export function financeAvailable(account: FinanceBalanceAccount): number {
  return account.type === "debt" && account.debt_direction === "borrow" ? account.balance : -account.balance;
}

export function financeContribution(account: FinanceBalanceAccount, movement: FinanceMovement): number {
  const signed = movement.type === "income" ? movement.amount : -movement.amount;
  return account.type === "debt" && account.debt_direction === "borrow" ? signed : -signed;
}

/** Exclude the saved movement before calculating an edited repayment's ceiling. */
export function financeAmountLimit(account: FinanceBalanceAccount, type: FinanceMovement["type"], previous?: FinanceMovement): number | null {
  if (financeContribution(account, { amount: 1, type }) >= 0) return null;
  const available = financeAvailable(account);
  return Math.max(0, available - (previous ? financeContribution(account, previous) : 0) - Math.min(0, available));
}

export function exceedsFinanceBalance(account: FinanceBalanceAccount, previous?: FinanceMovement, next?: FinanceMovement): boolean {
  const available = financeAvailable(account);
  const projected = available - (previous ? financeContribution(account, previous) : 0) + (next ? financeContribution(account, next) : 0);
  return projected < Math.min(0, available);
}
