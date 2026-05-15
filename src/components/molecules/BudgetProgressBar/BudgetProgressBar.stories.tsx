import type { Meta, StoryObj } from "@storybook/nextjs";
import { BudgetProgressBar } from "./BudgetProgressBar";

const meta: Meta<typeof BudgetProgressBar> = {
  component: BudgetProgressBar,
  tags: ["autodocs"],
  args: {
    budget: 15000000,
    spent: 9000000,
    remaining: 6000000,
    pacePct: 65,
  },
};
export default meta;
type Story = StoryObj<typeof BudgetProgressBar>;

export const UnderBudget: Story = {};

export const OverBudget: Story = {
  args: { spent: 16000000, remaining: -1000000 },
};

export const Dark: Story = {
  args: { dark: true },
  decorators: [(Story) => (
    <div style={{ background: "#000", padding: 20 }}><Story /></div>
  )],
};

export const DarkOverBudget: Story = {
  args: { dark: true, spent: 16000000, remaining: -1000000 },
  decorators: [(Story) => (
    <div style={{ background: "#000", padding: 20 }}><Story /></div>
  )],
};
