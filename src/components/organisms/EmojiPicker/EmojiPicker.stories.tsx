import type { Meta, StoryObj } from "@storybook/nextjs";
import { EmojiPicker } from "./EmojiPicker";
import { useState } from "react";

const meta: Meta<typeof EmojiPicker> = {
  component: EmojiPicker,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof EmojiPicker>;

export const Default: Story = {
  render: () => {
    const [emoji, setEmoji] = useState<string | null>(null);
    return <div style={{ padding: 20, paddingBottom: 400 }}><EmojiPicker value={emoji} onChange={setEmoji} /></div>;
  },
};

export const WithValue: Story = {
  render: () => {
    const [emoji, setEmoji] = useState<string | null>("🍜");
    return <div style={{ padding: 20, paddingBottom: 400 }}><EmojiPicker value={emoji} onChange={setEmoji} /></div>;
  },
};
