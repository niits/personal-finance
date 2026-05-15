import type { Meta, StoryObj } from "@storybook/nextjs";
import { EmojiIcon } from "./EmojiIcon";

const meta: Meta<typeof EmojiIcon> = {
  component: EmojiIcon,
  tags: ["autodocs"],
  decorators: [(Story) => <div style={{ display: "flex", gap: 16, padding: 16 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof EmojiIcon>;

export const WithEmoji: Story = { args: { emoji: "🍜", colorScheme: "expense" } };
export const NoEmojiExpense: Story = { args: { emoji: null, fallback: "Ă", colorScheme: "expense" } };
export const NoEmojiIncome: Story = { args: { emoji: null, fallback: "L", colorScheme: "income" } };
export const Neutral: Story = { args: { emoji: "📁", colorScheme: "neutral" } };
export const Small: Story = { args: { emoji: "☕", size: "sm", colorScheme: "expense" } };
