import type { Meta, StoryObj } from "@storybook/nextjs";
import { StatCard } from "./StatCard";

const meta: Meta<typeof StatCard> = {
  component: StatCard,
  tags: ["autodocs"],
  decorators: [(Story) => <div style={{ maxWidth: 360, padding: 16 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof StatCard>;

export const VND: Story = {
  args: { title: "Tổng chi tiêu", value: 8500000, unit: "vnd", narrative: "Cao hơn tháng trước 12%" },
};
export const Percent: Story = {
  args: { title: "Ăn uống / tổng", value: 42.5, unit: "percent" },
};
export const Count: Story = {
  args: { title: "Số giao dịch", value: 38, unit: "count" },
};
export const Dark: Story = {
  args: { title: "Tiết kiệm", value: 11500000, unit: "vnd", dark: true },
  decorators: [(Story) => <div style={{ background: "#000", padding: 16, maxWidth: 360 }}><Story /></div>],
};
