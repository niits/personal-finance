import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { CreditCardsTemplate } from "./CreditCardsTemplate";

const meta: Meta<typeof CreditCardsTemplate> = { component: CreditCardsTemplate, tags: ["autodocs"], parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj<typeof CreditCardsTemplate>;

const callbacks = { onPay: async () => null, onCreateGroup: async () => null, onUpdateGroup: async () => null, onDeleteGroup: async () => null, onUpdateFinanceAccount: async () => null, onDeleteFinanceAccount: async () => null };
const groups = [{ id: "group-1", name: "Thẻ hằng ngày", statement_close_day: 15, statements: [{ id: "statement-1", period_start: "2026-07-15", period_end: "2026-08-15", status: "unpaid" as const, paid_at: null, amount: 350000, purchases: [{ id: 1, amount: 350000, date: "2026-08-10", note: "Siêu thị" }] }] }];
const accounts = [{ id: "debt-1", type: "debt" as const, name: "Minh", debt_direction: "lend" as const, note: "Mượn mua xe", balance: -2500000, transactions: [{ id: 1, date: "2026-08-10", note: "Cho mượn", amount: 2500000, type: "expense" as const }] }, { id: "savings-1", type: "savings" as const, name: "Quỹ du lịch", debt_direction: null, note: "Đà Nẵng", balance: 5000000, transactions: [] }];

export const Default: Story = { args: { ...callbacks, payingStatementId: null, groups, accounts } };
export const Empty: Story = { args: { ...callbacks, groups: [], accounts: [], payingStatementId: null } };
export const Loading: Story = { args: { ...callbacks, groups: [], accounts: [], payingStatementId: null, groupsLoading: true, accountsLoading: true } };
export const PartialError: Story = { args: { ...callbacks, groups, accounts: [], payingStatementId: null, accountsError: "Tạm thời chưa tải được tài khoản tài chính." } };
export const ReverseBalances: Story = { args: { ...callbacks, groups: [], payingStatementId: null, accounts: [{ ...accounts[0], balance: 300000 }, { ...accounts[1], balance: 450000 }] } };

export const NewCardGroup: Story = {
  ...Default,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Chi thẻ" }));
    await userEvent.click(canvas.getByRole("button", { name: "Thêm nhóm thẻ" }));
    await expect(canvas.getByRole("dialog", { name: "Nhóm thẻ mới" })).toBeVisible();
  },
};

export const EditFinanceAccount: Story = {
  ...Default,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Minh/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Sửa thông tin" }));
    await expect(within(canvas.getByRole("dialog")).getByLabelText("Tên", { exact: true })).toHaveValue("Minh");
  },
};

export const GroupSaveError: Story = {
  args: { ...Default.args, onCreateGroup: async () => "Không thể lưu nhóm thẻ. Vui lòng thử lại." },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Chi thẻ" }));
    await userEvent.click(canvas.getByRole("button", { name: "Thêm nhóm thẻ" }));
    const dialog = within(canvas.getByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Tên nhóm"), "Thẻ sinh hoạt");
    await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
    await expect(dialog.getByRole("alert")).toHaveTextContent("Không thể lưu nhóm thẻ.");
  },
};
