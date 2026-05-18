import type { Meta, StoryObj } from "@storybook/nextjs";
import { CategoriesTemplate } from "./CategoriesTemplate";

const meta: Meta<typeof CategoriesTemplate> = {
  component: CategoriesTemplate,
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
};
export default meta;
type Story = StoryObj<typeof CategoriesTemplate>;

const noop = async () => ({});

const mockCategories = [
  {
    id: 1, name: "Chi tiêu", emoji: null, level: 1, type: "expense" as const, parent_id: null,
    children: [
      { id: 3, name: "Ăn uống", emoji: "🍜", level: 2, type: "expense" as const, parent_id: 1, children: [] },
      { id: 4, name: "Di chuyển", emoji: "🚗", level: 2, type: "expense" as const, parent_id: 1, children: [] },
      { id: 5, name: "Mua sắm", emoji: "🛍️", level: 2, type: "expense" as const, parent_id: 1, children: [] },
    ],
  },
  {
    id: 2, name: "Thu nhập", emoji: null, level: 1, type: "income" as const, parent_id: null,
    children: [
      { id: 6, name: "Lương", emoji: "💼", level: 2, type: "income" as const, parent_id: 2, children: [] },
    ],
  },
];

export const Default: Story = {
  args: {
    categories: mockCategories,
    loading: false,
    suggestions: null,
    suggestState: "idle",
    recatSuggestions: null,
    recatState: "idle",
    onAddCategory: noop,
    onEditCategory: noop,
    onDeleteCategory: noop,
    onAcceptSuggestion: noop,
    onAcceptRecat: noop,
    onLoadSuggestions: () => {},
    onLoadRecatSuggestions: () => {},
    fillEmojiState: "idle",
    onFillEmoji: () => {},
  },
};

export const Empty: Story = {
  args: {
    ...Default.args,
    categories: [],
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true,
  },
};
