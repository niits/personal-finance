import type { Meta, StoryObj } from "@storybook/nextjs";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  component: Badge,
  tags: ["autodocs"],
  args: { label: "Trip Đà Lạt" },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: "primary" } };
export const Success: Story = { args: { variant: "success", label: "Còn dư" } };
export const Danger: Story = { args: { variant: "danger", label: "Vượt budget" } };
export const Muted: Story = { args: { variant: "muted", label: "+3" } };
export const Medium: Story = { args: { size: "md", variant: "primary" } };
