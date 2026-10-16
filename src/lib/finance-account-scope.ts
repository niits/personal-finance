export type FinanceAccountScope = {
  type: "debt" | "savings";
  debt_direction: "lend" | "borrow" | null;
  label: string;
};

/** Resolve the account family required by a protected transaction category. */
export function financeAccountScope(systemKind: string | null | undefined): FinanceAccountScope | null {
  switch (systemKind) {
    case "lend":
    case "debt_collection":
      return { type: "debt", debt_direction: "lend", label: "Tài khoản cho vay" };
    case "borrow":
    case "debt_repayment":
      return { type: "debt", debt_direction: "borrow", label: "Tài khoản đi vay" };
    case "savings_deposit":
    case "savings_withdrawal":
      return { type: "savings", debt_direction: null, label: "Tài khoản tiền gửi" };
    default:
      return null;
  }
}

export function matchesFinanceAccountScope(
  account: { type: "debt" | "savings"; debt_direction: "lend" | "borrow" | null },
  scope: FinanceAccountScope | null,
): boolean {
  return scope !== null && account.type === scope.type && account.debt_direction === scope.debt_direction;
}
