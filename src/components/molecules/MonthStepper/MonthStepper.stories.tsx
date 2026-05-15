import type { Meta, StoryObj } from "@storybook/nextjs";
import { MonthStepper } from "./MonthStepper";

const meta: Meta<typeof MonthStepper> = {
  component: MonthStepper,
  tags: ["autodocs"],
  args: { month: "2026-05", isLatest: false },
};
export default meta;
type Story = StoryObj<typeof MonthStepper>;

export const Default: Story = {};
export const CurrentMonth: Story = { args: { isLatest: true } };
export const Dark: Story = {
  args: { isLatest: false },
  decorators: [(Story) => (
    <div style={{ background: "#000", padding: 20 }}><Story /></div>
  )],
};
