import type { Meta, StoryObj } from "@storybook/nextjs";
import { Spinner } from "./Spinner";

const meta: Meta<typeof Spinner> = {
  component: Spinner,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm", label: "Đang xử lý…" } };
export const Custom: Story = { args: { label: "Đang tạo insight…" } };
