import type { Meta, StoryObj } from "@storybook/nextjs";
import { BudgetTemplate } from "./BudgetTemplate";

const meta: Meta<typeof BudgetTemplate> = {
  component: BudgetTemplate,
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
};
export default meta;
type Story = StoryObj<typeof BudgetTemplate>;

const noop = async () => ({});

const mockBudget = {
  id: 1,
  month: "2025-05",
  amount: 8_000_000,
  adjustments: [
    { id: 1, delta: 500_000, note: "Thưởng tháng 5", created_at: 1747200000 },
  ],
};

const mockCustomBudgets = [
  { id: 1, name: "Du lịch Đà Nẵng", amount: 3_000_000, is_active: 1, spent: 1_200_000 },
  { id: 2, name: "Mua laptop", amount: 25_000_000, is_active: 1, spent: 26_000_000 },
  { id: 3, name: "Quỹ khẩn cấp", amount: 5_000_000, is_active: 0, spent: 0 },
];

export const WithBudget: Story = {
  args: {
    month: "2025-05",
    period: { start: "2025-05-01", end: "2025-05-31" },
    monthlyBudget: mockBudget,
    customBudgets: mockCustomBudgets,
    loading: false,
    isCurrentMonth: true,
    onCreateMonthlyBudget: noop,
    onCreateAdjustment: noop,
    onCreateCustomBudget: noop,
    onToggleCustomBudget: noop,
    onDeleteCustomBudget: noop,
  },
};

export const NoBudget: Story = {
  args: {
    ...WithBudget.args,
    monthlyBudget: null,
    customBudgets: [],
  },
};

export const Loading: Story = {
  args: {
    ...WithBudget.args,
    loading: true,
  },
};
