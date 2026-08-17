import type { Meta, StoryObj } from "@storybook/nextjs";
import { PositionActivityItem } from "./PositionActivityItem";

const meta: Meta<typeof PositionActivityItem> = {
  component: PositionActivityItem,
  tags: ["autodocs"],
  decorators: [(Story) => <ul className="max-w-xl bg-canvas px-md"><Story /></ul>],
};
export default meta;
type Story = StoryObj<typeof PositionActivityItem>;

const base = {
  type: "financial" as const,
  id: "event-1",
  code: "cardPurchase" as const,
  label: "Chi tiêu bằng thẻ",
  date: "2026-08-17",
  amount: 650_000,
  cashChange: 0,
  positionChange: -650_000,
  note: "Bữa tối",
  category: { id: 1, name: "Ăn uống", emoji: "🍜" },
  allocations: [{ customBudgetId: "trip", name: "Du lịch", amount: 650_000 }],
  reversal: { reversesActivityId: null, reversedByActivityId: null },
  isCloseSettlement: false,
};

export const CardExpense: Story = { args: { activity: base } };
export const CloseSettlement: Story = { args: { activity: { ...base, code: "closeSettlement", label: "Tất toán vị thế", cashChange: 650_000, positionChange: -650_000, category: null, allocations: [], isCloseSettlement: true } } };
export const Reversed: Story = { args: { activity: { ...base, reversal: { reversesActivityId: null, reversedByActivityId: "event-2" } } } };
export const Lifecycle: Story = { args: { activity: { type: "lifecycle", id: "closure:c1", code: "positionClosed", label: "Đã tất toán vị thế", date: "2026-08-17", recordedAt: 1_787_000_000, closureId: "c1", settlementActivityId: null, reversalActivityId: null } } };
