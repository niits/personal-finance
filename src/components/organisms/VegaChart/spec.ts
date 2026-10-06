import type { TopLevelSpec } from "vega-lite";
import type { Insight } from "@/lib/statistics-report";
import { formatChartValue } from "./presentation";

// ─── Spec builder ─────────────────────────────────────────────────────────────

function vegaFormat(unit?: Insight["value_unit"]): string {
  if (unit === "percent") return ",.2~f";
  return ",.0f";
}

function vegaUnitSuffix(unit?: Insight["value_unit"]): string {
  if (unit === "percent") return "%";
  if (unit === "count") return "";
  return " ₫";
}

export type ChartTheme = { primary: string; muted: string; ink: string; inkMuted: string; hairline: string; font: string };

export function buildVegaLiteSpec(insight: Insight, theme: ChartTheme): TopLevelSpec | null {
  const { primary: PRIMARY, muted: MUTED, ink: INK, inkMuted: INK_MUTED, hairline: HAIRLINE, font: FONT_BODY } = theme;
  const CHART_PALETTE = [PRIMARY, MUTED, INK_MUTED];
  const data = insight.chart_data;
  if (!data || data.length === 0 || !insight.chart_type) return null;
  const unit = insight.value_unit;
  const format = vegaFormat(unit);
  const suffix = vegaUnitSuffix(unit);
  const valueTitle = unit === "percent" ? "Tỷ lệ" : unit === "count" ? "Số lượng" : "Số tiền";

  const baseAxis = {
    labelFont: FONT_BODY,
    titleFont: FONT_BODY,
    labelColor: INK_MUTED,
    titleColor: INK_MUTED,
    labelFontSize: 12,
    titleFontSize: 12,
    labelFontWeight: 400 as const,
    grid: false,
    domain: false,
    ticks: false,
  };
  const config = {
    view: { stroke: null },
    axis: baseAxis,
    axisX: { ...baseAxis },
    axisY: { ...baseAxis, grid: true, gridColor: HAIRLINE, gridOpacity: 0.6, gridDash: [2, 4] },
    legend: {
      labelFont: FONT_BODY,
      titleFont: FONT_BODY,
      labelColor: INK,
      labelFontSize: 12,
      symbolSize: 72,
      symbolType: "circle" as const,
      orient: "bottom" as const,
      padding: 12,
      offset: 8,
    },
    range: { category: CHART_PALETTE },
    font: FONT_BODY,
  };
  // Compact axis labels for mobile: "15.000.000 đ" → "15tr", "500.000 đ" → "500k"
  const valueLabelExpr =
    unit === "currency"
      ? `abs(datum.value) >= 1000000 ? format(datum.value / 1000000, '.1~f') + ' triệu' : abs(datum.value) >= 1000 ? format(datum.value / 1000, '.0f') + ' nghìn' : format(datum.value, '.0f') + ' ₫'`
      : `datum.label + '${suffix}'`;

  const base = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: "container" as const,
    autosize: { type: "fit" as const, contains: "padding" as const, resize: true },
    background: "transparent",
    config,
    data: { values: data.map(d => ({ ...d, value_label: formatChartValue(d.value, unit) })) },
  };

  if (insight.chart_type === "forecast_line") {
    const meta = insight.forecast_meta;
    if (!meta) return null;
    return {
      ...base,
      height: 150,
      layer: [
        {
          mark: { type: "line", strokeWidth: 2, interpolate: "linear" },
          encoding: {
            x: {
              field: "name",
              type: "temporal" as const,
              title: null,
              axis: {
                values: [meta.period_start, meta.today, meta.next_period_start],
                format: "%d/%m",
                labelAngle: 0,
                labelFont: FONT_BODY,
                labelColor: INK_MUTED,
                labelFontSize: 12,
                grid: false,
                domain: false,
                ticks: false,
                title: null,
              },
            },
            y: {
              field: "value",
              type: "quantitative" as const,
              title: null,
              axis: null,
              scale: { zero: true },
            },
            color: {
              field: "series",
              type: "nominal" as const,
              scale: { domain: ["Thực tế", "Ngân sách"], range: [PRIMARY, MUTED] },
              legend: { title: null },
            },
          },
        },
      ],
    } as TopLevelSpec;
  }

  if (insight.chart_type === "line") {
    // A line through a single point is not a trend — show nothing.
    if (data.length < 2) return null;
    const isDate = data.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.name));
    const dates = [...new Set(data.map(d => d.name))].sort();
    const dateTicks = dates.filter((_, index) => index % Math.max(1, Math.ceil(dates.length / 5)) === 0);
    const xEnc = isDate
      ? { field: "name", type: "temporal" as const, title: null, axis: { format: "%d/%m", labelAngle: 0, values: dateTicks } }
      : { field: "name", type: "ordinal" as const, title: null, axis: { labelAngle: 0 } };
    const yEnc = { field: "value", type: "quantitative" as const, title: null, axis: { format, labelExpr: valueLabelExpr } };
    const seriesNames = [...new Set(data.flatMap(d => d.series ? [d.series] : []))];
    const seriesEncoding = seriesNames.length > 0 ? {
      color: { field: "series", type: "nominal" as const, scale: { domain: seriesNames, range: CHART_PALETTE }, legend: { title: null } },
      strokeDash: { field: "series", type: "nominal" as const, legend: { title: null } },
    } : {};
    const lineTooltip = [
      ...(seriesNames.length > 0 ? [{ field: "series", type: "nominal" as const, title: "Nhóm" }] : []),
      isDate
        ? { field: "name", type: "temporal" as const, title: "Ngày", format: "%d/%m/%Y" }
        : { field: "name", type: "ordinal" as const, title: "Mục" },
      { field: "value", type: "quantitative" as const, title: valueTitle, format },
    ];
    return {
      ...base,
      height: 200,
      layer: [
        {
          mark: { type: "line", color: PRIMARY, strokeWidth: 2, interpolate: "linear" },
          encoding: { x: xEnc, y: yEnc, ...seriesEncoding, tooltip: lineTooltip },
        },
        // Visible markers so each data point is locatable, not just the trend line.
        {
          mark: { type: "point", color: PRIMARY, filled: true, size: data.length > 20 ? 20 : 48 },
          encoding: { x: xEnc, y: { field: "value", type: "quantitative" as const }, ...seriesEncoding, tooltip: lineTooltip },
        },
      ],
    } as TopLevelSpec;
  }

  // bar / bar_grouped
  const hasSeries = data.some((d) => d.series);
  const grouped = insight.chart_type === "bar_grouped" || hasSeries;
  const distinctNames = new Set(data.map((d) => d.name)).size;
  const hasHighlight = data.some((d) => d.highlight === true);

  // Apple-style reference-rule: bar_grouped where exactly one series is a
  // budget/limit/average marker → draw actual data as bars, reference as a
  // vertical rule line (like Apple Health's threshold indicator).
  const REF_SERIES_RE = /^(Ngân sách|Giới hạn|Trung bình|Mục tiêu)$/;
  const allSeriesNames = [...new Set(data.filter((d) => d.series).map((d) => d.series!))];
  const refSeriesName = allSeriesNames.find((s) => REF_SERIES_RE.test(s));
  const refEntries = refSeriesName ? data.filter((d) => d.series === refSeriesName) : [];
  const uniqueRefValues = new Set(refEntries.map((d) => d.value));
  const isRefChart = grouped && !!refSeriesName && allSeriesNames.length === 2 && uniqueRefValues.size === 1;

  if (isRefChart) {
    const actualData = data.filter((d) => d.series !== refSeriesName);
    const refValue = [...uniqueRefValues][0];
    const actualRowCount = new Set(actualData.map((d) => d.name)).size;
    const xAxisSpec = {
      format, labelExpr: valueLabelExpr, tickCount: 3,
      grid: true, gridColor: HAIRLINE, gridOpacity: 0.6, gridDash: [2, 4] as number[],
    };
    return {
      ...base,
      height: Math.max(72, actualRowCount * 44 + 20),
      layer: [
        {
          mark: { type: "bar", cornerRadiusEnd: 4, height: 28 },
          data: { values: actualData },
          encoding: {
            y: { field: "name", type: "nominal", title: null, axis: { ...baseAxis, labelLimit: 140, labelColor: INK } },
            x: { field: "value", type: "quantitative", title: null, axis: xAxisSpec },
            color: { value: PRIMARY },
            tooltip: [
              { field: "name", type: "nominal", title: "Mục" },
              { field: "value", type: "quantitative", title: valueTitle, format },
            ],
          },
        },
        // Reference threshold rule
        {
          mark: { type: "rule", color: INK_MUTED, strokeDash: [4, 3], strokeWidth: 1.5 },
          encoding: { x: { datum: refValue, type: "quantitative" as const } },
        },
        // Reference label (top of rule line)
        {
          mark: { type: "text", align: "left", dx: 4, dy: 0, fontSize: 10, color: INK_MUTED, baseline: "top" as const },
          encoding: {
            x: { datum: refValue, type: "quantitative" as const },
            y: { value: 2 },
            text: { value: refSeriesName },
          },
        },
      ],
    } as TopLevelSpec;
  }

  // A bar chart with a single category compares nothing — its one number already
  // lives in the summary. Render no chart so a lone bar can never ship.
  if (distinctNames < 2 && !(grouped && allSeriesNames.length >= 2)) return null;

  const barSpec = {
    ...base,
    height: Math.max(100, Math.min(420, distinctNames * (grouped ? 60 : 40) + 36)),
    mark: { type: "bar", cornerRadiusEnd: 4 },
    encoding: {
      y: { field: "name", type: "nominal", sort: { field: "value", op: "max", order: "descending" }, title: null, axis: { ...baseAxis, labelLimit: 105, labelExpr: "split(datum.label, ' > ')[length(split(datum.label, ' > ')) - 1]", labelColor: INK, labelFontWeight: 400 } },
      x: { field: "value", type: "quantitative", title: null, axis: { format, labelExpr: valueLabelExpr, tickCount: 3, grid: true, gridColor: HAIRLINE, gridOpacity: 0.6, gridDash: [2, 4] } },
      ...(grouped
        ? {
            color: { field: "series", type: "nominal", scale: { domain: allSeriesNames, range: CHART_PALETTE }, legend: { title: null } },
            yOffset: { field: "series", type: "nominal" },
          }
        : {
            // Focus attention: highlighted row in the accent colour, rest grey.
            color: hasHighlight
              ? { condition: { test: "datum.highlight === true", value: PRIMARY }, value: MUTED }
              : { value: PRIMARY },
          }),
      tooltip: [
        { field: "name", type: "nominal", title: "Mục" },
        ...(grouped ? [{ field: "series", type: "nominal" as const, title: "Nhóm" }] : []),
        { field: "value", type: "quantitative", title: valueTitle, format },
      ],
    },
  } as Extract<TopLevelSpec, { mark: unknown }>;
  if (grouped) return barSpec;
  return {
    ...barSpec,
    mark: undefined,
    encoding: undefined,
    layer: [
      { mark: { type: "bar", cornerRadiusEnd: 4, height: 20 }, encoding: barSpec.encoding },
      { mark: { type: "text", align: "right", baseline: "middle", color: INK, font: FONT_BODY, fontSize: 12, dy: -17 }, encoding: {
        x: { value: "width" },
        y: { field: "name", type: "nominal", sort: { field: "value", op: "max", order: "descending" } },
        text: { field: "value_label" },
      } },
    ],
  } as TopLevelSpec;
}
