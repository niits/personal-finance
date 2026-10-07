"use client";

import { Component, type ReactNode, useId } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartDatum, Insight } from "@/lib/statistics-report";
import { chartDatumLabel, chartTextSummary, formatChartValue } from "./presentation";
import { chartModel, pivotSeries, shortChartValue } from "./model";

// Local composition follows shadcn Charts, using the product's existing tokens.
const colors = ["var(--primary)", "var(--ink-muted-48)", "var(--hairline)", "var(--ink-muted-80)", "var(--divider-soft)"];
const axis = { tickLine: false, axisLine: false, tick: { fill: "var(--ink-muted-48)", fontSize: 12 } };
const tooltipStyle = { background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 8, color: "var(--ink)", fontSize: 13, maxWidth: 260, whiteSpace: "normal" as const };
const labels = { analysis: "Điểm đáng chú ý", recommendation: "Gợi ý hành động", alert: "Cần chú ý" };

class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="status" className="font-body text-[13px] text-ink-muted-80">Không thể hiển thị biểu đồ. Vui lòng xem bảng dữ liệu bên dưới.</p> : this.props.children;
  }
}

function Charts({ insight }: { insight: Insight }) {
  const model = chartModel(insight);
  if (!model) return null;
  const { type, data } = model;
  const format = (value: number) => formatChartValue(value, insight.value_unit);
  const tooltip = <Tooltip contentStyle={tooltipStyle} formatter={value => format(Number(value))} isAnimationActive={false} />;
  const hasHighlight = data.some(d => d.highlight);
  const focalColor = (d: ChartDatum, index: number) => hasHighlight ? d.highlight ? colors[0] : colors[1] : colors[index % colors.length];

  if (type === "horizontal_bar") {
    const domain: [number, number] = [Math.min(0, ...data.map(d => d.value)), Math.max(0, ...data.map(d => d.value))];
    return <div className="space-y-4">{[...data].sort((a, b) => b.value - a.value).map((d, index) => (
      <div key={d.id ?? `${d.name}-${index}`}>
        <div className="mb-1 flex flex-wrap justify-between gap-x-3 gap-y-1 font-body text-[13px] leading-[18px]">
          <span className="min-w-0 break-words text-ink-muted-80">{d.name}</span>
          <span className="shrink-0 font-semibold tabular-nums text-ink">{format(d.value)}{d.highlight ? " · Điểm nhấn" : ""}</span>
        </div>
        <div className="h-6 w-full"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart accessibilityLayer layout="vertical" data={[d]} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
            <XAxis type="number" domain={domain} hide /><YAxis type="category" dataKey="name" hide />
            {tooltip}<Bar dataKey="value" name={d.name} fill={hasHighlight && !d.highlight ? colors[1] : colors[0]} radius={4} barSize={12} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer></div>
      </div>
    ))}</div>;
  }
  if (type === "donut") return <div>
    <div className="h-[200px] w-full"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <PieChart accessibilityLayer><Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={3} stroke="var(--canvas)" isAnimationActive={false}>
        {data.map((d, i) => <Cell key={d.id ?? d.name} fill={focalColor(d, i)} />)}
      </Pie>{tooltip}</PieChart>
    </ResponsiveContainer></div>
    <ul className="m-0 list-none space-y-2 p-0">{data.map((d, i) => <li key={d.id ?? d.name} className="flex items-start justify-between gap-3 font-body text-[13px] leading-[18px]">
      <span className="flex min-w-0 items-start gap-2"><span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: focalColor(d, i) }} /><span className="break-words">{d.name}{d.highlight ? " · Điểm nhấn" : ""}</span></span><span className="shrink-0 tabular-nums">{format(d.value)}</span>
    </li>)}</ul>
  </div>;

  const { series, rows } = pivotSeries(data);
  const legend = <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-body text-[13px] text-ink-muted-80">{series.map((s, i) => <span key={s} className="inline-flex items-center gap-2"><span aria-hidden="true" style={{ borderColor: colors[i % colors.length], borderTopStyle: i ? "dashed" : "solid" }} className="w-4 border-t-2" />{s}</span>)}</div>;
  if (type === "line") return <>
    <div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart accessibilityLayer data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
        <XAxis {...axis} dataKey="name" minTickGap={24} tickFormatter={value => String(value).slice(5).split("-").reverse().join("/")} />
        <YAxis {...axis} width={64} tickFormatter={value => insight.value_unit === "currency" || !insight.value_unit ? shortChartValue(Number(value)) : format(Number(value))} />
        {tooltip}{series.map((s, i) => <Line key={s} dataKey={`s${i}`} name={s} type="linear" stroke={colors[i % colors.length]} strokeDasharray={i ? `${4 + i * 2} 4` : undefined} strokeWidth={2} dot={props => {
          const highlighted = data.some(d => d.name === props.payload.name && (d.series ?? "Chi tiêu") === s && d.highlight);
          return <circle key={`${s}-${props.payload.name}`} cx={props.cx} cy={props.cy} r={highlighted ? 4 : 0} fill={colors[i % colors.length]} />;
        }} connectNulls={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer></div>{series.length > 1 ? legend : null}
  </>;
  const maximum = Math.max(...rows.map(row => type === "stacked_bar" ? series.reduce((sum, _, i) => sum + Number(row[`s${i}`] ?? 0), 0) : Math.max(...series.map((_, i) => Number(row[`s${i}`] ?? 0)))));
  const minimum = Math.min(0, ...data.map(d => d.value));
  return <><div className="space-y-4">{rows.map(row => <div key={row.name}>
    <p className="mb-1 break-words font-body text-[13px] text-ink-muted-80">{row.name}</p>
    <div style={{ height: type === "stacked_bar" ? 32 : series.length * 24 }}><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart accessibilityLayer layout="vertical" data={[row]} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <XAxis type="number" hide domain={[minimum, maximum]} /><YAxis type="category" dataKey="name" hide />{tooltip}
        {series.map((s, i) => <Bar key={s} dataKey={`s${i}`} name={s} stackId={type === "stacked_bar" ? "parts" : undefined} fill={colors[i % colors.length]} barSize={12} radius={type === "stacked_bar" ? 0 : 4} isAnimationActive={false}>
          <Cell stroke={data.some(d => d.name === row.name && d.series === s && d.highlight) ? "var(--ink)" : "none"} strokeWidth={2} />
        </Bar>)}
      </BarChart>
    </ResponsiveContainer></div>
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-body text-[13px] tabular-nums text-ink">{series.map((s, i) => <span key={s}>{s}: {format(Number(row[`s${i}`] ?? 0))}{data.some(d => d.name === row.name && d.series === s && d.highlight) ? " · Điểm nhấn" : ""}</span>)}</div>
  </div>)}</div>{legend}</>;
}

export type InsightChartProps = { insight: Insight; featured?: boolean };
export function InsightChart({ insight, featured = false }: InsightChartProps) {
  const id = useId();
  const model = chartModel(insight);
  const summary = chartTextSummary(insight);
  return <article className="analysis-reveal border-b border-divider-soft py-6 first:pt-0 last:border-b-0">
    {insight.type ? <p className="mb-2 font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted-48">{labels[insight.type]}</p> : null}
    {featured ? <h1 className="m-0 font-display text-[21px] leading-[26px] font-semibold text-ink">{insight.title}</h1> : <h2 className="m-0 font-display text-[21px] leading-[26px] font-semibold text-ink">{insight.title}</h2>}
    <p className="mt-2 mb-0 font-body text-[15px] leading-[21px] text-ink-muted-80">{insight.summary}</p>
    {model ? <figure data-statistics-chart aria-describedby={id} className="m-0 mt-5 min-w-0 font-body">
      <ChartBoundary key={JSON.stringify(insight)}><Charts insight={insight} /></ChartBoundary>
      <figcaption id={id} className="sr-only">{summary}</figcaption>
    </figure> : null}
    {insight.chart_data?.length ? <details className="mt-2 font-body text-[13px] leading-[18px] text-ink-muted-80">
      <summary className="min-h-11 cursor-pointer py-3 text-primary">Xem dữ liệu biểu đồ</summary>
      <table className="w-full table-fixed border-collapse text-left"><caption className="sr-only">{summary ?? insight.title}</caption><thead><tr className="border-b border-hairline"><th className="py-2 pr-3 font-semibold">Mục</th><th className="w-[42%] py-2 text-right font-semibold">Giá trị</th></tr></thead><tbody>
        {insight.chart_data.map((d, i) => <tr key={d.id ?? i} className="border-b border-divider-soft last:border-b-0 hover:bg-canvas-parchment"><td className="break-words py-2 pr-3">{chartDatumLabel(d)}</td><td className="break-words py-2 text-right tabular-nums text-ink">{formatChartValue(d.value, insight.value_unit)}</td></tr>)}
      </tbody></table>
    </details> : null}
  </article>;
}
