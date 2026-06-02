import type { Meta, StoryObj } from "@storybook/nextjs";
import { LinkTransactionSheet } from "./LinkTransactionSheet";

const meta: Meta<typeof LinkTransactionSheet> = {
  component: LinkTransactionSheet,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14Pro" },
  },
  args: {
    onSelect: () => {},
    onClose: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof LinkTransactionSheet>;

export const WithCandidates: Story = {
  args: {
    loading: false,
    transactions: [
      { id: 1, amount: 15000000, date: "2026-05-01", note: "Lương tháng 5" },
      { id: 2, amount: 500000, date: "2026-05-12", note: "Bạn trả tiền ăn" },
      { id: 3, amount: 200000, date: "2026-05-20", note: null },
    ],
  },
};

export const Loading: Story = {
  args: { loading: true, transactions: [] },
};

export const Empty: Story = {
  args: { loading: false, transactions: [] },
};
