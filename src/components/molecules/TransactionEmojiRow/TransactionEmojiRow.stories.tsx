import type { Meta, StoryObj } from "@storybook/react";
import { TransactionEmojiRow } from "./TransactionEmojiRow";

const meta: Meta<typeof TransactionEmojiRow> = { component: TransactionEmojiRow };
export default meta;
type Story = StoryObj<typeof TransactionEmojiRow>;

const base = { transactionId: 1, onChange: () => {} };

export const Checked: Story = {
  args: { ...base, note: "cà phê sáng với khách", currentEmoji: "🍜", suggestedEmoji: "☕", reason: "Ghi chú nói về cà phê", checked: true },
};

export const Unchecked: Story = {
  args: { ...base, transactionId: 2, note: "mua thuốc cảm", currentEmoji: "🛒", suggestedEmoji: "💊", reason: "Ghi chú liên quan đến thuốc men", checked: false },
};

export const NoCurrentEmoji: Story = {
  args: { ...base, transactionId: 3, note: "vé xem phim cuối tuần", currentEmoji: null, suggestedEmoji: "🎬", reason: "Ghi chú về xem phim", checked: true },
};

export const LongReason: Story = {
  args: { ...base, transactionId: 4, note: "đổ xăng đi công tác", currentEmoji: "🍱", suggestedEmoji: "⛽", reason: "Ghi chú mô tả việc đổ xăng cho chuyến công tác xa, không liên quan đến danh mục ăn uống hiện tại", checked: true },
};
