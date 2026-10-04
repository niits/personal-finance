import type { Meta, StoryObj } from "@storybook/nextjs";
import { ConfirmationSheet } from "./ConfirmationSheet";

const meta: Meta<typeof ConfirmationSheet> = {
  title: "Organisms/ConfirmationSheet",
  component: ConfirmationSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
  args: {
    open: true,
    title: "Đăng xuất khỏi tài khoản an@example.com?",
    consequence: "Bạn sẽ cần đăng nhập lại để xem dữ liệu tài chính của mình.",
    confirmLabel: "Đăng xuất",
    onCancel: () => undefined,
    onConfirm: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmationSheet>;

export const Default: Story = {};
export const Pending: Story = { args: { pending: true } };
export const Failure: Story = {
  args: { error: "Không thể đăng xuất. Vui lòng thử lại." },
};
