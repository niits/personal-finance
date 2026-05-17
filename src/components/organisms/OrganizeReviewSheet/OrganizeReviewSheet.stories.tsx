import type { Meta, StoryObj } from "@storybook/react";
import { OrganizeReviewSheet } from "./OrganizeReviewSheet";
import type { OrganizePreview } from "./types";

const meta: Meta<typeof OrganizeReviewSheet> = { component: OrganizeReviewSheet };
export default meta;
type Story = StoryObj<typeof OrganizeReviewSheet>;

const mockPreview: OrganizePreview = {
  new_categories: [
    { temp_id: "new:0", name: "Ăn uống", type: "expense", parent_category_id: null, example_notes: ["cơm trưa", "cà phê"] },
    { temp_id: "new:1", name: "Giải trí", type: "expense", parent_category_id: null, example_notes: ["Netflix"] },
  ],
  emoji_assignments: [
    { category_id: 1, emoji: "🍜" },
    { category_id: 2, emoji: "🎬" },
    { category_id: 3, emoji: "🚗" },
  ],
  recategorizations: [
    {
      transaction_id: 10,
      note: "grab đi làm",
      current_category_id: 1,
      current_category_name: "Khác",
      suggested_category_id: 3,
      suggested_category_name: "Di chuyển",
      reason: "Grab là dịch vụ vận chuyển",
    },
    {
      transaction_id: 11,
      note: "Netflix tháng 5",
      current_category_id: 1,
      current_category_name: "Khác",
      suggested_category_id: "new:1",
      suggested_category_name: "Giải trí",
      reason: "Dịch vụ streaming giải trí",
    },
  ],
};

export const Full: Story = {
  args: { open: true, preview: mockPreview, applying: false, onApply: () => {}, onClose: () => {} },
};

export const CategoriesOnly: Story = {
  args: {
    open: true,
    preview: { new_categories: mockPreview.new_categories, emoji_assignments: [], recategorizations: [] },
    applying: false,
    onApply: () => {},
    onClose: () => {},
  },
};

export const Empty: Story = {
  args: {
    open: true,
    preview: { new_categories: [], emoji_assignments: [], recategorizations: [] },
    applying: false,
    onApply: () => {},
    onClose: () => {},
  },
};

export const Applying: Story = {
  args: { open: true, preview: mockPreview, applying: true, onApply: () => {}, onClose: () => {} },
};

export const Closed: Story = {
  args: { open: false, preview: null, applying: false, onApply: () => {}, onClose: () => {} },
};
