import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import { EmojiPicker } from "./EmojiPicker";

const meta: Meta<typeof EmojiPicker> = {
  component: EmojiPicker,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof EmojiPicker>;

function EmojiPickerWithState({ initial = null }: { initial?: string | null }) {
  const [emoji, setEmoji] = useState<string | null>(initial);
  return <div style={{ padding: 20, paddingBottom: 400 }}><EmojiPicker value={emoji} onChange={setEmoji} /></div>;
}

export const Default: Story = {
  render: () => <EmojiPickerWithState />,
};

export const WithValue: Story = {
  render: () => <EmojiPickerWithState initial="🍜" />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Chọn emoji" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  },
};
