import type { Meta, StoryObj } from "@storybook/nextjs";
import { BottomNavigation } from "./BottomNavigation";

const icon = <span>○</span>;

const meta: Meta<typeof BottomNavigation> = {
  title: "Organisms/BottomNavigation",
  component: BottomNavigation,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
  args: {
    destinations: [
      { href: "/", label: "Tổng quan", icon, active: true },
      { href: "/statistics", label: "Thống kê", icon, active: false },
      { href: "/cards", label: "Tài chính", icon, active: false },
      { href: "/account", label: "Tài khoản", icon, active: false },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof BottomNavigation>;

export const OverviewActive: Story = {};
export const AccountActive: Story = {
  args: {
    destinations: meta.args?.destinations?.map((destination) => ({
      ...destination,
      active: destination.href === "/account",
    })),
  },
};
