export type OverdraftPaymentInput = {
  overdraftAccountId: string | null;
  type: "expense" | "income";
  isConsumption: boolean;
  creditCardGroupId: string | null;
};

/**
 * Overdraft is a payment method for consumption expenses only, exclusive with a
 * card group (an expense uses cash, one card group, or one overdraft account).
 * Returns the Vietnamese validation message, or null when the payment is allowed.
 */
export function overdraftPaymentError(input: OverdraftPaymentInput): string | null {
  if (!input.overdraftAccountId) return null;
  if (input.type !== "expense" || !input.isConsumption) return "Tài khoản thấu chi chỉ dùng để thanh toán chi tiêu.";
  if (input.creditCardGroupId) return "Chỉ chọn một hình thức thanh toán: thẻ hoặc tài khoản thấu chi.";
  return null;
}
