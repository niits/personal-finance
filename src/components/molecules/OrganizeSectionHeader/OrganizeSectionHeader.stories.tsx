import type { Meta, StoryObj } from "@storybook/react";
import { OrganizeSectionHeader } from "./OrganizeSectionHeader";

const meta: Meta<typeof OrganizeSectionHeader> = { component: OrganizeSectionHeader };
export default meta;
type Story = StoryObj<typeof OrganizeSectionHeader>;

export const WithCount: Story = {
  args: { title: "Danh mục mới", count: 3 },
};

export const AutoIncluded: Story = {
  args: { title: "Emoji", count: 5, autoIncluded: true },
};

export const Empty: Story = {
  args: { title: "Phân loại lại", count: 0 },
};
