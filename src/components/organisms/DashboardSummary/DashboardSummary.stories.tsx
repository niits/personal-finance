import type { Meta, StoryObj } from "@storybook/nextjs";
import { DashboardSummary } from "./DashboardSummary";

const base = {
  month: "2026-05",
  isLatestMonth: true,
  periodStart: "2026-04-29",
  periodEnd: "2026-05-28",
  totalExpense: 9500000,
  totalIncome: 0,
  savings: 0,
  monthlyBudget: { id: 1, amount: 15000000, remaining: 5500000 },
  daysElapsed: 14,
  daysInPeriod: 30,
  onPrevMonth: () => {},
  onNextMonth: () => {},
};

const meta: Meta<typeof DashboardSummary> = {
  component: DashboardSummary,
  tags: ["autodocs"],
  args: base,
};
export default meta;
type Story = StoryObj<typeof DashboardSummary>;

export const UnderBudget: Story = {};
export const OverBudget: Story = {
  args: { totalExpense: 16000000, monthlyBudget: { id: 1, amount: 15000000, remaining: -1000000 } },
};
export const WithIncome: Story = {
  args: { totalIncome: 25000000, savings: 15500000 },
};
export const NoBudget: Story = {
  args: { monthlyBudget: null },
};
export const Loading: Story = {
  args: { loading: true },
};
export const PastMonth: Story = {
  args: { month: "2026-04", isLatestMonth: false },
};
