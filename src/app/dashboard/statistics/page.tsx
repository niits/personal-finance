"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { expressionInterpreter } from "vega-interpreter";
import type { TopLevelSpec } from "vega-lite";
import type { Insight, AgentEvent, ChartDatum } from "@/lib/statistics";

type AgentStep = AgentEvent & { id: number };

// DESIGN.md: brand is #0066cc. Single-series charts use only the primary;
// multi-category charts pull from a desaturated iOS palette that harmonises
// with the Apple aesthetic without competing for accent status.
const PRIMARY = "#0066cc";
const CHART_PALETTE = [PRIMARY, "#30d158", "#ff9f0a", "#bf5af2", "#32ade6", "#ff453a", "#ac8e68", "#5856d6"];
const INK = "#1d1d1f";
const INK_MUTED = "#7a7a7a";
const HAIRLINE = "#e0e0e0";
const FONT_BODY = "SF Pro Text, system-ui, -apple-system, sans-serif";

// vi-VN number formatting: thousand="." decimal=","
const VEGA_FORMAT_LOCALE = {
  decimal: ",",
  thousands: ".",
  grouping: [3],
  currency: ["", " ₫"],
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
    data: { values: data as ChartDatum[] },
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
    // DESIGN.md forbids decorative gradients — use a solid 12% fill below the
    // stroke instead. The fill anchors the curve to the axis without competing
    // with the line itself.
    return {
      ...base,
      height: 220,
      layer: [
        {
          mark: { type: "area", color: PRIMARY, opacity: 0.12, line: false, interpolate: "monotone" },
          encoding: {
            x: isDate
              ? { field: "name", type: "temporal", title: null, axis: { format: "%d/%m", labelAngle: 0, tickCount: 6 } }
              : { field: "name", type: "ordinal", title: null, axis: { labelAngle: 0 } },
            y: { field: "value", type: "quantitative", title: null, axis: { format, labelExpr: valueLabelExpr } },
          },
        },
        {
          mark: { type: "line", color: PRIMARY, strokeWidth: 2, interpolate: "monotone" },
          encoding: {
            x: isDate
              ? { field: "name", type: "temporal" }
              : { field: "name", type: "ordinal" },
            y: { field: "value", type: "quantitative" },
            tooltip: [
              isDate
                ? { field: "name", type: "temporal", title: "Ngày", format: "%d/%m/%Y" }
                : { field: "name", type: "ordinal", title: "Mục" },
              { field: "value", type: "quantitative", title: valueTitle, format },
            ],
          },
        },
        {
          mark: { type: "point", color: PRIMARY, filled: true, size: 36 },
          encoding: {
            x: isDate
              ? { field: "name", type: "temporal" }
              : { field: "name", type: "ordinal" },
            y: { field: "value", type: "quantitative" },
            opacity: { value: 0 },
            tooltip: [
              isDate
                ? { field: "name", type: "temporal", title: "Ngày", format: "%d/%m/%Y" }
                : { field: "name", type: "ordinal", title: "Mục" },
              { field: "value", type: "quantitative", title: valueTitle, format },
            ],
          },
        },
      ],
    } as TopLevelSpec;
  }

  // bar / bar_grouped
  const hasSeries = data.some((d) => d.series);
  const grouped = insight.chart_type === "bar_grouped" || hasSeries;
  const distinctNames = new Set(data.map((d) => d.name)).size;
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

type Report = {
  found: true;
  period_key: string;
  insights: Insight[];
  is_dirty: boolean;
  is_current_period: boolean;
  generated_at: number;
};

type ApiError = {
  status: number;
  error: string;
  code?: string;
  details?: { name?: string; message?: string; stack?: string; value?: string; cause?: unknown };
};

type PageStatus = "loading" | "generating" | "ready" | "error";

async function readError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Omit<ApiError, "status">;
    return { status: res.status, ...body };
  } catch {
    return { status: res.status, error: `HTTP ${res.status} ${res.statusText || "(no body)"}` };
  }
}

function toMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `Tháng ${parseInt(mo)}/${y}`;
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

function currentMonth() {
  return new Date().toISOString().substring(0, 7);
}

function todayUtc() {
  return new Date().toISOString().substring(0, 10);
}

function dayOf(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().substring(0, 10);
}

export default function StatisticsPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [upperBound] = useState(currentMonth);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [regenError, setRegenError] = useState<ApiError | null>(null);
  const stepCounter = useRef(0);
  // Latch month requests so a slow background refresh on month A doesn't overwrite month B.
  const activeMonth = useRef(selectedMonth);

  const generate = useCallback(async (
    month: string,
    onStep?: (step: AgentStep) => void,
  ): Promise<{ report: Report } | { error: ApiError }> => {
    const res = await fetch(`/api/statistics?period_key=${month}`, { method: "POST" });
    if (!res.ok) return { error: await readError(res) };

    // Read SSE stream
    const reader = res.body?.getReader();
    if (!reader) return { error: { status: 500, error: "No response body" } };

    const decoder = new TextDecoder();
    let buffer = "";
    let finalReport: Report | null = null;
    let streamError: ApiError | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(part.slice(6)) as AgentEvent | { type: "report"; report: Report };
          if (event.type === "report") {
            finalReport = event.report;
          } else if (event.type === "error") {
            streamError = { status: 500, error: event.message };
          } else {
            const step: AgentStep = { ...event, id: ++stepCounter.current };
            onStep?.(step);
          }
        } catch { /* malformed event, skip */ }
      }
    }

    if (streamError) return { error: streamError };
    if (!finalReport) return { error: { status: 500, error: "Stream ended without report" } };
    return { report: finalReport };
  }, []);

  const load = useCallback(async (month: string) => {
    activeMonth.current = month;
    setStatus("loading");
    setReport(null);
    setError(null);
    setRegenError(null);
    setRefreshing(false);

    const res = await fetch(`/api/statistics?period_key=${month}`);

    if (res.status === 404) {
      if (activeMonth.current !== month) return;
      setStatus("generating");
      setAgentSteps([]);
      const result = await generate(month, (step) => {
        if (activeMonth.current === month) setAgentSteps((prev) => [...prev, step]);
      });
      if (activeMonth.current !== month) return;
      if ("error" in result) { setError(result.error); setStatus("error"); return; }
      setReport(result.report);
      setStatus("ready");
      return;
    }

    if (!res.ok) {
      const apiError = await readError(res);
      if (activeMonth.current !== month) return;
      setError(apiError);
      setStatus("error");
      return;
    }

    const data = (await res.json()) as Report;
    if (activeMonth.current !== month) return;

    setReport(data);
    setStatus("ready");

    // Daily refresh for the current period; also catch dirty reports from past-month mutations.
    const stale = data.is_dirty || (data.is_current_period && dayOf(data.generated_at) < todayUtc());
    if (!stale) return;

    setRefreshing(true);
    const result = await generate(month);
    if (activeMonth.current !== month) return;
    setRefreshing(false);
    if ("report" in result) setReport(result.report);
    else setRegenError(result.error);
  }, [generate]);

  const regenerate = useCallback(async (month: string) => {
    activeMonth.current = month;
    setStatus("generating");
    setAgentSteps([]);
    setError(null);
    setRegenError(null);
    const result = await generate(month, (step) => {
      if (activeMonth.current === month) setAgentSteps((prev) => [...prev, step]);
    });
    if (activeMonth.current !== month) return;
    if ("error" in result) {
      if (!report) { setError(result.error); setStatus("error"); }
      else { setRegenError(result.error); setStatus("ready"); }
      return;
    }
    setReport(result.report);
    setStatus("ready");
  }, [generate, report]);

  useEffect(() => { load(selectedMonth); }, [load, selectedMonth]);

  const isAtUpperBound = selectedMonth === upperBound;

  const chevron = (disabled?: boolean): React.CSSProperties => ({
    background: "none", border: "none", cursor: disabled ? "default" : "pointer",
    color: disabled ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
    fontSize: 20, padding: "0 6px", lineHeight: 1, flexShrink: 0,
  });

  return (
    <div style={{ minHeight: "calc(100svh - 44px - 72px)", background: "var(--canvas-parchment)" }}>
      <style>{`.vega-embed { display: block !important; width: 100% !important; }`}</style>

      {/* ── Header ── */}
      <div style={{ background: "var(--surface-black)", color: "var(--on-dark)", padding: "28px 20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 4 }}>
          <button style={chevron()} onClick={() => setSelectedMonth(prevMonth(selectedMonth))}>‹</button>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, letterSpacing: -0.374, flex: 1, textAlign: "center" }}>
            {toMonthLabel(selectedMonth)}
          </span>
          <button style={chevron(isAtUpperBound)} onClick={() => !isAtUpperBound && setSelectedMonth(nextMonth(selectedMonth))}>›</button>
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center", letterSpacing: -0.1 }}>
          Phân tích chi tiêu
        </p>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: "16px" }}>

        {status === "loading" && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14 }}>
            Đang tải…
          </div>
        )}

        {status === "generating" && (
          <div style={{ padding: "40px 0 32px" }}>
            <GeneratingSpinner />
            <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", textAlign: "center", marginBottom: agentSteps.length > 0 ? 20 : 0 }}>
              Đang phân tích…
            </p>
            {agentSteps.length > 0 && (
              <div style={{ background: "var(--canvas)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", fontFamily: "var(--font-body)", fontSize: 14 }}>
                {agentSteps.map((step) => (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", color: step.type === "tool_result" ? "var(--ink-muted-48)" : "var(--ink)" }}>
                    <span style={{ flexShrink: 0, width: 16, textAlign: "center", fontSize: 12, color: step.type === "tool_result" ? "var(--primary)" : "var(--ink-muted-48)" }}>
                      {step.type === "tool_call" ? "○" : "●"}
                    </span>
                    <span style={{ flex: 1 }}>
                      {step.type === "tool_call" ? step.label : step.type === "tool_result" ? `↳ ${step.rows} mục` : null}
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--hairline)", alignItems: "center", color: "var(--ink-muted-48)", fontSize: 13 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", animation: "stats-pulse 0.9s ease-in-out infinite" }} />
                  <span>AI đang xử lý…</span>
                  <style>{`@keyframes stats-pulse { 0%,100%{opacity:.25} 50%{opacity:1} }`}</style>
                </div>
              </div>
            )}
          </div>
        )}

        {status === "error" && (
          <ErrorState error={error} onRetry={() => load(selectedMonth)} />
        )}

        {status === "ready" && report && report.insights.length === 0 && (
          <EmptyState
            monthLabel={toMonthLabel(selectedMonth)}
            showJumpToCurrent={selectedMonth !== upperBound}
            onJumpToCurrent={() => setSelectedMonth(upperBound)}
          />
        )}

        {status === "ready" && regenError && (
          <div style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ color: "#ff453a", flexShrink: 0, fontSize: 16, lineHeight: 1.4 }}>!</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "#b94a05", margin: "0 0 4px" }}>
                Tạo lại thất bại
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
                {regenError.details?.message ?? regenError.error}
              </p>
            </div>
            <button
              onClick={() => setRegenError(null)}
              style={{ background: "none", border: "none", color: "var(--ink-muted-48)", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0, padding: 0 }}
              aria-label="Đóng"
            >×</button>
          </div>
        )}

        {status === "ready" && report && report.insights.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s" }}>
            {report.insights.map((insight) => (
              <InsightCard key={insight.title} insight={insight} />
            ))}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 }}>
              <p suppressHydrationWarning style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                {refreshing ? "Đang cập nhật…" : `Phân tích lúc ${new Date(report.generated_at * 1000).toLocaleString("vi-VN", {
                  day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
                })}`}
              </p>
              <button
                onClick={() => regenerate(selectedMonth)}
                disabled={refreshing}
                style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 12, color: "var(--primary)", cursor: refreshing ? "default" : "pointer", padding: "4px 0", opacity: refreshing ? 0.4 : 1 }}
              >
                Tạo lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: ApiError | null; onRetry: () => void }) {
  const headline = error
    ? `Lỗi ${error.status}${error.code ? ` · ${error.code}` : ""}`
    : "Không thể tạo thống kê";
  const message = error?.details?.message ?? error?.error ?? "Đã có lỗi xảy ra.";
  const stack = error?.details?.stack;
  const causeText = error?.details?.cause ? JSON.stringify(error.details.cause, null, 2) : null;

  return (
    <div style={{ padding: "24px 20px" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
        {headline}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink)", marginBottom: 16, lineHeight: 1.5, wordBreak: "break-word" }}>
        {message}
      </p>
      {(stack || causeText) && (
        <details style={{ marginBottom: 20 }}>
          <summary style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", cursor: "pointer", marginBottom: 8 }}>
            Chi tiết
          </summary>
          <pre style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12, lineHeight: 1.45, color: "var(--ink-muted-48)",
            background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 8,
            padding: 12, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
            maxHeight: 320, overflow: "auto",
          }}>
            {stack ?? ""}
            {causeText ? `\n\nCause:\n${causeText}` : ""}
          </pre>
        </details>
      )}
      <button
        onClick={onRetry}
        style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
      >
        Thử lại
      </button>
    </div>
  );
}

function EmptyState({ monthLabel, showJumpToCurrent, onJumpToCurrent }: {
  monthLabel: string;
  showJumpToCurrent: boolean;
  onJumpToCurrent: () => void;
}) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 8, letterSpacing: -0.374 }}>
        Chưa có dữ liệu
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", lineHeight: 1.5, marginBottom: 20 }}>
        Không có giao dịch nào trong {monthLabel} để phân tích.
      </p>
      {showJumpToCurrent && (
        <button
          onClick={onJumpToCurrent}
          style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          Xem tháng hiện tại
        </button>
      )}
    </div>
  );
}

const INSIGHT_TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  analysis:       { label: "Phân tích",     color: "#0066cc", bg: "rgba(0,102,204,0.08)" },
  recommendation: { label: "Gợi ý",         color: "#1c7c34", bg: "rgba(48,209,88,0.1)"  },
  alert:          { label: "Cảnh báo",      color: "#b94a05", bg: "rgba(255,69,58,0.08)" },
};

function InsightCard({ insight }: { insight: Insight }) {
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

function GeneratingSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "2.5px solid var(--hairline)",
        borderTopColor: "var(--primary)",
        animation: "stats-spin 0.75s linear infinite",
      }} />
      <style>{`@keyframes stats-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
