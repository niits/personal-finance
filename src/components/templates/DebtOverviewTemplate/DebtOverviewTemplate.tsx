"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DebtPartyCard } from "@/components/molecules/DebtPartyCard";
import { formatVND } from "@/components/atoms/CurrencyDisplay";
import type { DebtWithRepayments } from "@/lib/debt";

type DebtOverviewTemplateProps = {
  lending: DebtWithRepayments[];
  borrowing: DebtWithRepayments[];
  settled: DebtWithRepayments[];
  onOpenTransactionForm: () => void;
};

export function DebtOverviewTemplate({ lending, borrowing, settled, onOpenTransactionForm }: DebtOverviewTemplateProps) {
  const router = useRouter();
  const [settledOpen, setSettledOpen] = useState(false);

  const totalLending = lending.reduce((s, d) => s + d.remaining, 0);
  const totalBorrowing = borrowing.reduce((s, d) => s + d.remaining, 0);
  const hasAny = lending.length > 0 || borrowing.length > 0;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas-parchment)", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--ink)", letterSpacing: -0.5, margin: "0 0 16px" }}>
          Nợ
        </h1>

        {/* Summary tiles */}
        {hasAny && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "var(--canvas)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginBottom: 4 }}>Người nợ bạn</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{formatVND(totalLending)}₫</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 2 }}>{lending.length} khoản</div>
            </div>
            <div style={{ background: "var(--canvas)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginBottom: 4 }}>Bạn đang nợ</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: totalBorrowing > 0 ? "#ff9f0a" : "var(--ink)" }}>{formatVND(totalBorrowing)}₫</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 2 }}>{borrowing.length} khoản</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 20px" }}>
        {/* Lending */}
        {lending.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Cho vay
            </p>
            {lending.map((d) => (
              <DebtPartyCard key={d.id} debt={d} onTap={(id) => router.push(`/debts/${id}`)} />
            ))}
          </section>
        )}

        {/* Borrowing */}
        {borrowing.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Đi vay
            </p>
            {borrowing.map((d) => (
              <DebtPartyCard key={d.id} debt={d} onTap={(id) => router.push(`/debts/${id}`)} />
            ))}
          </section>
        )}

        {/* Empty state */}
        {!hasAny && settled.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>◈</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>Chưa có khoản nợ nào</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginTop: 6 }}>
              Nhấn + để ghi nhận khoản cho vay hoặc đi vay
            </div>
          </div>
        )}

        {/* Settled */}
        {settled.length > 0 && (
          <section style={{ marginTop: 8 }}>
            <button type="button"
              onClick={() => setSettledOpen((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 0", marginBottom: 8 }}
            >
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {settledOpen ? "▾" : "▸"} Đã tất toán ({settled.length})
              </span>
            </button>
            {settledOpen && settled.map((d) => (
              <DebtPartyCard key={d.id} debt={d} onTap={(id) => router.push(`/debts/${id}`)} />
            ))}
          </section>
        )}
      </div>

      {/* FAB */}
      <button type="button"
        onClick={onOpenTransactionForm}
        style={{
          position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", right: 20,
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: "var(--primary)", color: "#fff",
          fontFamily: "var(--font-body)", fontSize: 28, lineHeight: 1,
          cursor: "pointer", boxShadow: "0 4px 16px rgba(0,102,204,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        +
      </button>
    </div>
  );
}
