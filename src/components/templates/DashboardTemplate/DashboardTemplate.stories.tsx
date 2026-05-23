import type { Meta, StoryObj } from "@storybook/nextjs";
import { DashboardTemplate } from "./DashboardTemplate";

const meta: Meta<typeof DashboardTemplate> = {
  component: DashboardTemplate,
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
};
export default meta;
type Story = StoryObj<typeof DashboardTemplate>;

const mockData = {
  month: "2025-05",
  period_start: "2025-05-01",
  period_end: "2025-05-31",
  total_expense: 4_200_000,
  total_income: 15_000_000,
  savings: 10_800_000,
  monthly_budget: { id: 1, amount: 8_000_000, remaining: 3_800_000 },
  days_in_period: 31,
  days_elapsed: 15,
  days_remaining: 16,
  pace_status: "under" as const,
  daily_expenses: [],
};

const mockTransactions = [
  {
    id: 1, amount: 85_000, type: "expense" as const, emoji: "🍜",
    category: { id: 2, name: "Ăn uống", emoji: "🍜", path: "Chi tiêu / Ăn uống" },
    root_category_name: "Chi tiêu",
    note: "Bún bò sáng", date: "2025-05-15",
    custom_budgets: [], debt_id: null, created_at: 1747296000, updated_at: 1747296000,
  },
  {
    id: 2, amount: 320_000, type: "expense" as const, emoji: null,
    category: { id: 3, name: "Di chuyển", emoji: "🚗", path: "Chi tiêu / Di chuyển" },
    root_category_name: "Chi tiêu",
    note: "Xăng xe", date: "2025-05-15",
    custom_budgets: [{ id: 1, name: "Du lịch tháng 6" }], debt_id: null,
    created_at: 1747282000, updated_at: 1747282000,
  },
  {
    id: 3, amount: 200_000, type: "expense" as const, emoji: "☕",
    category: { id: 4, name: "Cafe", emoji: "☕", path: "Chi tiêu / Cafe" },
    root_category_name: "Chi tiêu",
    note: null, date: "2025-05-14",
    custom_budgets: [], debt_id: null, created_at: 1747209600, updated_at: 1747209600,
  },
];

export const Default: Story = {
  args: {
    data: mockData,
    transactions: mockTransactions,
    loading: false,
    selectedMonth: "2025-05",
    isCurrentMonth: true,
    deleting: false,
    actionTxn: null,
    formOpen: false,
    editTxn: undefined,
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onSetActionTxn: () => {},
    onOpenForm: () => {},
    onCloseForm: () => {},
    onSaved: () => {},
    onDelete: () => {},
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    data: null,
    transactions: [],
    loading: true,
  },
};

export const NoBudget: Story = {
  args: {
    ...Default.args,
    data: { ...mockData, monthly_budget: null },
    transactions: [],
  },
};

export const Empty: Story = {
  args: {
    ...Default.args,
    transactions: [],
  },
};
