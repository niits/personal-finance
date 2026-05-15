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
      title: "Chi tiêu theo danh mục",
      summary: "Ăn uống chiếm tỷ trọng lớn nhất trong tháng này.",
      chart_type: "bar",
      value_unit: "currency",
      chart_data: [
        { name: "Ăn uống", value: 2800000 },
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

export const PieChart: Story = {
  args: {
    insight: {
      type: "analysis",
      title: "Tỷ lệ chi tiêu",
      summary: "Phân bổ chi tiêu theo nhóm danh mục.",
      chart_type: "pie",
      value_unit: "percent",
      chart_data: [
        { name: "Ăn uống", value: 45 },
        { name: "Di chuyển", value: 20 },
        { name: "Giải trí", value: 15 },
        { name: "Khác", value: 20 },
      ],
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
