import type { Meta, StoryObj } from "@storybook/nextjs";
import { PositionCloseCorrectionSheet } from "./PositionCloseCorrectionSheet";

const position = {
  id: "position-1",
  name: "Khoản vay của Lan",
  kind: "personal_receivable" as const,
  kindLabel: "Khoản phải thu",
  counterparty: "Lan",
  dueDate: null,
  note: null,
  balance: 0,
  status: "closed" as const,
  latestActivityDate: "2026-08-17",
  closedAt: "2026-08-17",
};

const meta: Meta<typeof PositionCloseCorrectionSheet> = {
  component: PositionCloseCorrectionSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    position,
    closedDate: "2026-08-17",
    submitting: false,
    error: null,
    onConfirm: () => undefined,
    onClose: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof PositionCloseCorrectionSheet>;

export const Confirmation: Story = {};
export const Loading: Story = { args: { submitting: true } };
export const Error: Story = { args: { error: "Không thể ghi điều chỉnh. Hãy thử lại an toàn." } };
