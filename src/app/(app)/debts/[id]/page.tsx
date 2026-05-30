"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TransactionForm } from "@/components/organisms/TransactionForm";
import { LinkTransactionSheet } from "@/components/organisms/LinkTransactionSheet";
import type { EligibleTransaction } from "@/components/organisms/LinkTransactionSheet";
import { DebtProgressBar } from "@/components/atoms/DebtProgressBar";
import { formatVND } from "@/components/atoms/CurrencyDisplay";
import { repaymentTxType, type DebtWithRepayments, type LinkedTransaction } from "@/lib/debt";
import type { TransactionFormMode } from "@/components/organisms/TransactionForm";

const fmt = new Intl.NumberFormat("vi-VN").format;

export default function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [debt, setDebt] = useState<DebtWithRepayments | null>(null);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<TransactionFormMode | null>(null);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [settling, setSettling] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editDebtOpen, setEditDebtOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [eligible, setEligible] = useState<EligibleTransaction[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);

  useEffect(() => {
    params.then(({ id: pid }) => setId(pid));
  }, [params]);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/debts/${id}`);
      if (res.status === 401) { router.replace("/sign-in"); return; }
      if (res.status === 404) { router.replace("/debts"); return; }
      if (!res.ok) return;
      const data = await res.json() as { debt: DebtWithRepayments };
      setDebt(data.debt);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function handleUnlink(txId: number) {
    const res = await fetch(`/api/transactions/${txId}/link`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      alert(e.error ?? "Không thể hủy liên kết");
      return;
    }
    await load(true);
  }

  async function openLink() {
    if (!debt) return;
    setLinkOpen(true);
    setEligibleLoading(true);
    try {
      // Eligible repayments: standalone (debt_id null) transactions of the
      // repayment type for this debt, within the current budget period.
      const res = await fetch(`/api/transactions?type=${repaymentTxType(debt.type)}`);
      if (!res.ok) { setEligible([]); return; }
      const data = await res.json() as { transactions: (EligibleTransaction & { debt_id: string | null })[] };
      setEligible(data.transactions.filter((t) => t.debt_id === null));
    } finally {
      setEligibleLoading(false);
    }
  }

  async function handleLink(txId: number) {
    if (!debt) return;
    const res = await fetch(`/api/transactions/${txId}/link`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debt_id: debt.id }),
    });
    if (!res.ok) {
      const e = await res.json() as { error?: string };
      alert(e.error ?? "Không thể liên kết giao dịch");
      return;
    }
    setLinkOpen(false);
    await load(true);
  }

  async function handleSettle() {
    if (!debt) return;
    setSettling(true);
    try {
      if (debt.remaining > 0) {
        // Create final repayment for remaining balance
        const txType = debt.type === "lend" ? "income" : "expense";
        const r = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: debt.remaining, type: txType, date: new Date().toISOString().slice(0, 10),
            note: "Tất toán", debt_id: debt.id,
          }),
        });
        if (!r.ok) { alert("Lỗi khi tạo giao dịch tất toán"); return; }
      }
      await fetch(`/api/debts/${debt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "settled" }),
      });
      await load(true);
      setConfirmSettle(false);
    } finally {
      setSettling(false);
    }
  }

  async function handleReopen() {
    if (!debt) return;
    await fetch(`/api/debts/${debt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    await load(true);
  }

  async function handleDelete() {
    if (!debt) return;
    if (!confirm(`Xóa khoản nợ "${debt.party}"? Các giao dịch liên kết sẽ không bị xóa.`)) return;
    await fetch(`/api/debts/${debt.id}`, { method: "DELETE" });
    router.replace("/debts");
  }

  if (loading || !debt) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas-parchment)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>Đang tải…</span>
      </div>
    );
  }

  const isLend = debt.type === "lend";
  const isSettled = debt.status === "settled";

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas-parchment)", paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ background: "var(--canvas)", padding: "16px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <button type="button" onClick={() => router.back()} style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 17, color: "var(--primary)", cursor: "pointer", padding: "0 12px 0 0" }}>
            ←
          </button>
          <span style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: -0.5 }}>
            {debt.party}
          </span>
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setMenuOpen((v) => !v)} style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 20, color: "var(--ink-muted-48)", cursor: "pointer", padding: "0 0 0 12px" }}>
              ···
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: "100%", background: "var(--canvas)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", minWidth: 180, zIndex: 10, overflow: "hidden" }}>
                {[
                  { label: "Chỉnh sửa", action: () => { setEditDebtOpen(true); setMenuOpen(false); } },
                  isSettled
                    ? { label: "Mở lại", action: () => { handleReopen(); setMenuOpen(false); } }
                    : null,
                  { label: "Xóa khoản nợ", action: () => { setMenuOpen(false); handleDelete(); }, danger: true },
                ].filter(Boolean).map((item) => item && (
                  <button type="button" key={item.label} onClick={item.action} style={{ display: "block", width: "100%", padding: "13px 16px", background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 15, color: item.danger ? "var(--destructive)" : "var(--ink)", textAlign: "left", cursor: "pointer", borderBottom: "1px solid var(--hairline)" }}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Type + note */}
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", marginBottom: 12 }}>
          {isLend ? "Cho vay" : "Đi vay"}{debt.note ? ` · ${debt.note}` : ""}
          {isSettled && <span style={{ marginLeft: 8, color: "#30d158", fontWeight: 600 }}>· Tất toán ✓</span>}
        </div>

        {/* Hero remaining */}
        {!isSettled && (
          <>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", textAlign: "center", marginBottom: 4 }}>còn lại</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, color: "var(--ink)", textAlign: "center", letterSpacing: -0.5, marginBottom: 16 }}>
              {fmt(debt.remaining)}₫
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)" }}>Gốc {fmt(debt.opening_amount)}₫</span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)" }}>Đã trả {fmt(debt.total_repaid)}₫</span>
            </div>
            <DebtProgressBar openingAmount={debt.opening_amount} totalRepaid={debt.total_repaid} variant={isLend ? "lend" : "borrow"} />

            {debt.due_date && (
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13, marginTop: 12, color: debt.is_overdue ? "var(--destructive)" : "var(--ink-muted-48)" }}>
                {debt.is_overdue ? "⚠ Quá hạn · " : "Hạn: "}{debt.due_date.split("-").reverse().join("/")}
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction timeline */}
      <div style={{ margin: "16px 20px 0" }}>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          Lịch sử
        </p>

        <div style={{ background: "var(--canvas)", borderRadius: 14, overflow: "hidden" }}>
          {debt.transactions.length === 0 && (
            <div style={{ padding: "20px 16px", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", textAlign: "center" }}>
              Chưa có giao dịch nào
            </div>
          )}
          {debt.transactions.map((tx, i) => (
            <DebtTransactionRow
              key={tx.id}
              tx={tx}
              debtType={debt.type}
              showDivider={i > 0}
              canUnlink={!tx.is_opening || debt.transactions.length === 1}
              onUnlink={() => handleUnlink(tx.id)}
            />
          ))}
        </div>

        {!isSettled && (
          <button type="button"
            onClick={openLink}
            style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--primary)", cursor: "pointer", padding: "12px 0", display: "block" }}
          >
            + Liên kết giao dịch có sẵn
          </button>
        )}
      </div>

      {/* Actions */}
      {!isSettled && (
        <div style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))", left: 20, right: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button"
            onClick={() => setFormMode({ kind: "repayment", debt })}
            style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1.5px solid var(--primary)", background: "var(--canvas)", color: "var(--primary)", fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            + Ghi nhận thanh toán
          </button>
          {debt.remaining > 0 && (
            <button type="button"
              onClick={() => setConfirmSettle(true)}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            >
              ✓ Tất toán ngay
            </button>
          )}
        </div>
      )}

      {/* Settle confirm */}
      {confirmSettle && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "var(--canvas)", borderRadius: 18, padding: "24px 20px", margin: "0 24px", maxWidth: 340, width: "100%" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 600, color: "var(--ink)", textAlign: "center", marginBottom: 8 }}>
              Tất toán khoản nợ
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)", textAlign: "center", marginBottom: 24 }}>
              Tất toán {fmt(debt.remaining)}₫ từ <strong>{debt.party}</strong>?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setConfirmSettle(false)} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--canvas)", fontFamily: "var(--font-body)", fontSize: 15, cursor: "pointer" }}>
                Huỷ
              </button>
              <button type="button" onClick={handleSettle} disabled={settling} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "none", background: "var(--primary)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, cursor: settling ? "not-allowed" : "pointer" }}>
                {settling ? "..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repayment form */}
      {formMode && (
        <TransactionForm
          open={true}
          mode={formMode}
          onClose={() => setFormMode(null)}
          onSaved={() => { setFormMode(null); load(true); }}
        />
      )}

      {/* Edit debt info */}
      {editDebtOpen && <EditDebtSheet debt={debt} onClose={() => setEditDebtOpen(false)} onSaved={() => { setEditDebtOpen(false); load(true); }} />}

      {/* Link an existing transaction as a repayment */}
      {linkOpen && (
        <LinkTransactionSheet
          transactions={eligible}
          loading={eligibleLoading}
          onSelect={handleLink}
          onClose={() => setLinkOpen(false)}
        />
      )}
    </div>
  );
}

// ─── DebtTransactionRow ───────────────────────────────────────────────────────

function DebtTransactionRow({ tx, debtType, showDivider, canUnlink, onUnlink }: {
  tx: LinkedTransaction;
  debtType: "lend" | "borrow";
  showDivider: boolean;
  canUnlink: boolean;
  onUnlink: () => void;
}) {
  const [swiped, setSwiped] = useState(false);
  const directionArrow = tx.type === "income" ? "→" : "←";
  const directionColor = tx.type === "income" ? "#30d158" : "var(--ink)";

  return (
    <div
      style={{ position: "relative", overflow: "hidden", borderTop: showDivider ? "1px solid var(--hairline)" : "none" }}
      onClick={() => setSwiped(false)}
    >
      {/* Unlink action revealed on swipe */}
      {canUnlink && (
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 100,
          background: "var(--destructive)", display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }} onClick={(e) => { e.stopPropagation(); onUnlink(); }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#fff", fontWeight: 600 }}>Hủy lk</span>
        </div>
      )}

      <div
        style={{ background: "var(--canvas)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, transform: swiped ? "translateX(-100px)" : "translateX(0)", transition: "transform 0.2s ease" }}
        onTouchStart={() => setSwiped(true)}
      >
        <span style={{ fontFamily: "var(--font-body)", fontSize: 18, color: directionColor, fontWeight: 600, flexShrink: 0 }}>
          {directionArrow}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
              {tx.date.split("-").slice(1).reverse().join("/")}
            </span>
            {tx.is_opening && (
              <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, color: "var(--ink-muted-48)", background: "var(--canvas-parchment)", borderRadius: 4, padding: "1px 5px" }}>
                Gốc
              </span>
            )}
          </div>
          {tx.note && (
            <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tx.note}
            </div>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: directionColor, flexShrink: 0 }}>
          {fmt(tx.amount)}₫
        </div>
      </div>
    </div>
  );
}

// ─── EditDebtSheet ────────────────────────────────────────────────────────────

function EditDebtSheet({ debt, onClose, onSaved }: { debt: DebtWithRepayments; onClose: () => void; onSaved: () => void }) {
  const [party, setParty] = useState(debt.party);
  const [note, setNote] = useState(debt.note ?? "");
  const [dueDate, setDueDate] = useState(debt.due_date ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/debts/${debt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ party, note: note || null, due_date: dueDate || null }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 500 }} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 501, background: "var(--canvas)", borderRadius: "16px 16px 0 0", padding: "20px 20px max(24px, env(safe-area-inset-bottom))" }}>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Chỉnh sửa</p>
        {[
          { label: "Tên người", value: party, onChange: setParty, placeholder: "Tên người" },
          { label: "Ghi chú", value: note, onChange: setNote, placeholder: "Ghi chú (tuỳ chọn)" },
        ].map(({ label, value, onChange, placeholder }) => (
          <label key={label} style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", display: "block", marginBottom: 4 }}>{label}</span>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--canvas-parchment)", fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", outline: "none", boxSizing: "border-box" as const }} />
          </label>
        ))}
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", display: "block", marginBottom: 4 }}>Hạn trả (tuỳ chọn)</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--canvas-parchment)", fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", outline: "none", boxSizing: "border-box" as const }} />
        </label>
        <button type="button" onClick={save} disabled={saving} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </>
  );
}
