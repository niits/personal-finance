import type { Meta, StoryObj } from "@storybook/nextjs";
import { CurrencyDisplay } from "./CurrencyDisplay";

const meta: Meta<typeof CurrencyDisplay> = {
  component: CurrencyDisplay,
  tags: ["autodocs"],
  args: { amount: 1500000 },
};
export default meta;
type Story = StoryObj<typeof CurrencyDisplay>;

export const Default: Story = {};

export const Expense: Story = {
  args: { signed: true, signType: "expense" },
};

export const Income: Story = {
  args: { signed: true, signType: "income" },
};

export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const ExtraLarge: Story = { args: { size: "xl" } };
export const Muted: Story = { args: { muted: true } };
