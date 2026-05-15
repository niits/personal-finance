import type { Meta, StoryObj } from "@storybook/nextjs";
import { TransactionListItem } from "./TransactionListItem";

const base = {
  id: 1,
  amount: 85000,
  type: "expense" as const,
  emoji: "🍜",
  categoryName: "Ăn ngoài",
  categoryEmoji: null,
  note: "Phở bò Hàng Đồng",
  customBudgets: [],
};

const meta: Meta<typeof TransactionListItem> = {
  component: TransactionListItem,
  tags: ["autodocs"],
  args: { transaction: base },
  decorators: [(Story) => <div style={{ maxWidth: 390, border: "1px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof TransactionListItem>;

export const Expense: Story = {};
export const Income: Story = {
  args: {
    transaction: { ...base, id: 2, amount: 20000000, type: "income", emoji: null, categoryName: "Lương", note: "Tháng 5/2026", customBudgets: [] },
  },
};
export const WithBudgets: Story = {
  args: {
    transaction: { ...base, customBudgets: [{ id: 1, name: "Trip Đà Lạt" }, { id: 2, name: "Mua laptop" }] },
  },
};
export const ManyBudgets: Story = {
  args: {
    transaction: { ...base, customBudgets: [{ id: 1, name: "Trip Đà Lạt" }, { id: 2, name: "Mua laptop" }, { id: 3, name: "Tết" }] },
  },
};
export const NoEmoji: Story = {
  args: {
    transaction: { ...base, emoji: null, categoryEmoji: null },
  },
};
export const WithDivider: Story = {
  args: { showDivider: true },
};
