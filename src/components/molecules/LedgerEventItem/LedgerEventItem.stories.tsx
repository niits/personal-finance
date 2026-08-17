import type { Meta, StoryObj } from "@storybook/nextjs";
import { LedgerEventItem } from "./LedgerEventItem";
const base = { id: "e1", kind: "expense_cash" as const, amount: 120000, remainingRefundableAmount: 70000, date: "2026-08-17", note: "Bữa trưa", category: { id: 1, name: "Ăn uống", emoji: "🍜", path: "Sinh hoạt > Ăn uống" }, position: null, allocations: [], reversal: { reversesEventId: null, reversedByEventId: null, relatedEventId: null }, effects: { cash: -120000, position: 0, income: 0, expense: 120000, equity: 0 }, activity: { type: "expense" as const, label: "Chi tiêu", actions: { canRefund: true, canReverse: true } } };
const meta: Meta<typeof LedgerEventItem> = { component: LedgerEventItem, tags: ["autodocs"], decorators: [(Story) => <ul className="max-w-xl bg-canvas px-md"><Story /></ul>], args: { event: base, onRefund: () => undefined, onReverse: () => undefined } };
export default meta; type Story = StoryObj<typeof LedgerEventItem>;
export const Expense: Story = {};
export const PrincipalTransfer: Story = { args: { event: { ...base, kind: "cash_to_position", category: null, position: { id: "p1", name: "Tiền gửi", kind: "term_deposit" }, effects: { cash: -120000, position: 120000, income: 0, expense: 0, equity: 0 }, activity: { type: "transfer", label: "Chuyển tiền vào vị thế", actions: { canRefund: false, canReverse: true } } } } };
export const Corrected: Story = { args: { event: { ...base, reversal: { ...base.reversal, reversedByEventId: "r1" }, activity: { ...base.activity, actions: { canRefund: false, canReverse: false } } } } };
export const FullyRefunded: Story = { args: { event: { ...base, remainingRefundableAmount: 0, activity: { ...base.activity, actions: { canRefund: false, canReverse: false } } } } };
