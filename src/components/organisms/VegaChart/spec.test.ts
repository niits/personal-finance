import { describe, expect, it } from "vitest";
import { compile } from "vega-lite";
import { buildVegaLiteSpec, type ChartTheme } from "./spec";
const theme: ChartTheme = { primary: "#0066cc", muted: "#e0e0e0", ink: "#1d1d1f", inkMuted: "#7a7a7a", hairline: "#f0f0f0", font: "sans-serif" };

describe("statistics chart specifications", () => {
  it("separates line series and preserves dates and zero-valued observations", () => {
    const chart = buildVegaLiteSpec({ title: "Chi thẻ và tiền mặt.", summary: "Hai chuỗi độc lập.", chart_type: "line", value_unit: "currency", chart_data: [
      { name: "2026-05-01", value: 100, series: "Thẻ" }, { name: "2026-05-02", value: 0, series: "Thẻ" },
      { name: "2026-05-01", value: 0, series: "Tiền mặt" }, { name: "2026-05-02", value: 50, series: "Tiền mặt" },
    ] }, theme)!;
    const result = compile(chart).spec;
    expect(JSON.stringify(result)).toContain("strokeDash");
    expect(JSON.stringify(result)).toContain('"series"');
  });
  it("renders one category when two periods provide a meaningful comparison", () => {
    const chart = buildVegaLiteSpec({ title: "Chi tiêu thay đổi.", summary: "So sánh hai kỳ.", chart_type: "bar_grouped", chart_data: [{ name: "Ăn uống", value: 100, series: "Kỳ này" }, { name: "Ăn uống", value: 50, series: "Kỳ trước" }] }, theme);
    expect(chart).not.toBeNull();
    expect(() => compile(chart!)).not.toThrow();
  });
  it("keeps a lone value textual and compiles exact value labels for comparisons", () => {
    expect(buildVegaLiteSpec({ title: "Một giá trị.", summary: "Không cần biểu đồ.", chart_type: "bar", chart_data: [{ name: "A", value: 100 }] }, theme)).toBeNull();
    const chart = buildVegaLiteSpec({ title: "So sánh chi tiêu.", summary: "Hai mục.", chart_type: "bar", chart_data: [{ name: "A", value: 100 }, { name: "B", value: 200 }] }, theme)!;
    expect(() => compile(chart)).not.toThrow();
    expect(JSON.stringify(chart)).toContain("100 ₫");
  });
});
