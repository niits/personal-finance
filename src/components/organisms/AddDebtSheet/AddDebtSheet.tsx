"use client";

import { useState } from "react";

type AddDebtSheetProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { type: "lend" | "borrow"; party: string; amount: number; note: string; date: string }) => Promise<void>;
};

export function AddDebtSheet({ open, onClose, onSubmit }: AddDebtSheetProps) {
  const [type, setType] = useState<"lend" | "borrow">("lend");
  const [party, setParty] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setType("lend");
    setParty("");
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
    if (!party.trim()) { setError("Nhập tên người"); return; }
    if (!amount || amount <= 0) { setError("Nhập số tiền hợp lệ"); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ type, party: party.trim(), amount, note, date });
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

  return (
    <>
      <div onClick={submitting ? undefined : handleClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
        background: "var(--canvas)",
        borderRadius: "16px 16px 0 0",
        maxHeight: "90dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.4, margin: 0 }}>
            Thêm khoản nợ
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 16px 0" } as React.CSSProperties}>
          {/* Type toggle */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {(["lend", "borrow"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: type === t ? "var(--primary)" : "var(--canvas-card)",
                  color: type === t ? "#fff" : "var(--ink)",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t === "lend" ? "Cho vay" : "Đi vay"}
              </button>
            ))}
          </div>

          {/* Party */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{type === "lend" ? "Cho vay ai" : "Vay của ai"}</label>
            <input
              style={inputStyle}
              placeholder="Tên người"
              value={party}
              onChange={(e) => setParty(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Số tiền (VNĐ)</label>
            <input
              style={inputStyle}
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
          </div>

          {/* Date */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Ngày</label>
            <input
              style={inputStyle}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Note */}
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
