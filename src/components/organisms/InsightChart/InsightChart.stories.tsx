import type { Meta, StoryObj } from "@storybook/nextjs";
import { InsightChart } from "./InsightChart";

const meta: Meta<typeof InsightChart> = {
  component: InsightChart,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    viewport: { defaultViewport: "iphone14Pro" },
  },
};
export default meta;
type Story = StoryObj<typeof InsightChart>;

export const BarChart: Story = {
  args: {
    insight: {
      type: "analysis",
      title: "Ăn uống chiếm phần lớn chi tiêu",
      summary: "Ăn uống chiếm tỷ trọng lớn nhất trong tháng này.",
      chart_type: "bar",
      value_unit: "currency",
      // highlight on the focal category — it renders accent, the rest grey.
      chart_data: [
        { name: "Ăn uống", value: 2800000, highlight: true },
        { name: "Di chuyển", value: 1200000 },
        { name: "Giải trí", value: 800000 },
        { name: "Mua sắm", value: 600000 },
      ],
    },
  },
};

export const LineChart: Story = {
  args: {
    insight: {
      type: "analysis",
      title: "Chi tiêu theo ngày",
      summary: "Xu hướng chi tiêu hàng ngày trong tháng.",
      chart_type: "line",
      value_unit: "currency",
      chart_data: [
        { name: "2026-05-01", value: 120000 },
        { name: "2026-05-05", value: 350000 },
        { name: "2026-05-10", value: 80000 },
        { name: "2026-05-15", value: 420000 },
      ],
    },
  },
};

// Focus follows the narrative, not the biggest bar: the highlighted row is the
// one the title is about, even when it is not the largest value.
export const HighlightNotLargest: Story = {
  args: {
    insight: {
      type: "alert",
      title: "Giải trí tăng vọt tháng này",
      summary: "Giải trí tuy nhỏ nhưng tăng mạnh — đáng chú ý.",
      chart_type: "bar",
      value_unit: "currency",
      chart_data: [
        { name: "Ăn uống", value: 2800000 },
        { name: "Di chuyển", value: 1200000 },
        { name: "Giải trí", value: 800000, highlight: true },
        { name: "Mua sắm", value: 600000 },
      ],
    },
  },
};

// A lone-bar chart conveys nothing — the renderer drops it and keeps title + summary.
export const SingleValueDropsChart: Story = {
  args: {
    insight: {
      type: "recommendation",
      title: "Nên đặt ngân sách cho quà tặng",
      summary: "Chi tiêu cho quà tặng hiện là 2.500.000 ₫. Hãy đặt ngân sách để tránh vượt chi.",
      chart_type: "bar",
      value_unit: "currency",
      chart_data: [{ name: "Cho tặng", value: 2500000 }],
    },
  },
};

export const NoChart: Story = {
  args: {
    insight: {
      type: "recommendation",
      title: "Tiết kiệm tốt hơn tháng trước",
      summary: "Bạn đã tiết kiệm được 15% so với tháng trước. Tiếp tục duy trì!",
    },
  },
};

export const AlertNoChart: Story = {
  args: {
    insight: {
      type: "alert",
      title: "Vượt ngân sách ăn uống",
      summary: "Chi tiêu ăn uống đã vượt 120% ngân sách đề ra.",
    },
  },
};

export const PeriodComparison: Story = {
  args: { insight: { type: "analysis", title: "Chi mua sắm tăng so với cùng phần kỳ trước.", summary: "Biểu đồ so sánh các phần kỳ có cùng số ngày đã trôi qua.", chart_type: "bar_grouped", value_unit: "currency", chart_data: [
    { name: "Chi tiêu > Sinh hoạt > Ăn uống", value: 1400000, series: "Kỳ này" }, { name: "Chi tiêu > Sinh hoạt > Ăn uống", value: 1000000, series: "Kỳ trước" },
    { name: "Chi tiêu > Cá nhân > Mua sắm", value: 2800000, series: "Kỳ này" }, { name: "Chi tiêu > Cá nhân > Mua sắm", value: 800000, series: "Kỳ trước" },
  ] } },
};
export const MultipleLines: Story = {
  args: { insight: { type: "analysis", title: "Chi thẻ và tiền mặt thay đổi theo ngày.", summary: "Hai chuỗi được phân biệt bằng màu và kiểu đường.", chart_type: "line", value_unit: "currency", chart_data: [
    { name: "2026-05-01", value: 120000, series: "Thẻ" }, { name: "2026-05-02", value: 300000, series: "Thẻ" }, { name: "2026-05-03", value: 0, series: "Thẻ" }, { name: "2026-05-04", value: 200000, series: "Thẻ" },
    { name: "2026-05-01", value: 50000, series: "Tiền mặt" }, { name: "2026-05-02", value: 0, series: "Tiền mặt" }, { name: "2026-05-03", value: 100000, series: "Tiền mặt" }, { name: "2026-05-04", value: 80000, series: "Tiền mặt" },
  ] } },
};

export const Donut: Story = { args: { insight: { ...BarChart.args!.insight!, chart_type: "donut" } } };
export const StackedPaymentParts: Story = { args: { insight: {
  type: "analysis", title: "Thẻ và tiền mặt cùng đóng góp vào chi tiêu.", summary: "Mỗi thanh thể hiện các phần không trùng nhau của một danh mục.", chart_type: "stacked_bar", value_unit: "currency",
  chart_data: [
    { name: "Ăn uống", value: 800000, series: "Thẻ tín dụng", highlight: true }, { name: "Ăn uống", value: 300000, series: "Tiền mặt" },
    { name: "Mua sắm", value: 1200000, series: "Thẻ tín dụng" }, { name: "Mua sắm", value: 400000, series: "Tiền mặt" },
  ],
} } };
export const ZeroCounterpart: Story = { args: { insight: { title: "Chi tiêu thẻ chưa thanh toán.", summary: "Khoản này đã nằm trong chi tiêu tiêu dùng.", chart_type: "bar", chart_data: [{ name: "Chưa thanh toán", value: 1035777 }, { name: "Đã thanh toán", value: 0 }] } } };
export const LongNames: Story = { args: { insight: { ...BarChart.args!.insight!, chart_data: [
  { name: "Chi tiêu > Sinh hoạt gia đình > Đi chợ và siêu thị cuối tuần", value: 123456789, highlight: true },
  { name: "Chi tiêu > Dịch vụ > Các dịch vụ phần mềm và lưu trữ trực tuyến", value: 87654321 },
] } } };
export const EmptyChart: Story = { args: { insight: { title: "Chưa đủ dữ liệu so sánh.", summary: "Nhận xét vẫn được giữ lại khi biểu đồ không có dữ liệu.", chart_type: "horizontal_bar", chart_data: [] } } };
