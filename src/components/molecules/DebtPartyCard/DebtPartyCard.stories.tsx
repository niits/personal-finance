import type { Meta, StoryObj } from "@storybook/react";
import { DebtPartyCard } from "./DebtPartyCard";

const meta: Meta<typeof DebtPartyCard> = { component: DebtPartyCard };
export default meta;
type Story = StoryObj<typeof DebtPartyCard>;

const lendDebt = {
  id: "d1",
  type: "lend" as const,
  party: "Anh Nam",
  amount: 5000000,
  repaid: 2000000,
  remaining: 3000000,
  status: "open" as const,
  note: "Mua xe",
  createdAt: "2026-05-01",
  repayments: [
    { id: 1, amount: 1000000, date: "2026-05-10", note: null },
    { id: 2, amount: 1000000, date: "2026-05-20", note: "Lần 2" },
  ],
};

export const LendCollapsed: Story = {
  args: { debt: lendDebt, expanded: false },
};

export const LendExpanded: Story = {
  args: { debt: lendDebt, expanded: true, onAddRepayment: () => {} },
};

export const BorrowOpen: Story = {
  args: {
    debt: { ...lendDebt, id: "d2", type: "borrow", party: "Chị Lan", note: null, repaid: 0, remaining: 5000000 },
    expanded: false,
  },
};

export const Settled: Story = {
  args: {
    debt: { ...lendDebt, status: "settled", repaid: 5000000, remaining: 0 },
    expanded: false,
  },
};
