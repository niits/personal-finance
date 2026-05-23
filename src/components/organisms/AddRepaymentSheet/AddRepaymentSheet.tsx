"use client";

import { useState } from "react";

type AddRepaymentSheetProps = {
  open: boolean;
  debtId: string | null;
  partyName: string;
  remaining: number;
  debtType: "lend" | "borrow";
  onClose: () => void;
  onSubmit: (debtId: string, data: { amount: number; note: string; date: string }) => Promise<void>;
};

export function AddRepaymentSheet({ open, debtId, partyName, remaining, debtType, onClose, onSubmit }: AddRepaymentSheetProps) {
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !debtId) return null;

  function reset() {
    setAmountStr("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    const amount = parseInt(amountStr.replace(/\D/g, ""), 10);
    if (!amount || amount <= 0) { setError("Nhập số tiền hợp lệ"); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(debtId!, { amount, note, date });
      reset();
      onClose();
    } catch {
      setError("Có lỗi xảy ra, thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid var(--hairline)",
    background: "var(--canvas-card)",
    fontFamily: "var(--font-body)",
    fontSize: 15,
    color: "var(--ink)",
    boxSizing: "border-box",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: 12,
    color: "var(--ink-muted-48)",
    marginBottom: 6,
    display: "block",
  };

  const action = debtType === "lend" ? "nhận lại" : "trả";

  return (
    <>
      <div onClick={submitting ? undefined : handleClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
        background: "var(--canvas)",
        borderRadius: "16px 16px 0 0",
        maxHeight: "80dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.4, margin: 0 }}>
            Ghi nhận {action} nợ
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", marginTop: 2 }}>
            {partyName} · còn {(remaining / 1000).toLocaleString("vi-VN")}k
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 16px 0" } as React.CSSProperties}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Số tiền (VNĐ)</label>
            <input
              style={inputStyle}
              type="number"
              inputMode="numeric"
              placeholder={String(remaining)}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Ngày</label>
            <input
              style={inputStyle}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Ghi chú (tuỳ chọn)</label>
            <input
              style={inputStyle}
              placeholder="Ghi chú"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--destructive)", marginBottom: 12 }}>{error}</p>
          )}
        </div>

        <div style={{ padding: "12px 16px 32px", flexShrink: 0, borderTop: "1px solid var(--hairline)" }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: submitting ? "var(--hairline)" : "var(--primary)",
              color: submitting ? "var(--ink-muted-48)" : "#fff",
              fontFamily: "var(--font-body)",
              fontSize: 16,
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </>
  );
}
