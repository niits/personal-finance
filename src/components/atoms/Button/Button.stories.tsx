import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  component: Button,
  tags: ["autodocs"],
  args: { label: "Lưu giao dịch", size: "lg", fullWidth: true },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary", label: "Sửa" } };
export const Ghost: Story = { args: { variant: "ghost", label: "Bỏ qua", fullWidth: false } };
export const Destructive: Story = { args: { variant: "destructive", label: "Xoá" } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Small: Story = { args: { size: "sm", label: "Lọc", fullWidth: false } };
