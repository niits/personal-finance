import type { Meta, StoryObj } from "@storybook/nextjs";
import { PositionActionSheet } from "./PositionActionSheet";

const position = {
  id: "position-1", name: "Khoản vay của Lan", kind: "personal_receivable" as const,
  kindLabel: "Khoản phải thu", counterparty: "Lan", dueDate: null, note: null,
  balance: 12_000_000, status: "open" as const, latestActivityDate: "2026-08-17", closedAt: null,
};
const meta: Meta<typeof PositionActionSheet> = {
  component: PositionActionSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { position, onClose: () => undefined, onSubmit: () => undefined },
};
export default meta;
type Story = StoryObj<typeof PositionActionSheet>;

export const Movement: Story = { args: { action: { code: "collect", label: "Thu hồi", cashEffect: "receive", maxAmount: 12_000_000 } } };
export const CloseReceivingCash: Story = { args: { action: { code: "close", label: "Tất toán", cashEffect: "receive", maxAmount: 12_000_000 } } };
export const CloseWithoutMovement: Story = { args: { position: { ...position, balance: 0, status: "settled" }, action: { code: "close", label: "Tất toán", cashEffect: "none", maxAmount: 0 } } };
export const Loading: Story = { args: { action: { code: "close", label: "Tất toán", cashEffect: "pay", maxAmount: 12_000_000 }, submitting: true } };
export const Error: Story = { args: { action: { code: "collect", label: "Thu hồi", cashEffect: "receive", maxAmount: 12_000_000 }, error: "Không thể ghi nhận. Bạn có thể thử lại an toàn." } };
