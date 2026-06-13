import type { Meta, StoryObj } from "@storybook/nextjs";
import { VegaChart } from "./VegaChart";

const meta: Meta<typeof VegaChart> = {
  component: VegaChart,
  parameters: {
    layout: "padded",
    viewport: { defaultViewport: "iphone14Pro" },
  },
};
export default meta;
type Story = StoryObj<typeof VegaChart>;

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
