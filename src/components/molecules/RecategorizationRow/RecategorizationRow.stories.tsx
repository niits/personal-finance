import type { Meta, StoryObj } from "@storybook/react";
import { RecategorizationRow } from "./RecategorizationRow";

const meta: Meta<typeof RecategorizationRow> = { component: RecategorizationRow };
export default meta;
type Story = StoryObj<typeof RecategorizationRow>;

const base = { transactionId: 1, onChange: () => {} };

export const Checked: Story = {
  args: { ...base, note: "ăn trưa văn phòng", currentCategory: "Di chuyển", suggestedCategory: "Ăn uống", reason: "Ghi chú liên quan đến ăn uống", checked: true },
};

export const Unchecked: Story = {
  args: { ...base, transactionId: 2, note: "grab đi làm", currentCategory: "Ăn uống", suggestedCategory: "Di chuyển", reason: "Grab là dịch vụ vận chuyển", checked: false },
};

export const NewCategory: Story = {
  args: { ...base, transactionId: 3, note: "Netflix tháng 5", currentCategory: "Khác", suggestedCategory: "Giải trí", isNewCategory: true, reason: "Đây là chi phí dịch vụ streaming", checked: true },
};

export const LongReason: Story = {
  args: { ...base, transactionId: 4, note: "techcombank 50k", currentCategory: "Khác", suggestedCategory: "Phí ngân hàng", reason: "Khoản phí dịch vụ ngân hàng hàng tháng, bao gồm phí SMS và phí quản lý tài khoản", checked: true },
};
