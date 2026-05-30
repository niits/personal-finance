import type { Meta, StoryObj } from "@storybook/react";
import { DebtPartyCard } from "./DebtPartyCard";

const meta: Meta<typeof DebtPartyCard> = { component: DebtPartyCard };
export default meta;
type Story = StoryObj<typeof DebtPartyCard>;

const base = {
  id: "d1",
  party: "Anh Nam",
  note: "Mua xe",
  due_date: null,
  status: "open" as const,
  opening_transaction_id: 1,
  created_at: "2026-05-01",
  opening_amount: 5000000,
  total_repaid: 2000000,
  remaining: 3000000,
  is_overdue: false,
  transactions: [],
};

export const Lend: Story = {
  args: { debt: { ...base, type: "lend" } },
};

export const Borrow: Story = {
  args: { debt: { ...base, id: "d2", type: "borrow", party: "Chị Lan", note: null, total_repaid: 0, remaining: 5000000 } },
};

export const Overdue: Story = {
  args: { debt: { ...base, type: "lend", due_date: "2026-04-01", is_overdue: true } },
};

export const Settled: Story = {
  args: { debt: { ...base, type: "lend", status: "settled", total_repaid: 5000000, remaining: 0, is_overdue: false } },
};
