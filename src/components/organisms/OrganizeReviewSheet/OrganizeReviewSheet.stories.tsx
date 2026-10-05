import type { Meta, StoryObj } from "@storybook/react";
import { OrganizeReviewSheet } from "./OrganizeReviewSheet";
import type { OrganizePreview } from "./types";

const meta: Meta<typeof OrganizeReviewSheet> = { component: OrganizeReviewSheet };
export default meta;
type Story = StoryObj<typeof OrganizeReviewSheet>;

const mockPreview: OrganizePreview = {
  new_categories: [
    { temp_id: "new:0", name: "Ăn uống", emoji: "🍜", type: "expense", parent_category_id: null, parent_category_name: null, example_notes: ["cơm trưa", "cà phê"] },
    { temp_id: "new:1", name: "Giải trí", emoji: "🎬", type: "expense", parent_category_id: null, parent_category_name: null, example_notes: ["Netflix"] },
  ],
  emoji_assignments: [
    { category_id: 1, category_name: "Ăn uống", current_emoji: null, emoji: "🍜" },
    { category_id: 2, category_name: "Giải trí", current_emoji: null, emoji: "🎬" },
    { category_id: 3, category_name: "Di chuyển", current_emoji: null, emoji: "🚗" },
  ],
  recategorizations: [
    {
      transaction_id: 10,
      note: "grab đi làm",
      current_category_id: 1,
      current_category_name: "Khác",
      current_updated_at: 1,
      suggested_category_id: 3,
      suggested_category_name: "Di chuyển",
      reason: "Grab là dịch vụ vận chuyển",
    },
    {
      transaction_id: 11,
      note: "Netflix tháng 5",
      current_category_id: 1,
      current_category_name: "Khác",
      current_updated_at: 1,
      suggested_category_id: "new:1",
      suggested_category_name: "Giải trí",
      reason: "Dịch vụ streaming giải trí",
    },
  ],
  emoji_reassignments: [
    { transaction_id: 20, note: "cà phê sáng với khách", current_emoji: "🍜", current_updated_at: 1, emoji: "☕", reason: "Ghi chú nói về cà phê" },
    { transaction_id: 21, note: "mua thuốc cảm", current_emoji: null, current_updated_at: 1, emoji: "💊", reason: "Ghi chú liên quan đến thuốc" },
  ],
};

export const Full: Story = {
  args: { open: true, preview: mockPreview, applying: false, onApply: () => {}, onClose: () => {} },
};

export const CategoriesOnly: Story = {
  args: {
    open: true,
    preview: { new_categories: mockPreview.new_categories, emoji_assignments: [], recategorizations: [], emoji_reassignments: [] },
    applying: false,
    onApply: () => {},
    onClose: () => {},
  },
};

export const EmojiReassignmentsOnly: Story = {
  args: {
    open: true,
    preview: { new_categories: [], emoji_assignments: [], recategorizations: [], emoji_reassignments: mockPreview.emoji_reassignments },
    applying: false,
    onApply: () => {},
    onClose: () => {},
  },
};

export const Empty: Story = {
  args: {
    open: true,
    preview: { new_categories: [], emoji_assignments: [], recategorizations: [], emoji_reassignments: [] },
    applying: false,
    onApply: () => {},
    onClose: () => {},
  },
};

export const Applying: Story = {
  args: { open: true, preview: mockPreview, applying: true, onApply: () => {}, onClose: () => {} },
};

export const StaleProposal: Story = {
  args: {
    open: true,
    preview: mockPreview,
    applying: false,
    applyBlocked: true,
    error: "Dữ liệu đã thay đổi. Vui lòng đóng bảng này và tạo đề xuất mới.",
    onApply: () => {},
    onClose: () => {},
  },
};

export const Closed: Story = {
  args: { open: false, preview: null, applying: false, onApply: () => {}, onClose: () => {} },
};
