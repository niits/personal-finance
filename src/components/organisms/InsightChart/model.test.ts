import { describe, expect, it } from "vitest";
import { chartModel, pivotSeries } from "./model";
import type { Insight } from "@/lib/statistics-report";
const insight = (values: number[], type: Insight["chart_type"] = "bar"): Insight => ({ title: "Title.", summary: "Summary.", chart_type: type, chart_data: values.map((value, i) => ({ name: `Category ${i}`, value })) });
describe("chart rendering model", () => {
  it("adapts legacy bars and pie reports", () => {
    expect(chartModel(insight([10, 20]))?.type).toBe("horizontal_bar");
    expect(chartModel(insight([10, 20], "pie"))?.type).toBe("donut");
  });
  it("suppresses a lone nonzero bar and invalid donut values", () => {
    expect(chartModel(insight([10, 0]))).toBeNull();
    expect(chartModel(insight([10, -2], "donut"))).toBeNull();
    expect(chartModel(insight([10, NaN]))).toBeNull();
  });
  it("sorts dates and preserves gaps between series", () => {
    const data = [{ name: "2026-10-02", value: 10, series: "__proto__" }, { name: "2026-10-01", value: 20, series: "Other" }];
    const model = chartModel({ ...insight([]), chart_type: "forecast_line", chart_data: data });
    expect(model?.data[0].name).toBe("2026-10-01");
    const pivot = pivotSeries(data);
    expect(pivot.rows[0]).toEqual({ name: "2026-10-02", s0: 10 });
    expect(pivot.rows[0].s1).toBeUndefined();
  });
});
