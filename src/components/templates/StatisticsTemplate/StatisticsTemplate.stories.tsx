import type { Meta, StoryObj } from "@storybook/nextjs";
import { StatisticsTemplate } from "./StatisticsTemplate";

const meta: Meta<typeof StatisticsTemplate> = {
  component: StatisticsTemplate,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", viewport: { defaultViewport: "iphone14Pro" } },
};
export default meta;
type Story = StoryObj<typeof StatisticsTemplate>;

const mockReport = {
  found: true as const,
  period_key: "2025-05",
  insights: [
    {
      title: "Chi tiêu ăn uống tăng 12%",
      summary: "Trong tháng 5, bạn chi 2.4 triệu cho ăn uống, cao hơn tháng trước 12%. Đây là danh mục chiếm tỷ lệ lớn nhất.",
      type: "analysis" as const,
      value_unit: "currency" as const,
      chart_type: "bar" as const,
      chart_data: [
        { name: "Ăn uống", value: 2_400_000 },
        { name: "Di chuyển", value: 800_000 },
        { name: "Mua sắm", value: 600_000 },
        { name: "Giải trí", value: 400_000 },
      ],
    },
  ],
  is_dirty: false,
  is_current_period: true,
  generated_at: 1747303200,
};

export const Ready: Story = {
  args: {
    selectedMonth: "2025-05",
    isAtUpperBound: true,
    status: "ready",
    report: mockReport,
    agentSteps: [],
    refreshing: false,
    error: null,
    regenError: null,
    onPrevMonth: () => {},
    onNextMonth: () => {},
    onRegenerate: () => {},
    onRetry: () => {},
    onDismissRegenError: () => {},
  },
};

export const Loading: Story = {
  args: {
    ...Ready.args,
    status: "loading",
    report: null,
  },
};

export const Generating: Story = {
  args: {
    ...Ready.args,
    status: "generating",
    report: null,
    agentSteps: [
      { id: 1, type: "step", key: "period", label: "Xác định kỳ ngân sách và phạm vi so sánh", status: "completed" },
      { id: 2, type: "step", key: "spending", label: "Tổng hợp chi tiêu tiêu dùng và thu chi", status: "completed" },
      { id: 3, type: "step", key: "cards", label: "Đối chiếu chi tiêu thẻ và trạng thái thanh toán", status: "completed" },
      { id: 4, type: "step", key: "narrative", label: "Diễn giải số liệu và đề xuất hành động", status: "running" },
    ],
  },
};

export const NoReport: Story = {
  args: {
    ...Ready.args,
    status: "no-report",
    report: null,
  },
};

export const DirtyReportRefreshing: Story = {
  args: {
    ...Ready.args,
    report: { ...mockReport, is_dirty: true },
    refreshing: true,
    agentSteps: Generating.args?.agentSteps,
  },
};

export const DirtyReportRefreshFailed: Story = {
  args: {
    ...Ready.args,
    report: { ...mockReport, is_dirty: true },
    regenError: {
      status: 500,
      error: "Internal Server Error",
      details: { message: "Private model timeout", stack: "private stack" },
    },
  },
};

export const Error: Story = {
  args: {
    ...Ready.args,
    status: "error",
    report: null,
    error: {
      status: 500,
      error: "Internal Server Error",
      details: { message: "Private model timeout", stack: "private stack", cause: { secret: true } },
    },
  },
};

export const CreditCardReport: Story = {
  args: {
    ...Ready.args,
    report: { ...mockReport, insights: [{ type: "analysis", topic: "cards", title: "Chi thẻ chiếm 75% chi tiêu tiêu dùng.", summary: "Trong kỳ, chi thẻ là 3.000.000 ₫, trong đó 2.000.000 ₫ chưa thanh toán. Đây là một phần của tổng chi tiêu 4.000.000 ₫.", chart_type: "bar", value_unit: "currency", chart_data: [{ name: "Thẻ tín dụng", value: 3000000, highlight: true }, { name: "Tiền mặt", value: 1000000 }] }] },
  },
};
