import { expect, fn, userEvent } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs";
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


const structuralPreview: OrganizePreview = {
  new_categories: [], emoji_assignments: [], recategorizations: [], emoji_reassignments: [],
  category_snapshot: [
    { id: 1, name: "Sinh hoạt", type: "expense", parent_id: null, level: 1, sort_order: 0, emoji: null, system_kind: null, budget_behavior: "consumption", child_count: 0, transaction_count: 0 },
    { id: 2, name: "Học tập và phát triển chuyên môn", type: "expense", parent_id: null, level: 1, sort_order: 1, emoji: null, system_kind: null, budget_behavior: "consumption", child_count: 0, transaction_count: 0 },
  ],
  category_merges: [{
    source_category_id: 4, source_category_name: "Chi phí khám chữa bệnh và chăm sóc sức khỏe định kỳ",
    target_category_id: 3, target_category_name: "Y tế và sức khỏe", transaction_count: 125,
    reason: "Hai danh mục cùng phục vụ chi phí y tế. Giữ danh mục có nhiều giao dịch hơn.",
  }],
  category_moves: [{ category_id: 2, category_name: "Học tập và phát triển chuyên môn", parent_category_id: 1, parent_category_name: "Sinh hoạt", sort_order: 0, reason: "Đưa nhóm học tập vào nhánh chi phí sinh hoạt." }],
};

export const StructuralChanges: Story = {
  args: { open: true, preview: structuralPreview, applying: false, onApply: fn(), onClose: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Bỏ chọn tất cả" }));
    await expect(canvas.getByRole("button", { name: "Chưa chọn thay đổi" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("checkbox", { name: "Áp dụng nhóm thay đổi cấu trúc" }));
    await userEvent.click(canvas.getByRole("button", { name: /^Áp dụng$/ }));
    await expect(args.onApply).toHaveBeenCalledWith(expect.objectContaining({ category_merges: [], category_moves: structuralPreview.category_moves }));
    await userEvent.click(canvas.getByRole("button", { name: /^Chọn tất cả$/ }));
    await userEvent.click(canvas.getByRole("button", { name: /^Áp dụng$/ }));
    await expect(args.onApply).toHaveBeenLastCalledWith(expect.objectContaining({ category_merges: structuralPreview.category_merges }));
  },
};

export const StructuralChangesPending: Story = {
  args: { ...StructuralChanges.args, applying: true },
};

export const ExpandedEmoji: Story = {
  args: { open: true, preview: { ...structuralPreview, category_merges: [], category_moves: [], emoji_assignments: [{ category_id: 2, category_name: "Khám phá khoa học", current_emoji: null, emoji: "🧑🏽‍🚀" }] }, applying: false, onApply: fn(), onClose: fn() },
};
