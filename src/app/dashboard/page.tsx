"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TransactionForm from "@/components/TransactionForm";

type DashboardData = {
  month: string;
  period_start: string;
  period_end: string;
  total_expense: number;
  total_income: number;
  savings: number;
  monthly_budget: { id: number; amount: number; remaining: number } | null;
  days_in_period: number;
  days_elapsed: number;
  days_remaining: number;
  pace_status: "under" | "over" | "no_budget";
};

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function fmtPeriodDate(s: string) {
  const [, m, d] = s.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  function load() {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d as DashboardData); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const budgetPct = data?.monthly_budget
    ? Math.min((data.total_expense / data.monthly_budget.amount) * 100, 100)
    : 0;

  const monthLabel = data
    ? (() => { const [y, m] = data.month.split("-"); return `Tháng ${parseInt(m)}/${y}`; })()
    : "";

  return (
    <div>
      {/* Header */}
      <div style={{
        background: "var(--surface-black)",
        padding: "32px 22px 28px",
        color: "var(--on-dark)",
      }}>
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: -0.12,
          marginBottom: 2,
        }}>
          {monthLabel}
        </p>
        {data && (
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: -0.1,
            marginBottom: 6,
          }}>
            {fmtPeriodDate(data.period_start)} – {fmtPeriodDate(data.period_end)}
          </p>
        )}
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 40,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: -0.5,
          color: "var(--on-dark)",
        }}>
          {loading ? "—" : `${fmt(data?.total_expense ?? 0)}₫`}
        </p>
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "rgba(255,255,255,0.45)",
          marginTop: 4,
          letterSpacing: -0.224,
        }}>
          đã chi tháng này
        </p>

        {/* Budget bar */}
        {data?.monthly_budget && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-body)" }}>
                Ngân sách {fmt(data.monthly_budget.amount)}₫
              </span>
              <span style={{
                fontSize: 12,
                fontFamily: "var(--font-body)",
                color: data.pace_status === "over" ? "#ff453a" : "#30d158",
                fontWeight: 600,
              }}>
                {data.pace_status === "over" ? "Vượt " : "Còn "}{fmt(Math.abs(data.monthly_budget.remaining))}₫
              </span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${budgetPct}%`,
                background: data.pace_status === "over" ? "#ff453a" : "var(--primary)",
                borderRadius: 2,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Quick stats */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--hairline)" }}>
          <div style={{ background: "var(--canvas)", padding: "16px 20px" }}>
            <p style={{ fontSize: 12, color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", marginBottom: 4 }}>Thu nhập</p>
            <p style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-display)", color: "#30d158", letterSpacing: -0.3 }}>
              +{fmt(data.total_income)}₫
            </p>
          </div>
          <div style={{ background: "var(--canvas)", padding: "16px 20px" }}>
            <p style={{ fontSize: 12, color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", marginBottom: 4 }}>Tiết kiệm</p>
            <p style={{
              fontSize: 20, fontWeight: 600, fontFamily: "var(--font-display)",
              color: data.savings >= 0 ? "var(--ink)" : "#ff453a", letterSpacing: -0.3,
            }}>
              {data.savings >= 0 ? "+" : ""}{fmt(data.savings)}₫
            </p>
          </div>
        </div>
      )}

      {/* Setup checklist nếu chưa có budget */}
      {!loading && !data?.monthly_budget && (
        <div style={{ padding: "20px 16px" }}>
          <div style={{
            background: "var(--canvas)",
            borderRadius: "var(--radius-lg)",
            padding: "20px",
            border: "1px solid var(--hairline)",
          }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>
              Bắt đầu nào 👋
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { href: "/dashboard/categories", icon: "⊞", title: "Tạo danh mục", sub: "Phân loại chi tiêu của bạn" },
                { href: "/dashboard/budget", icon: "◈", title: "Đặt ngân sách tháng", sub: "Kiểm soát mức chi tiêu" },
              ].map((item) => (
                <Link key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  background: "var(--canvas-parchment)", borderRadius: 11, textDecoration: "none", color: "var(--ink)",
                }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-body)" }}>{item.title}</p>
                    <p style={{ fontSize: 12, color: "var(--ink-muted-48)", fontFamily: "var(--font-body)" }}>{item.sub}</p>
                  </div>
                  <span style={{ marginLeft: "auto", color: "var(--primary)", fontSize: 14 }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      {data?.monthly_budget && (
        <div style={{ position: "fixed", bottom: 84, right: 20, zIndex: 40 }}>
          <button
            onClick={() => setFormOpen(true)}
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--primary)",
              color: "#fff",
              fontSize: 28,
              lineHeight: 1,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,102,204,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
        </div>
      )}

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  );
}
