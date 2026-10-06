import type { Meta, StoryObj } from "@storybook/nextjs";
import { AnalysisProgress } from "./AnalysisProgress";
const meta: Meta<typeof AnalysisProgress> = { component: AnalysisProgress, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof AnalysisProgress>;
export const Processing: Story = { args: { events: [
  { type: "step", key: "period", label: "Xác định kỳ ngân sách và phạm vi so sánh", status: "completed" },
  { type: "step", key: "spending", label: "Tổng hợp chi tiêu tiêu dùng và thu chi", status: "completed" },
  { type: "step", key: "cards", label: "Đối chiếu chi tiêu thẻ và trạng thái thanh toán", status: "running" },
] } };
export const Failed: Story = { args: { ...Processing.args, failed: true } };
export const LongContent: Story = { args: { events: [{ type: "step", key: "comparison", label: "So sánh chi tiêu tiêu dùng theo danh mục với phần kỳ trước có cùng số ngày đã trôi qua", status: "running" }] } };
