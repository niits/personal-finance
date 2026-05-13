"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Insight, AgentEvent } from "@/lib/statistics";

type AgentStep = AgentEvent & { id: number };

const CHART_COLORS = ["#0066cc", "#30d158", "#ff453a", "#ff9f0a", "#bf5af2", "#32ade6", "#ac8e68"];

// Handles both new format (chart_type + chart_data) and legacy DB format (option)
type AnyInsight = Insight | { title: string; summary: string; option: Record<string, unknown> };

function buildEChartsOption(insight: Insight) {
  const data = insight.chart_data;
  if (!data || !insight.chart_type) return null;
  if (insight.chart_type === "pie") {
    return {
      color: CHART_COLORS,
      tooltip: { trigger: "item", formatter: "{b}: {c} ₫ ({d}%)" },
      series: [{ type: "pie", radius: ["35%", "65%"], data }],
    };
  }
  if (insight.chart_type === "bar") {
    return {
      color: CHART_COLORS,
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: data.map((d) => d.name), axisLabel: { fontSize: 11 } },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: data.map((d) => d.value) }],
    };
  }
  return {
    color: CHART_COLORS,
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: data.map((d) => d.name) },
    yAxis: { type: "value" },
    series: [{ type: "line", smooth: true, data: data.map((d) => d.value), areaStyle: { opacity: 0.15 } }],
  };
}

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Report = {
  found: true;
  period_key: string;
  insights: AnyInsight[];
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
    // Background refresh failure: keep stale report visible, log to console for inspection.
    else console.error("[stats] background refresh failed", result.error);
  }, [generate]);

  const regenerate = useCallback(async (month: string) => {
    activeMonth.current = month;
    setStatus("generating");
    setAgentSteps([]);
    setError(null);
    const result = await generate(month, (step) => {
      if (activeMonth.current === month) setAgentSteps((prev) => [...prev, step]);
    });
    if (activeMonth.current !== month) return;
    if ("error" in result) {
      // No prior report → show full error. Prior report exists → keep it visible
      // but still log so the user can see the failure in console.
      if (!report) { setError(result.error); setStatus("error"); }
      else { console.error("[stats] regenerate failed", result.error); setStatus("ready"); }
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
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", animation: "stats-pulse 1.2s ease-in-out infinite" }} />
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

        {status === "ready" && report && report.insights.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s" }}>
            {report.insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
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

function InsightCard({ insight }: { insight: AnyInsight }) {
  const isNew = "chart_type" in insight || "type" in insight;
  const newInsight = isNew ? (insight as Insight) : null;
  const chartOption = newInsight
    ? buildEChartsOption(newInsight)
    : (insight as { option: Record<string, unknown> }).option;

  const badge = newInsight?.type ? INSIGHT_TYPE_STYLE[newInsight.type] ?? null : null;
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
      <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", lineHeight: 1.5, marginBottom: chartOption ? 16 : 0 }}>
        {insight.summary}
      </p>
      {chartOption && (
        <ReactECharts
          option={chartOption as Record<string, unknown>}
          style={{ height: 220 }}
          opts={{ renderer: "canvas" }}
        />
      )}
      {newInsight?.evidence && (
        <details style={{ marginTop: chartOption ? 12 : 16 }}>
          <summary style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", cursor: "pointer", userSelect: "none" }}>
            Dữ liệu
          </summary>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", marginTop: 6, lineHeight: 1.5 }}>
            {newInsight.evidence}
          </p>
        </details>
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
