import type { Meta, StoryObj } from "@storybook/nextjs";
import { CreditCardsTemplate } from "./CreditCardsTemplate";

const meta: Meta<typeof CreditCardsTemplate> = { component: CreditCardsTemplate, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof CreditCardsTemplate>;

export const Default: Story = { args: { payingStatementId: null, onPay: () => {}, onCreateGroup: () => {}, onCreateCard: () => {}, groups: [{ id: "group-1", name: "Thẻ hằng ngày", statement_close_day: 15, cards: [{ id: "card-1", name: "Visa" }], statements: [{ id: "statement-1", period_start: "2026-07-15", period_end: "2026-08-15", status: "unpaid", paid_at: null, amount: 350000, purchases: [{ id: 1, amount: 350000, date: "2026-08-10", note: "Siêu thị" }] }] }] } };
export const Empty: Story = { args: { groups: [], payingStatementId: null, onPay: () => {}, onCreateGroup: () => {}, onCreateCard: () => {} } };
