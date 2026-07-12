import type { Meta, StoryObj } from "@storybook/nextjs";
import { StatisticsTemplate } from "./StatisticsTemplate";

const meta: Meta<typeof StatisticsTemplate> = {
  component: StatisticsTemplate,
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
  generated_at: Math.floor(Date.now() / 1000) - 3600,
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
      { id: 1, type: "tool_call" as const, tool: "get_expense_by_category", label: "Truy vấn giao dịch tháng 5", callId: "abc1", stepIndex: 0 },
      { id: 2, type: "tool_result" as const, tool: "get_expense_by_category", rows: 42, callId: "abc1", durationMs: 320 },
    ],
  },
};

export const Error: Story = {
  args: {
    ...Ready.args,
    status: "error",
    report: null,
    error: { status: 500, error: "Internal Server Error", details: { message: "AI model timeout" } },
  },
};

// Regression guard: a "line" chart whose data carries a "Ngân sách" reference series
// (per the AI system prompt's forecast/reference-value rules) must render as two
// distinct colored lines, not collapse into one line with a bogus flat-then-vertical jump.
export const WithReferenceLineChart: Story = {
  args: {
    ...Ready.args,
    report: {
      ...mockReport,
      insights: [
        {
          title: "Dự báo chi tiêu vượt 28 triệu",
          summary: "Dự báo chi tiêu cuối kỳ là 28,223,082 đồng, gấp đôi ngân sách dự kiến.",
          type: "alert" as const,
          value_unit: "currency" as const,
          chart_type: "line" as const,
          chart_data: [
            { name: "2025-05-01", value: 0 },
            { name: "2025-05-06", value: 800_000 },
            { name: "2025-05-12", value: 28_223_082 },
            { name: "2025-05-12", value: 14_100_000, series: "Ngân sách" },
          ],
        },
      ],
    },
  },
};
