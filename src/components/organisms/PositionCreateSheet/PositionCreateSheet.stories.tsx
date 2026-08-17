import type { Meta, StoryObj } from "@storybook/nextjs";
import { PositionCreateSheet } from "./PositionCreateSheet";

const meta: Meta<typeof PositionCreateSheet> = {
  component: PositionCreateSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { open: true, onClose: () => undefined, onSubmit: () => undefined },
};
export default meta;
type Story = StoryObj<typeof PositionCreateSheet>;

export const Default: Story = {};
export const Loading: Story = { args: { submitting: true } };
export const Error: Story = { args: { error: "Không thể tạo vị thế. Hãy thử lại với cùng thông tin." } };
