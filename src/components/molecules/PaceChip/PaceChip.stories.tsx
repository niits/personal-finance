import type { Meta, StoryObj } from "@storybook/nextjs";
import { PaceChip } from "./PaceChip";

const meta: Meta<typeof PaceChip> = {
  component: PaceChip,
  tags: ["autodocs"],
  decorators: [(Story) => <div style={{ padding: 16 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof PaceChip>;

export const Under: Story = { args: { status: "under", remainingAmount: 3500000 } };
export const Over: Story = { args: { status: "over", remainingAmount: -800000 } };
export const NoBudget: Story = { args: { status: "no_budget" } };
