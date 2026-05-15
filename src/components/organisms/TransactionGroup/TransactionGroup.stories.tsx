import type { Meta, StoryObj } from "@storybook/nextjs";
import { TransactionGroup } from "./TransactionGroup";
import type { TransactionItemData } from "@/components/molecules/TransactionListItem";

const txns: TransactionItemData[] = [
  { id: 1, amount: 85000, type: "expense", emoji: "🍜", categoryName: "Ăn ngoài", categoryEmoji: null, note: "Phở bò", customBudgets: [] },
  { id: 2, amount: 45000, type: "expense", emoji: null, categoryName: "Đồ uống", categoryEmoji: "☕", note: null, customBudgets: [{ id: 1, name: "Trip Đà Lạt" }] },
];

const meta: Meta<typeof TransactionGroup> = {
  component: TransactionGroup,
  tags: ["autodocs"],
  args: { date: new Date().toISOString().substring(0, 10), transactions: txns },
  decorators: [(Story) => <div style={{ maxWidth: 390, border: "1px solid #e0e0e0" }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof TransactionGroup>;

export const Today: Story = {};
export const Yesterday: Story = {
  args: { date: new Date(Date.now() - 86400000).toISOString().substring(0, 10) },
};
export const OlderDate: Story = {
  args: { date: "2026-05-01" },
};
export const SingleTransaction: Story = {
  args: { transactions: [txns[0]] },
};
