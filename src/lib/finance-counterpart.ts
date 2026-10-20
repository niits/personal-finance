export type FinanceCounterpart = {
  account: { id: string; name: string };
  amount: number;
  type: "income" | "expense";
  systemKind: "lend" | "borrow" | "debt_repayment" | "debt_collection" | "savings_deposit" | "savings_withdrawal";
  label: string;
};

/** Prepare a new movement without modifying the source transaction. */
export function financeCounterpart(
  account: { id: string; name: string; type: "debt" | "savings"; debt_direction: "lend" | "borrow" | null },
  transaction: { amount: number; type: "income" | "expense" },
): FinanceCounterpart {
  const type = transaction.type === "expense" ? "income" : "expense";
  if (account.type === "savings") {
    return { account: { id: account.id, name: account.name }, amount: transaction.amount, type,
      systemKind: type === "income" ? "savings_withdrawal" : "savings_deposit",
      label: type === "income" ? "Rút tiền gửi" : "Gửi tiền" };
  }
  const repayment = account.debt_direction === "lend" ? type === "income" : type === "expense";
  return { account: { id: account.id, name: account.name }, amount: transaction.amount, type,
    systemKind: repayment ? type === "income" ? "debt_collection" : "debt_repayment" : account.debt_direction === "lend" ? "lend" : "borrow",
    label: repayment ? type === "income" ? "Nhận tiền trả nợ" : "Trả nợ" : type === "income" ? "Nhận tiền vay" : "Cho vay" };
}

/** Prepare a reduction from the current account balance. */
export function financeReduction(
  account: { id: string; name: string; type: "debt" | "savings"; debt_direction: "lend" | "borrow" | null; balance: number },
): FinanceCounterpart | null {
  const openingType = account.type === "debt" && account.debt_direction === "borrow" ? "income" : "expense";
  const remaining = openingType === "income" ? account.balance : -account.balance;
  if (remaining <= 0) return null;
  return financeCounterpart(account, { amount: remaining, type: openingType });
}
