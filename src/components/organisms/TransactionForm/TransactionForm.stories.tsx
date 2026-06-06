import type { Meta, StoryObj } from "@storybook/nextjs";
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
