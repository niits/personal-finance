import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ModalSheet, type ModalSheetProps } from "./ModalSheet";

function Example(args: ModalSheetProps) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Sửa thông tin</button>
    <ModalSheet {...args} open={open} onDismiss={() => setOpen(false)}>
      <label className="mt-md block">Tên<input className="mt-xs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-sm text-[17px]" defaultValue="Khoản cho vay" /></label>
      <button type="button" disabled={args.pending} onClick={() => setOpen(false)} className="mt-lg min-h-11 w-full rounded-md border border-hairline bg-canvas">Hủy</button>
    </ModalSheet>
  </>;
}

const meta: Meta<typeof ModalSheet> = {
  component: ModalSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { title: "Sửa thông tin" },
  render: (args) => <Example {...args} />,
};
export default meta;
type Story = StoryObj<typeof ModalSheet>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Sửa thông tin" });
    await userEvent.click(trigger);
    const dialog = canvas.getByRole("dialog", { name: "Sửa thông tin" });
    await expect(dialog).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    await expect(trigger).toHaveFocus();
  },
};
export const LongTitle: Story = {
  args: { title: "Đổi tên danh mục chi phí sinh hoạt và các khoản thanh toán định kỳ của gia đình" },
  play: async ({ canvas }) => { await userEvent.click(canvas.getByRole("button", { name: "Sửa thông tin" })); },
};
export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sửa thông tin" }));
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByRole("dialog")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Hủy" })).toBeDisabled();
  },
};
