import type { Meta, StoryObj } from "@storybook/react";
import { NewCategoryRow } from "./NewCategoryRow";

const meta: Meta<typeof NewCategoryRow> = { component: NewCategoryRow };
export default meta;
type Story = StoryObj<typeof NewCategoryRow>;

const base = {
  tempId: "new:0",
  onChange: () => {},
};

export const Checked: Story = {
  args: { ...base, name: "Ăn uống", type: "expense", exampleNotes: ["cơm trưa", "cà phê"], checked: true },
};

export const Unchecked: Story = {
  args: { ...base, tempId: "new:1", name: "Lương thưởng", type: "income", exampleNotes: [], checked: false },
};

export const LongName: Story = {
  args: { ...base, tempId: "new:2", name: "Chi phí di chuyển và xăng xe hàng ngày", type: "expense", exampleNotes: ["grab", "xăng"], checked: true },
};
