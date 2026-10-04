import type { Meta, StoryObj } from "@storybook/nextjs";
import { CategoriesTemplate } from "./CategoriesTemplate";

const meta: Meta<typeof CategoriesTemplate> = {
  component: CategoriesTemplate,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
};
export default meta;
type Story = StoryObj<typeof CategoriesTemplate>;

const noop = async () => ({});

const mockCategories = [
  {
    id: 1, name: "Nhà cửa và các khoản sinh hoạt định kỳ", emoji: "🏠", level: 1, type: "expense" as const, parent_id: null, system_kind: null,
    children: [
      { id: 3, name: "Tiền thuê nhà", emoji: "🔑", level: 2, type: "expense" as const, parent_id: 1, system_kind: null, children: [] },
      { id: 4, name: "Điện, nước và dịch vụ internet gia đình", emoji: "💡", level: 2, type: "expense" as const, parent_id: 1, system_kind: null, children: [] },
    ],
  },
  { id: 5, name: "Cho vay", emoji: "🤝", level: 1, type: "expense" as const, parent_id: null, system_kind: "lend", children: [] },
  { id: 6, name: "Gửi tiết kiệm", emoji: "🏦", level: 1, type: "expense" as const, parent_id: null, system_kind: "savings_deposit", children: [] },
  {
    id: 2, name: "Thu nhập", emoji: "💰", level: 1, type: "income" as const, parent_id: null, system_kind: null,
    children: [{ id: 7, name: "Lương", emoji: "💼", level: 2, type: "income" as const, parent_id: 2, system_kind: null, children: [] }],
  },
];

const defaultArgs = {
  categories: mockCategories,
  usageCounts: { 3: 8, 4: 3, 5: 1 },
  loading: false,
  seedState: "idle" as const,
  onRetry: () => {},
  onSeed: noop,
  onAddCategory: noop,
  onEditCategory: noop,
  onDeleteCategory: noop,
};

export const Default: Story = { args: defaultArgs };
export const Loading: Story = { args: { ...defaultArgs, categories: [], loading: true } };
export const Error: Story = { args: { ...defaultArgs, categories: [], loadError: "Máy chủ chưa phản hồi. Vui lòng thử lại." } };
export const Empty: Story = { args: { ...defaultArgs, categories: [] } };
export const SeedPending: Story = { args: { ...defaultArgs, categories: [], seedState: "loading" } };
export const SeedError: Story = { args: { ...defaultArgs, categories: [], seedState: "error", seedError: "Không thể tạo danh mục mẫu lúc này." } };
export const LongNames: Story = { args: defaultArgs, parameters: { viewport: { defaultViewport: "mobile1" } } };
