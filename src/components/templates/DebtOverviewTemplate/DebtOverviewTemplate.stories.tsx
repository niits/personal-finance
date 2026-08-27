import type { Meta, StoryObj } from "@storybook/nextjs";
import { DebtOverviewTemplate } from "./DebtOverviewTemplate";

const meta: Meta<typeof DebtOverviewTemplate> = { component: DebtOverviewTemplate, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof DebtOverviewTemplate>;
export const Accounts: Story = { args: { accounts: [{ id: "s1", type: "savings", name: "Tiết kiệm 12 tháng", debt_direction: null, balance: -2000000, transactions: [{ id: 1, type: "expense", amount: 2000000, date: "2026-08-25", note: "Gửi tiền" }] }] } };
export const Empty: Story = { args: { accounts: [] } };
