import type { Meta, StoryObj } from "@storybook/nextjs";
import { SWRConfig } from "swr";
import { TransactionForm } from "./TransactionForm";

const meta: Meta<typeof TransactionForm> = {
  component: TransactionForm,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14Pro" },
  },
  args: {
    open: true,
    onClose: () => {},
    onSaved: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof TransactionForm>;

export const CreateMode: Story = {
  args: { mode: { kind: "create" } },
};

export const CreateDebtOpen: Story = {
  args: { mode: { kind: "create-debt-open" } },
};

export const EditMode: Story = {
  args: {
    mode: {
      kind: "edit",
      transaction: {
        id: 1,
        amount: 85000,
        linked_amount: null,
        type: "expense",
        emoji: "🍜",
        category: { id: 3, name: "Ăn uống", path: "Sinh hoạt > Ăn uống" },
        debt_id: null,
        finance_account_id: null,
        credit_card_group_id: null,
        debt_party: null,
        debt_type: null,
        is_opening_tx: false,
        note: "Bún bò hôm nay",
        date: "2026-05-15",
        custom_budgets: [{ id: 1, name: "Quỹ gia đình" }],
      },
    },
  },
};

export const RepaymentMode: Story = {
  args: {
    mode: {
      kind: "repayment",
      debt: {
        id: "d1", type: "lend", party: "Minh", note: "Tiền điện",
        due_date: null, status: "open", opening_transaction_id: 1,
        created_at: "2026-05-01", opening_amount: 2500000,
        total_repaid: 1500000, remaining: 1000000, is_overdue: false,
        transactions: [],
      },
    },
  },
};

export const Closed: Story = {
  args: { open: false, mode: { kind: "create" } },
};

const movementCategories = [
  { id: 101, name: "Nhận tiền trả nợ", type: "income", system_kind: "debt_collection" },
  { id: 102, name: "Trả nợ", type: "expense", system_kind: "debt_repayment" },
  { id: 103, name: "Rút tiền gửi", type: "income", system_kind: "savings_withdrawal" },
].map((category) => ({ ...category, level: 1, parent_id: null, budget_behavior: "non_budget", children: [] }));

export const ReceiveRepayment: Story = {
  decorators: [(Story) => <SWRConfig value={{ provider: () => new Map(), fallback: {
    "/api/categories": { categories: movementCategories, usage_counts: {} },
  }, revalidateOnMount: false, revalidateOnFocus: false }}><Story /></SWRConfig>],
  args: { mode: { kind: "finance-counterpart", movement: {
    account: { id: "lend-1", name: "Khoản cho vay mua xe" }, amount: 2500000,
    type: "income", systemKind: "debt_collection", label: "Nhận tiền trả nợ",
  } } },
};

export const PayDebt: Story = {
  ...ReceiveRepayment,
  args: { mode: { kind: "finance-counterpart", movement: {
    account: { id: "borrow-1", name: "Khoản vay" }, amount: 1000000,
    type: "expense", systemKind: "debt_repayment", label: "Trả nợ",
  } } },
};

export const WithdrawSavings: Story = {
  ...ReceiveRepayment,
  args: { mode: { kind: "finance-counterpart", movement: {
    account: { id: "savings-1", name: "Tiền gửi tiết kiệm cho kế hoạch học tập và chi phí gia đình" }, amount: 150000000,
    type: "income", systemKind: "savings_withdrawal", label: "Rút tiền gửi",
  } } },
};

export const EditRelatedSavings: Story = {
  decorators: [(Story) => <SWRConfig value={{ provider: () => new Map(), fallback: {
    "/api/categories": { categories: [
      { id: 104, name: "Gửi tiền", type: "expense", system_kind: "savings_deposit", level: 1, parent_id: null, budget_behavior: "non_budget", children: [] },
      ...movementCategories,
    ], usage_counts: {} },
    "/api/finance-accounts": { accounts: [{ id: "savings-1", type: "savings", name: "Quỹ dự phòng", debt_direction: null, balance: -1500000, transactions: [
      { id: 1, type: "expense", amount: 2000000, date: "2026-05-01", note: "Gửi quỹ dự phòng" },
      { id: 2, type: "income", amount: 500000, date: "2026-05-15", note: "Rút tiền gửi" },
    ] }] },
    "/api/custom-budgets?active_only=true": { custom_budgets: [] },
    "/api/credit-card-groups": { groups: [] },
  }, revalidateOnMount: false, revalidateOnFocus: false }}><Story /></SWRConfig>],
  args: { mode: { kind: "edit", transaction: {
    id: 1, amount: 2000000, type: "expense", linked_amount: null, emoji: null,
    category: { id: 104, name: "Gửi tiền", path: "Gửi tiền" },
    finance_account_id: "savings-1", credit_card_group_id: null,
    debt_id: null, debt_party: null, debt_type: null, is_opening_tx: false,
    note: "Gửi quỹ dự phòng", date: "2026-05-01", custom_budgets: [],
  } } },
};
