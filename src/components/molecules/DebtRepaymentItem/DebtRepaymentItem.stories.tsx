import type { Meta, StoryObj } from "@storybook/react";
import { DebtRepaymentItem } from "./DebtRepaymentItem";

const meta: Meta<typeof DebtRepaymentItem> = { component: DebtRepaymentItem };
export default meta;
type Story = StoryObj<typeof DebtRepaymentItem>;

export const IncomeRepayment: Story = {
  args: { amount: 500000, date: "2026-05-20", note: "Trả một nửa", direction: "income" },
};

export const ExpenseRepayment: Story = {
  args: { amount: 1000000, date: "2026-05-22", note: null, direction: "expense" },
};
