import type { Meta, StoryObj } from "@storybook/nextjs";
import { TransactionForm } from "./TransactionForm";

// TransactionForm uses useSWR internally — in Storybook it fetches nothing
// (no real API) so category lists will be empty. Stories cover open/closed
// states and the edit vs create modes.
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
  args: {
    transaction: undefined,
  },
};

export const EditMode: Story = {
  args: {
    transaction: {
      id: 1,
      amount: 85000,
      type: "expense",
      emoji: "🍜",
      category: { id: 3, name: "Ăn uống", path: "Sinh hoạt > Ăn uống" },
      debt_id: null,
      note: "Bún bò hôm nay",
      date: "2026-05-15",
      custom_budgets: [{ id: 1, name: "Quỹ gia đình" }],
    },
  },
};

export const Closed: Story = {
  args: {
    open: false,
  },
};
