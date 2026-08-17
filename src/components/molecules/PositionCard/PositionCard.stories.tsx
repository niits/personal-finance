import type { Meta, StoryObj } from "@storybook/nextjs";
import { PositionCard } from "./PositionCard";

const meta: Meta<typeof PositionCard> = {
  component: PositionCard,
  tags: ["autodocs"],
  decorators: [(Story) => <div className="max-w-xl bg-canvas-parchment p-lg"><Story /></div>],
  args: { href: "/debts/position-1" },
};
export default meta;
type Story = StoryObj<typeof PositionCard>;

const base = {
  id: "position-1",
  name: "Khoản vay của Lan",
  kind: "personal_receivable" as const,
  kindLabel: "Khoản phải thu",
  counterparty: "Lan",
  dueDate: "2026-09-01",
  note: null,
  balance: 12_000_000,
  status: "open" as const,
  latestActivityDate: "2026-08-17",
  closedAt: null,
};

export const Receivable: Story = { args: { position: base } };
export const OverduePayable: Story = { args: { position: { ...base, kind: "personal_payable", kindLabel: "Khoản phải trả", balance: -4_500_000, status: "overdue" } } };
export const Closed: Story = { args: { position: { ...base, balance: 0, status: "closed", closedAt: "2026-08-17" } } };
