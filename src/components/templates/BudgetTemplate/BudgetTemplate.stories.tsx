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
  objective: "Giữ tiền ăn ngoài dưới 2 triệu",
  adjustments: [
    { id: 1, delta: 500_000, note: "Thưởng tháng 5", created_at: 1747200000 },
  ],
};

const mockCustomBudgets = [
  { id: 1, name: "Du lịch Đà Nẵng", amount: 3_000_000, is_active: 1, spent: 1_200_000, linked_transaction_count: 3 },
  { id: 2, name: "Mua laptop", amount: 25_000_000, is_active: 1, spent: 26_000_000, linked_transaction_count: 4 },
  { id: 3, name: "Quỹ khẩn cấp", amount: 5_000_000, is_active: 0, spent: 0, linked_transaction_count: 0 },
];

const dashboard = {
  total_expense: 4_200_000,
  monthly_budget: { id: 1, amount: 8_000_000, remaining: 3_800_000 },
  days_in_period: 31,
  days_elapsed: 15,
  pace_status: "under" as const,
};

function clickButton(canvasElement: HTMLElement, label: string) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );
  button?.click();
}

export const WithBudget: Story = {
  args: {
    month: "2025-05",
    period: { start: "2025-05-01", end: "2025-05-31" },
    monthlyBudget: mockBudget,
    customBudgets: mockCustomBudgets,
    dashboard,
    defaultMonthlyAmount: 10_000_000,
    loading: false,
    error: null,
    isCurrentMonth: true,
    onRetry: () => undefined,
    onCreateMonthlyBudget: noop,
    onCreateAdjustment: noop,
    onUpdateMonthlyObjective: noop,
    onCreateCustomBudget: noop,
    onEditCustomBudget: noop,
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

export const EditCustomBudget: Story = {
  args: WithBudget.args,
  play: async ({ canvasElement }) => {
    clickButton(canvasElement, "Sửa");
  },
};

export const BlockedDeletion: Story = {
  args: WithBudget.args,
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>('[aria-label="Xoá ngân sách Du lịch Đà Nẵng"]');
    button?.click();
  },
};

export const RequiredAdjustmentReason: Story = {
  args: WithBudget.args,
  play: async ({ canvasElement }) => {
    clickButton(canvasElement, "Điều chỉnh ngân sách");
  },
};

export const OverBudget: Story = {
  args: {
    ...WithBudget.args,
    dashboard: {
      ...dashboard,
      total_expense: 9_100_000,
      monthly_budget: { id: 1, amount: 8_000_000, remaining: -1_100_000 },
      pace_status: "over",
    },
  },
};

export const ErrorState: Story = {
  args: {
    ...WithBudget.args,
    error: "Kết nối bị gián đoạn. Dữ liệu của bạn chưa thay đổi.",
  },
};
