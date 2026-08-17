import type { Meta, StoryObj } from "@storybook/nextjs";
import { PositionsTemplate } from "./PositionsTemplate";

const receivable = {
  id: "p1", name: "Khoản vay của Lan", kind: "personal_receivable" as const, kindLabel: "Khoản phải thu",
  counterparty: "Lan", dueDate: "2026-09-01", note: null, balance: 12_000_000, status: "open" as const,
  latestActivityDate: "2026-08-17", closedAt: null,
};
const groups = [
  { code: "creditCards" as const, label: "Thẻ tín dụng", normalTotal: 4_500_000, oppositeSignTotal: 0, count: 1, positions: [{ ...receivable, id: "p2", name: "Thẻ chính", kind: "credit_card" as const, kindLabel: "Thẻ tín dụng", counterparty: "Ngân hàng", balance: -4_500_000 }] },
  { code: "owedToMe" as const, label: "Người khác nợ tôi", normalTotal: 12_000_000, oppositeSignTotal: 0, count: 1, positions: [receivable] },
  { code: "iOwe" as const, label: "Tôi đang nợ", normalTotal: 0, oppositeSignTotal: 0, count: 0, positions: [] },
  { code: "termDeposits" as const, label: "Tiền gửi kỳ hạn", normalTotal: 0, oppositeSignTotal: 0, count: 0, positions: [] },
];
const meta: Meta<typeof PositionsTemplate> = {
  component: PositionsTemplate,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { loading: false, error: null, historyExpanded: false, onToggleHistory: () => undefined, onCreatePosition: () => undefined, onRetry: () => undefined },
};
export default meta;
type Story = StoryObj<typeof PositionsTemplate>;

export const Grouped: Story = { args: { data: { groups, closedHistory: [] } } };
export const Empty: Story = { args: { data: { groups: groups.map((group) => ({ ...group, normalTotal: 0, count: 0, positions: [] })), closedHistory: [] } } };
export const WithClosedHistory: Story = { args: { historyExpanded: true, data: { groups, closedHistory: [{ ...receivable, id: "closed", name: "Tiền gửi 6 tháng", kind: "term_deposit", kindLabel: "Tiền gửi kỳ hạn", balance: 0, status: "closed", closedAt: "2026-08-10" }] } } };
export const Loading: Story = { args: { data: null, loading: true } };
export const Error: Story = { args: { data: null, error: "Sổ tài chính chưa được khởi tạo." } };
