"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { expressionInterpreter } from "vega-interpreter";
import type { TopLevelSpec } from "vega-lite";
import type { Insight } from "@/lib/statistics-report";
import { chartDatumLabel, chartTextSummary, formatChartValue } from "./presentation";

import { buildVegaLiteSpec, type ChartTheme } from "./spec";


function readChartTheme(): string {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return JSON.stringify({ primary: token("--primary"), muted: token("--hairline"), ink: token("--ink"), inkMuted: token("--ink-muted-48"), hairline: token("--divider-soft"), font: token("--font-body") });
}
function subscribeChartTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}

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

const INSIGHT_TYPE_LABEL: Record<string, string> = {
  analysis: "Phân tích",
  recommendation: "Đề xuất",
  alert: "Cảnh báo",
};

// ─── Public component ─────────────────────────────────────────────────────────

export type VegaChartProps = {
  insight: Insight;
  featured?: boolean;
};

export function VegaChart({ insight, featured = false }: VegaChartProps) {
  const themeJson = useSyncExternalStore(subscribeChartTheme, readChartTheme, () => null);
  const spec = useMemo(() => themeJson ? buildVegaLiteSpec(insight, JSON.parse(themeJson) as ChartTheme) : null, [insight, themeJson]);
  const typeLabel = insight.type ? INSIGHT_TYPE_LABEL[insight.type] ?? null : null;
  const textSummary = chartTextSummary(insight);
  const [vegaError, setVegaError] = useState(false);

  return (
    <article className="analysis-reveal border-b border-divider-soft py-lg first:pt-0 last:border-b-0">
      {typeLabel ? (
        <p className="mb-2 font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted-48">
          {typeLabel}
        </p>
      ) : null}
      {featured ? (
        <h1 className="m-0 font-display text-[28px] leading-[33px] font-semibold tracking-[-0.02em] text-ink">
          {insight.title}
        </h1>
      ) : (
        <h2 className="m-0 font-display text-[21px] leading-[26px] font-semibold tracking-[-0.01em] text-ink">
          {insight.title}
        </h2>
      )}
      <p className="mt-2 mb-0 font-body text-[17px] leading-[25px] text-ink-muted-80">
        {insight.summary}
      </p>
      {spec && !vegaError ? (
        <figure className="m-0 mt-lg min-w-0" aria-label={textSummary ?? undefined}>
          <VegaEmbed
            className="block w-full min-w-0"
            spec={spec}
            onError={() => setVegaError(true)}
            options={{
              actions: false,
              renderer: "svg",
              ast: true,
              expr: expressionInterpreter,
              formatLocale: VEGA_FORMAT_LOCALE,
              timeFormatLocale: VEGA_TIME_FORMAT_LOCALE,
            }}
          />
          {textSummary ? (
            <figcaption className="mt-2 font-body text-[13px] leading-[18px] text-ink-muted-48">
              {textSummary}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      {vegaError ? (
        <p role="status" className="mt-4 mb-0 rounded-md bg-canvas-parchment px-4 py-3 font-body text-[15px] leading-[21px] text-ink-muted-80">
          Biểu đồ hiện chưa hiển thị được. Bạn vẫn có thể đọc nhận xét ở trên.
        </p>
      ) : null}
      {spec && insight.chart_data?.length ? (
        <details className="mt-3 font-body text-[13px] leading-[18px] text-ink-muted-48">
          <summary className="flex min-h-11 cursor-pointer items-center text-primary">Xem dữ liệu biểu đồ</summary>
          <div className="overflow-x-auto pb-1">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="py-2 pr-3 font-semibold text-ink">Mục</th>
                  <th className="py-2 text-right font-semibold text-ink">Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {insight.chart_data.map((datum) => (
                  <tr key={`${datum.name}-${datum.series ?? "value"}-${datum.value}`} className="border-b border-divider-soft last:border-b-0 hover:bg-canvas-parchment motion-safe:transition-colors">
                    <td className="py-2 pr-3 text-ink-muted-80">{chartDatumLabel(datum)}</td>
                    <td className="py-2 text-right tabular-nums text-ink">{formatChartValue(datum.value, insight.value_unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </article>
  );
}
