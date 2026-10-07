import type { ChartDatum, ChartTemplate, Insight } from "@/lib/statistics-report";

/** Stored version 2 reports remain readable without a database rewrite. */
export function chartModel(insight: Insight): { type: ChartTemplate; data: ChartDatum[] } | null {
  const aliases = { bar: "horizontal_bar", pie: "donut", bar_grouped: "grouped_bar", forecast_line: "line" } as const;
  const source = insight.chart_type;
  if (!source || !insight.chart_data?.length) return null;
  const type = source in aliases ? aliases[source as keyof typeof aliases] : source as ChartTemplate;
  const data = insight.chart_data;
  if (data.some(d => !Number.isFinite(d.value))) return null;
  if (type === "line") {
    if (new Set(data.map(d => d.name)).size < 2 || data.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d.name) || !Number.isFinite(Date.parse(d.name)))) return null;
    return { type, data: [...data].sort((a, b) => a.name.localeCompare(b.name)) };
  }
  if (!["horizontal_bar", "donut", "grouped_bar", "stacked_bar"].includes(type)) return null;
  if (data.filter(d => d.value !== 0).length < 2) return null;
  if (type === "donut" && (data.some(d => d.value <= 0 || d.series) || data.length > 5)) return null;
  if (type === "stacked_bar" && data.some(d => d.value < 0)) return null;
  return { type, data };
}

export function pivotSeries(data: ChartDatum[]) {
  const series = [...new Set(data.map(d => d.series ?? "Chi tiêu"))];
  const rows = new Map<string, Record<string, string | number>>();
  for (const datum of data) {
    const row = rows.get(datum.name) ?? { name: datum.name };
    row[`s${series.indexOf(datum.series ?? "Chi tiêu")}`] = datum.value;
    rows.set(datum.name, row);
  }
  return { series, rows: [...rows.values()] };
}

export function shortChartValue(value: number): string {
  const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
  if (Math.abs(value) >= 1_000_000) return `${number.format(value / 1_000_000)} tr`;
  if (Math.abs(value) >= 1_000) return `${number.format(value / 1_000)} nghìn`;
  return number.format(value);
}
