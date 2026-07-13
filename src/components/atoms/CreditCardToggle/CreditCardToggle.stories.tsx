import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { CreditCardToggle } from "./CreditCardToggle";

const meta: Meta<typeof CreditCardToggle> = {
  component: CreditCardToggle,
  tags: ["autodocs"],
  args: { checked: false, onChange: () => {} },
};
export default meta;
type Story = StoryObj<typeof CreditCardToggle>;

export const Off: Story = {};
export const On: Story = { args: { checked: true } };

export const Interactive: Story = {
  render: function Render(args) {
    const [checked, setChecked] = useState(args.checked);
    return <CreditCardToggle checked={checked} onChange={setChecked} />;
  },
};
