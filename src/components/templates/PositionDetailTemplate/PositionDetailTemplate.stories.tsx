import type { Meta, StoryObj } from "@storybook/nextjs";
import { PositionDetailTemplate } from "./PositionDetailTemplate";

const position = { id: "p1", name: "Khoản vay của Lan", kind: "personal_receivable" as const, kindLabel: "Khoản phải thu", counterparty: "Lan", dueDate: "2026-09-01", note: "Trả theo từng đợt", balance: 12_000_000, status: "open" as const, latestActivityDate: "2026-08-17", closedAt: null };
const activity = { type: "financial" as const, id: "e1", code: "moneyLent" as const, label: "Đã cho vay", date: "2026-08-01", amount: 12_000_000, cashChange: -12_000_000, positionChange: 12_000_000, note: null, category: null, allocations: [], reversal: { reversesActivityId: null, reversedByActivityId: null }, isCloseSettlement: false };
const meta: Meta<typeof PositionDetailTemplate> = { component: PositionDetailTemplate, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { loading: false, error: null, onBack: () => undefined, onRetry: () => undefined, onSelectAction: () => undefined, onReverseClose: () => undefined } };
export default meta;
type Story = StoryObj<typeof PositionDetailTemplate>;

export const Open: Story = { args: { data: { position, closure: null, activities: [activity], actions: [{ code: "lend", label: "Cho vay thêm", cashEffect: "pay", maxAmount: null }, { code: "collect", label: "Thu hồi", cashEffect: "receive", maxAmount: 12_000_000 }, { code: "close", label: "Tất toán", cashEffect: "receive", maxAmount: 12_000_000 }] } } };
export const Closed: Story = { args: { data: { position: { ...position, balance: 0, status: "closed", closedAt: "2026-08-17" }, closure: { id: "c1", date: "2026-08-17", settlementActivityId: "e2" }, activities: [activity, { ...activity, id: "e2", code: "closeSettlement", label: "Tất toán vị thế", date: "2026-08-17", cashChange: 12_000_000, positionChange: -12_000_000, isCloseSettlement: true }, { type: "lifecycle", id: "closure:c1", code: "positionClosed", label: "Đã tất toán vị thế", date: "2026-08-17", recordedAt: 1_787_000_000, closureId: "c1", settlementActivityId: "e2", reversalActivityId: null }], actions: [] } } };
export const Loading: Story = { args: { data: null, loading: true } };
export const Error: Story = { args: { data: null, error: "Không tìm thấy vị thế." } };
