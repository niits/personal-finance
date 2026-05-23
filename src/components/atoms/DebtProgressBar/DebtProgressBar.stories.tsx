import type { Meta, StoryObj } from "@storybook/react";
import { DebtProgressBar } from "./DebtProgressBar";

const meta: Meta<typeof DebtProgressBar> = { component: DebtProgressBar };
export default meta;
type Story = StoryObj<typeof DebtProgressBar>;

export const Partial: Story = {
  args: { principal: 5000000, repaid: 2000000 },
};

export const Settled: Story = {
  args: { principal: 5000000, repaid: 5000000 },
};

export const NotStarted: Story = {
  args: { principal: 3000000, repaid: 0 },
};
