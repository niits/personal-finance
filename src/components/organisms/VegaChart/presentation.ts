import type { ChartDatum, Insight } from "@/lib/statistics";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function formatChartValue(value: number, unit?: Insight["value_unit"]): string {
  const formatted = numberFormat.format(value);
  if (unit === "percent") return `${formatted}%`;
  if (unit === "count") return formatted;
  return `${formatted} ₫`;
}

export function chartTextSummary(insight: Insight): string | null {
  const data = insight.chart_data;
  if (!data?.length || !insight.chart_type) return null;

  const series = [...new Set(data.flatMap((datum) => datum.series ? [datum.series] : []))];
  if (insight.chart_type === "line" || insight.chart_type === "forecast_line") {
    const comparison = series.length > 1 ? ` giữa ${series.join(" và ")}` : " theo thời gian";
    return `Biểu đồ đường thể hiện thay đổi${comparison}.`;
  }

  const names = [...new Set(data.map((datum) => datum.name))];
  return `Biểu đồ so sánh ${names.join(", ")}.`;
}

export function chartDatumLabel(datum: ChartDatum): string {
  return datum.series ? `${datum.name}, ${datum.series}` : datum.name;
}
