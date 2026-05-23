"use client";

import { useState } from "react";
import { DebtPartyCard } from "@/components/molecules/DebtPartyCard";
import { AddDebtSheet } from "@/components/organisms/AddDebtSheet";
import { AddRepaymentSheet } from "@/components/organisms/AddRepaymentSheet";
import type { DebtWithRepayments } from "@/lib/debt";

type DebtOverviewTemplateProps = {
  lending: DebtWithRepayments[];
  borrowing: DebtWithRepayments[];
  settled: DebtWithRepayments[];
  onAddDebt: (data: { type: "lend" | "borrow"; party: string; amount: number; note: string; date: string }) => Promise<void>;
  onAddRepayment: (debtId: string, data: { amount: number; note: string; date: string }) => Promise<void>;
};

export function DebtOverviewTemplate({ lending, borrowing, settled, onAddDebt, onAddRepayment }: DebtOverviewTemplateProps) {
  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [repaymentTarget, setRepaymentTarget] = useState<DebtWithRepayments | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const totalLendingOpen = lending.reduce((s, d) => s + d.remaining, 0);
  const totalBorrowingOpen = borrowing.reduce((s, d) => s + d.remaining, 0);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas-parchment)", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: -0.5, margin: 0 }}>
            Nợ
          </h1>
          <button
            onClick={() => setAddDebtOpen(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 20,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Thêm
          </button>
        </div>

        {/* Summary chips */}
        {(lending.length > 0 || borrowing.length > 0) && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {lending.length > 0 && (
              <div style={{ padding: "6px 12px", borderRadius: 20, background: "var(--canvas-card)", fontFamily: "var(--font-body)", fontSize: 12 }}>
                <span style={{ color: "var(--ink-muted-48)" }}>Đang cho vay </span>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{(totalLendingOpen / 1000).toLocaleString("vi-VN")}k</span>
              </div>
            )}
            {borrowing.length > 0 && (
              <div style={{ padding: "6px 12px", borderRadius: 20, background: "var(--canvas-card)", fontFamily: "var(--font-body)", fontSize: 12 }}>
                <span style={{ color: "var(--ink-muted-48)" }}>Đang đi vay </span>
                <span style={{ fontWeight: 600, color: "var(--destructive)" }}>{(totalBorrowingOpen / 1000).toLocaleString("vi-VN")}k</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* Lending section */}
        {lending.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Cho vay
            </p>
            {lending.map((d) => (
              <DebtPartyCard
                key={d.id}
                debt={d}
                expanded={expandedId === d.id}
                onToggle={() => toggleExpand(d.id)}
                onAddRepayment={() => setRepaymentTarget(d)}
              />
            ))}
          </section>
        )}

        {/* Borrowing section */}
        {borrowing.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Đi vay
            </p>
            {borrowing.map((d) => (
              <DebtPartyCard
                key={d.id}
                debt={d}
                expanded={expandedId === d.id}
                onToggle={() => toggleExpand(d.id)}
                onAddRepayment={() => setRepaymentTarget(d)}
              />
            ))}
          </section>
        )}

        {/* Empty state */}
        {lending.length === 0 && borrowing.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>◈</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>Chưa có khoản nợ nào</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginTop: 6 }}>
              Nhấn &quot;+ Thêm&quot; để ghi nhận khoản cho vay hoặc đi vay
            </div>
          </div>
        )}

        {/* Settled section */}
        {settled.length > 0 && (
          <section style={{ marginTop: 8, marginBottom: 20 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Đã tất toán
            </p>
            {settled.map((d) => (
              <DebtPartyCard
                key={d.id}
                debt={d}
                expanded={expandedId === d.id}
                onToggle={() => toggleExpand(d.id)}
              />
            ))}
          </section>
        )}
      </div>

      <AddDebtSheet
        open={addDebtOpen}
        onClose={() => setAddDebtOpen(false)}
        onSubmit={onAddDebt}
      />

      <AddRepaymentSheet
        open={repaymentTarget !== null}
        debtId={repaymentTarget?.id ?? null}
        partyName={repaymentTarget?.party ?? ""}
        remaining={repaymentTarget?.remaining ?? 0}
        debtType={repaymentTarget?.type ?? "lend"}
        onClose={() => setRepaymentTarget(null)}
        onSubmit={onAddRepayment}
      />
    </div>
  );
}
