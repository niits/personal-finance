import type { Meta, StoryObj } from "@storybook/react";
import { DebtProgressBar } from "./DebtProgressBar";

const meta: Meta<typeof DebtProgressBar> = { component: DebtProgressBar };
export default meta;
type Story = StoryObj<typeof DebtProgressBar>;

export const LendPartial: Story = {
  args: { openingAmount: 5000000, totalRepaid: 2000000, variant: "lend" },
};

export const BorrowPartial: Story = {
  args: { openingAmount: 5000000, totalRepaid: 2000000, variant: "borrow" },
};

export const Settled: Story = {
  args: { openingAmount: 5000000, totalRepaid: 5000000, variant: "lend" },
};

export const NotStarted: Story = {
  args: { openingAmount: 3000000, totalRepaid: 0, variant: "lend" },
};
