import { describe, expect, it } from "vitest";
import { chartDatumLabel, chartTextSummary, formatChartValue } from "./presentation";

describe("VegaChart presentation", () => {
  it("provides a textual summary for chart data", () => {
    expect(chartTextSummary({
      title: "Chi theo nhóm",
      summary: "Ăn uống là khoản lớn nhất.",
      chart_type: "bar",
      value_unit: "currency",
      chart_data: [
        { name: "Ăn uống", value: 2_800_000 },
        { name: "Đi lại", value: 1_200_000 },
      ],
    })).toBe("Biểu đồ so sánh Ăn uống, Đi lại.");
  });

  it("formats accessible values with their financial unit", () => {
    expect(chartDatumLabel({ name: "Tuần 1", value: 25, series: "Thực tế" })).toBe("Tuần 1, Thực tế");
    expect(formatChartValue(2_800_000, "currency")).toBe("2.800.000 ₫");
    expect(formatChartValue(25.5, "percent")).toBe("25,5%");
  });
});
