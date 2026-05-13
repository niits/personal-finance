"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Insight } from "@/lib/statistics";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Report = {
  found: true;
  period_key: string;
  insights: Insight[];
  is_dirty: boolean;
  is_current_period: boolean;
  generated_at: number;
};

type PageStatus = "loading" | "generating" | "ready" | "error";

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
  const [refreshing, setRefreshing] = useState(false);
  const [upperBound] = useState(currentMonth);
  // Latch month requests so a slow background refresh on month A doesn't overwrite month B.
  const activeMonth = useRef(selectedMonth);

  const generate = useCallback(async (month: string): Promise<Report | null> => {
    const res = await fetch(`/api/statistics?period_key=${month}`, { method: "POST" });
    if (!res.ok) return null;
    return (await res.json()) as Report;
  }, []);

  const load = useCallback(async (month: string) => {
    activeMonth.current = month;
    setStatus("loading");
    setReport(null);
    setRefreshing(false);

    const res = await fetch(`/api/statistics?period_key=${month}`);

    if (res.status === 404) {
      if (activeMonth.current !== month) return;
      setStatus("generating");
      const fresh = await generate(month);
      if (activeMonth.current !== month) return;
      if (!fresh) { setStatus("error"); return; }
      setReport(fresh);
      setStatus("ready");
      return;
    }

    if (!res.ok) {
      if (activeMonth.current !== month) return;
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
    const fresh = await generate(month);
    if (activeMonth.current !== month) return;
    setRefreshing(false);
    if (fresh) setReport(fresh);
  }, [generate]);

  const regenerate = useCallback(async (month: string) => {
    activeMonth.current = month;
    setStatus("generating");
    const fresh = await generate(month);
    if (activeMonth.current !== month) return;
    if (!fresh) { setStatus("ready"); return; } // keep old report visible on failure
    setReport(fresh);
    setStatus("ready");
  }, [generate]);

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
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <GeneratingSpinner />
            <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              Đang phân tích…
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", lineHeight: 1.5 }}>
              AI đang đọc dữ liệu và tạo báo cáo cho {toMonthLabel(selectedMonth)}
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              Không thể tạo thống kê
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginBottom: 20, lineHeight: 1.5 }}>
              Đã có lỗi xảy ra. Vui lòng thử lại.
            </p>
            <button
              onClick={() => load(selectedMonth)}
              style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
            >
              Thử lại
            </button>
          </div>
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
              <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-muted-48)" }}>
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

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div style={{ background: "var(--canvas)", borderRadius: 16, padding: "20px", border: "1px solid var(--hairline)" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.374, marginBottom: 6 }}>
        {insight.title}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", lineHeight: 1.5, marginBottom: 16 }}>
        {insight.summary}
      </p>
      <ReactECharts
        option={insight.option}
        style={{ height: 220 }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}

function GeneratingSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "3px solid var(--hairline)",
        borderTopColor: "var(--primary)",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
