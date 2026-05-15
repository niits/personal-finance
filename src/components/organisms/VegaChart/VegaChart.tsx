"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { expressionInterpreter } from "vega-interpreter";
import type { TopLevelSpec } from "vega-lite";
import type { Insight } from "@/lib/statistics";

// ─── Design tokens (must stay in sync with DESIGN.md) ────────────────────────

const PRIMARY = "#0066cc";
const CHART_PALETTE = [PRIMARY, "#30d158", "#ff9f0a", "#bf5af2", "#32ade6", "#ff453a", "#ac8e68", "#5856d6"];
const INK = "#1d1d1f";
const INK_MUTED = "#7a7a7a";
const HAIRLINE = "#e0e0e0";
const FONT_BODY = "SF Pro Text, system-ui, -apple-system, sans-serif";

// ─── vi-VN locale for Vega ────────────────────────────────────────────────────

const VEGA_FORMAT_LOCALE = {
  decimal: ",",
  thousands: ".",
  grouping: [3],
  currency: ["", " ₫"],
};

const VEGA_TIME_FORMAT_LOCALE = {
  dateTime: "%A, %e %B %Y, %X",
  date: "%d/%m/%Y",
  time: "%H:%M:%S",
  periods: ["SA", "CH"],
  days: ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"],
  shortDays: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
  months: ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"],
  shortMonths: ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"],
};

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

function buildVegaLiteSpec(insight: Insight): TopLevelSpec | null {
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
    labelFontSize: 11,
    titleFontSize: 11,
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
      ? `datum.value >= 1000000 ? format(datum.value / 1000000, '.1~f') + 'tr' : datum.value >= 1000 ? format(datum.value / 1000, '.0f') + 'k' : format(datum.value, '.0f') + ' ₫'`
      : `datum.label + '${suffix}'`;

  const base = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: "container" as const,
    autosize: { type: "fit" as const, contains: "padding" as const, resize: true },
    background: "transparent",
    config,
    data: { values: data },
  };

  if (insight.chart_type === "pie") {
    return {
      ...base,
      height: 260,
      // DESIGN.md: 18px radius on cards. Donut hole + 2px white stroke gives the
      // "tile within tile" feel without a hard border.
      mark: { type: "arc", innerRadius: 64, outerRadius: 108, stroke: "#ffffff", strokeWidth: 2, cornerRadius: 2 },
      encoding: {
        theta: { field: "value", type: "quantitative", stack: true },
        color: { field: "name", type: "nominal", legend: { title: null } },
        tooltip: [
          { field: "name", type: "nominal", title: "Danh mục" },
          { field: "value", type: "quantitative", title: valueTitle, format },
        ],
      },
    } as TopLevelSpec;
  }

  if (insight.chart_type === "line") {
    const isDate = data.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.name));
    const xEnc = isDate
      ? { field: "name", type: "temporal" as const, title: null, axis: { format: "%d/%m", labelAngle: 0, tickCount: 5 } }
      : { field: "name", type: "ordinal" as const, title: null, axis: { labelAngle: 0 } };
    const yEnc = { field: "value", type: "quantitative" as const, title: null, axis: { format, labelExpr: valueLabelExpr } };
    const lineTooltip = [
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
          mark: { type: "line", color: PRIMARY, strokeWidth: 2, interpolate: "monotone" },
          encoding: { x: xEnc, y: yEnc, tooltip: lineTooltip },
        },
        // Invisible points to widen the tooltip hit area on mobile
        {
          mark: { type: "point", color: PRIMARY, filled: true, size: 48, opacity: 0 },
          encoding: { x: { ...xEnc, axis: null }, y: { field: "value", type: "quantitative" as const }, tooltip: lineTooltip },
        },
      ],
    } as TopLevelSpec;
  }

  // bar / bar_grouped
  const hasSeries = data.some((d) => d.series);
  const grouped = insight.chart_type === "bar_grouped" || hasSeries;
  const distinctNames = new Set(data.map((d) => d.name)).size;

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

  return {
    ...base,
    height: Math.max(180, Math.min(360, distinctNames * (grouped ? 32 : 28) + 40)),
    mark: { type: "bar", cornerRadiusEnd: 4 },
    encoding: {
      y: { field: "name", type: "nominal", sort: "-x", title: null, axis: { ...baseAxis, labelLimit: 140, labelColor: INK, labelFontWeight: 400 } },
      x: { field: "value", type: "quantitative", title: null, axis: { format, labelExpr: valueLabelExpr, tickCount: 3, grid: true, gridColor: HAIRLINE, gridOpacity: 0.6, gridDash: [2, 4] } },
      ...(grouped
        ? {
            color: { field: "series", type: "nominal", legend: { title: null } },
            yOffset: { field: "series", type: "nominal" },
          }
        : { color: { value: PRIMARY } }),
      tooltip: [
        { field: "name", type: "nominal", title: "Mục" },
        ...(grouped ? [{ field: "series", type: "nominal" as const, title: "Nhóm" }] : []),
        { field: "value", type: "quantitative", title: valueTitle, format },
      ],
    },
  } as TopLevelSpec;
}

// ─── VegaEmbed dynamic import (no SSR — Workers runtime has no DOM) ──────────

type VegaEmbedProps = {
  spec: TopLevelSpec;
  options?: Record<string, unknown>;
  onError?: (error: unknown) => void;
  className?: string;
};

const VegaEmbed = dynamic<VegaEmbedProps>(
  () => import("react-vega").then((m) => m.VegaEmbed as React.ComponentType<VegaEmbedProps>),
  { ssr: false, loading: () => <div style={{ height: 220, background: "var(--canvas)" }} /> },
);

// ─── Insight type badge styles ────────────────────────────────────────────────

const INSIGHT_TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  analysis:       { label: "Phân tích",  color: "#0066cc", bg: "rgba(0,102,204,0.08)" },
  recommendation: { label: "Gợi ý",      color: "#1c7c34", bg: "rgba(48,209,88,0.1)"  },
  alert:          { label: "Cảnh báo",   color: "#b94a05", bg: "rgba(255,69,58,0.08)" },
};

// ─── Public component ─────────────────────────────────────────────────────────

export type VegaChartProps = {
  insight: Insight;
};

export function VegaChart({ insight }: VegaChartProps) {
  const spec = buildVegaLiteSpec(insight);
  const badge = insight.type ? INSIGHT_TYPE_STYLE[insight.type] ?? null : null;
  const [vegaError, setVegaError] = useState<string | null>(null);

  return (
    <div style={{ background: "var(--canvas)", borderRadius: 18, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.374, margin: 0, flex: 1 }}>
          {insight.title}
        </p>
        {badge && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: badge.color, background: badge.bg, borderRadius: 8, padding: "3px 8px", flexShrink: 0, marginTop: 1 }}>
            {badge.label}
          </span>
        )}
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", lineHeight: 1.5, marginBottom: spec ? 16 : 0 }}>
        {insight.summary}
      </p>
      {spec && (
        <div style={{ width: "100%" }}>
          <VegaEmbed
            spec={spec}
            onError={(e) => setVegaError(String(e))}
            options={{
              actions: false,
              renderer: "canvas",
              ast: true,
              expr: expressionInterpreter,
              formatLocale: VEGA_FORMAT_LOCALE,
              timeFormatLocale: VEGA_TIME_FORMAT_LOCALE,
            }}
          />
          {vegaError && (
            <pre style={{ fontSize: 12, color: "red", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8 }}>{vegaError}</pre>
          )}
        </div>
      )}
    </div>
  );
}
