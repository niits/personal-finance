"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { isCreditCardOveruse } from "@/lib/credit-card";

// ── Types ──────────────────────────────────────────────────────────────────

export type Adjustment = { id: number; delta: number; note: string | null; created_at: number };
export type MonthlyBudget = {
  id: number;
  month: string;
  amount: number;
  adjustments: Adjustment[];
};
export type CustomBudget = {
  id: number;
  name: string;
  amount: number;
  is_active: number;
  spent: number;
  credit_card_spent: number;
  has_linked_transactions: boolean;
};

export type BudgetTemplateProps = {
  month: string | null;
  period: { start: string; end: string } | null;
  monthlyBudget: MonthlyBudget | null;
  customBudgets: CustomBudget[];
  loading: boolean;
  isCurrentMonth: boolean;
  onCreateMonthlyBudget: (amount: number) => Promise<{ error?: string }>;
  onCreateAdjustment: (delta: number, note: string | null) => Promise<{ error?: string }>;
  onCreateCustomBudget: (name: string, amount: number) => Promise<{ error?: string }>;
  onEditCustomBudget: (id: number, name: string, amount: number) => Promise<{ error?: string }>;
  onToggleCustomBudget: (id: number, active: boolean) => Promise<{ error?: string }>;
  onDeleteCustomBudget: (id: number) => Promise<{ error?: string }>;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const _fmtVND = new Intl.NumberFormat("vi-VN");
function fmt(n: number) {
  return _fmtVND.format(n);
}
function parseVND(s: string): number | null {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return isNaN(n) || n <= 0 ? null : n;
}
function fmtPeriodDate(s: string) {
  const [, m, d] = s.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

// ── Template ───────────────────────────────────────────────────────────────

export function BudgetTemplate({
  month,
  period,
  monthlyBudget,
  customBudgets,
  loading,
  onCreateMonthlyBudget,
  onCreateAdjustment,
  onCreateCustomBudget,
  onEditCustomBudget,
  onToggleCustomBudget,
  onDeleteCustomBudget,
}: BudgetTemplateProps) {
  const monthLabel = month
    ? (() => { const [y, m] = month.split("-"); return `Tháng ${parseInt(m)}/${y}`; })()
    : "";

  // Monthly budget create
  const [createStr, setCreateStr] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  // Adjustment
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjDeltaStr, setAdjDeltaStr] = useState("");
  const [adjSign, setAdjSign] = useState<1 | -1>(1);
  const [adjNote, setAdjNote] = useState("");
  const [adjErr, setAdjErr] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  // Custom budget create
  const [cbOpen, setCbOpen] = useState(false);
  const [cbName, setCbName] = useState("");
  const [cbAmountStr, setCbAmountStr] = useState("");
  const [cbErr, setCbErr] = useState("");
  const [cbSaving, setCbSaving] = useState(false);

  // Custom budget edit
  const [editingCbId, setEditingCbId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmountStr, setEditAmountStr] = useState("");
  const [editErr, setEditErr] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function createBudget() {
    const amount = parseVND(createStr);
    if (!amount || !month) { setCreateErr("Số tiền không hợp lệ"); return; }
    setCreateSaving(true); setCreateErr("");
    const result = await onCreateMonthlyBudget(amount);
    if (result.error) { setCreateErr(result.error); setCreateSaving(false); return; }
    setCreateStr("");
    setCreateSaving(false);
  }

  async function adjust() {
    const abs = parseInt(adjDeltaStr.replace(/[^\d]/g, ""), 10);
    if (!abs || abs <= 0) { setAdjErr("Nhập số tiền hợp lệ"); return; }
    const delta = abs * adjSign;
    if (monthlyBudget && monthlyBudget.amount + delta <= 0) { setAdjErr("Ngân sách sau điều chỉnh phải lớn hơn 0"); return; }
    setAdjSaving(true); setAdjErr("");
    const result = await onCreateAdjustment(delta, adjNote || null);
    if (result.error) { setAdjErr(result.error); setAdjSaving(false); return; }
    setAdjOpen(false); setAdjDeltaStr(""); setAdjNote(""); setAdjSaving(false);
  }

  async function createCustom() {
    if (!cbName.trim()) { setCbErr("Nhập tên"); return; }
    const amount = parseVND(cbAmountStr);
    if (!amount) { setCbErr("Số tiền không hợp lệ"); return; }
    setCbSaving(true); setCbErr("");
    const result = await onCreateCustomBudget(cbName.trim(), amount);
    if (result.error) { setCbErr(result.error); setCbSaving(false); return; }
    setCbOpen(false); setCbName(""); setCbAmountStr(""); setCbSaving(false);
  }

  async function updateCustom() {
    if (!editingCbId) return;
    if (!editName.trim()) { setEditErr("Nhập tên"); return; }
    const amount = parseVND(editAmountStr);
    if (!amount) { setEditErr("Số tiền không hợp lệ"); return; }
    setEditSaving(true); setEditErr("");
    const result = await onEditCustomBudget(editingCbId, editName.trim(), amount);
    if (result.error) { setEditErr(result.error); setEditSaving(false); return; }
    setEditSaving(false);
    setEditingCbId(null);
  }

  function startEdit(cb: CustomBudget) {
    setEditingCbId(cb.id);
    setEditName(cb.name);
    setEditAmountStr(fmt(cb.amount));
    setEditErr("");
  }

  if (loading) return (
    <div style={{ padding: "48px", textAlign: "center", color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14 }}>
      Đang tải…
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ background: "var(--surface-black)", padding: "28px 22px 24px" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", marginBottom: 2 }}>
          {monthLabel}
        </p>
        {period && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-body)", marginBottom: 6 }}>
            {fmtPeriodDate(period.start)} – {fmtPeriodDate(period.end)}
          </p>
        )}
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--on-dark)", letterSpacing: -0.28 }}>
          Ngân sách
        </h1>
      </div>

      <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Monthly budget card ── */}
        <div style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)", border: "1px solid var(--hairline)", overflow: "hidden" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                Ngân sách tháng
              </p>
              {period && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                  {fmtPeriodDate(period.start)} – {fmtPeriodDate(period.end)}
                </p>
              )}
            </div>

            {monthlyBudget ? (
              <>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.374 }}>
                  {fmt(monthlyBudget.amount)}₫
                </p>
                {monthlyBudget.adjustments?.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {monthlyBudget.adjustments.map((a) => (
                      <p key={a.id} style={{ fontSize: 12, color: a.delta > 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-body)" }}>
                        {a.delta > 0 ? "+" : ""}{fmt(a.delta)}₫{a.note ? ` — ${a.note}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
                Chưa đặt ngân sách {monthLabel}
              </p>
            )}
          </div>

          {/* Create form */}
          {!monthlyBudget && (
            <div style={{ padding: "16px 20px" }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input
                  type="text" inputMode="numeric" placeholder="5,000,000" aria-label="Ngân sách tháng"
                  value={createStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    const n = parseInt(raw, 10);
                    setCreateStr(raw ? fmt(n) : "");
                    setCreateErr("");
                  }}
                  className={`w-full pt-3 pr-11 pb-3 pl-4 rounded-md border font-display text-[22px] font-semibold text-ink bg-canvas-parchment outline-none ${createErr ? "border-danger" : "border-hairline"}`}
                />
                <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-[18px] text-ink-muted-48 font-display font-semibold">₫</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {[3000000, 5000000, 7000000, 10000000].map((n) => (
                  <button type="button" key={n} onClick={() => { setCreateStr(fmt(n)); setCreateErr(""); }}
                    className={`px-3 py-[5px] rounded-full border border-hairline font-body text-[13px] cursor-pointer transition-colors ${createStr === fmt(n) ? "bg-primary text-white" : "bg-canvas-parchment text-ink-muted-48"}`}>
                    {n / 1000000}tr
                  </button>
                ))}
              </div>
              {createErr && <p style={{ color: "var(--danger)", fontSize: 14, fontFamily: "var(--font-body)", marginBottom: 10 }}>{createErr}</p>}
              <button type="button" onClick={createBudget} disabled={createSaving || !createStr}
                className={`w-full p-3 rounded-full border-none font-body text-[15px] transition-[background,opacity] ${createStr ? "bg-primary text-white cursor-pointer" : "bg-hairline text-ink-muted-48 cursor-default"}`}>
                {createSaving ? "Đang lưu…" : "Xác nhận ngân sách"}
              </button>
            </div>
          )}

          {/* Adjust button */}
          {monthlyBudget && !adjOpen && (
            <button type="button" onClick={() => setAdjOpen(true)}
              className="w-full px-5 py-[14px] bg-transparent border-none text-primary font-body text-[14px] cursor-pointer text-left flex items-center gap-1.5">
              <span style={{ fontSize: 18 }}>±</span> Điều chỉnh ngân sách
            </button>
          )}

          {/* Adjust form */}
          {monthlyBudget && adjOpen && (
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                Điều chỉnh ngân sách
              </p>

              <div style={{ display: "flex", background: "var(--canvas-parchment)", borderRadius: 10, padding: 3, marginBottom: 12 }}>
                {([1, -1] as const).map((s) => (
                  <button type="button" key={s} onClick={() => setAdjSign(s)}
                    className={`flex-1 p-2 rounded-sm border-none font-body text-[15px] cursor-pointer transition-colors ${adjSign === s ? "font-semibold" : "font-normal"}`}
                    style={{
                      background: adjSign === s ? (s === 1 ? "var(--success)" : "var(--danger)") : "transparent",
                      color: adjSign === s ? "#fff" : "var(--ink-muted-48)",
                    }}>
                    {s === 1 ? "+ Tăng" : "− Giảm"}
                  </button>
                ))}
              </div>

              <div style={{ position: "relative", marginBottom: 10 }}>
                <input type="text" inputMode="numeric" placeholder="500,000" aria-label="Số tiền điều chỉnh"
                  value={adjDeltaStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    const n = parseInt(raw, 10);
                    setAdjDeltaStr(raw ? fmt(n) : "");
                    setAdjErr("");
                  }}
                  className={`w-full pt-[11px] pr-11 pb-[11px] pl-4 rounded-md border font-display text-[20px] font-semibold text-ink bg-canvas-parchment outline-none ${adjErr ? "border-danger" : "border-hairline"}`}
                />
                <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-base text-ink-muted-48 font-display font-semibold">₫</span>
              </div>

              <input type="text" placeholder="Lý do (tuỳ chọn)" aria-label="Lý do điều chỉnh" value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                className="w-full px-[14px] py-2.5 rounded-md border border-hairline font-body text-[14px] text-ink bg-canvas-parchment outline-none mb-2.5"
              />

              {adjErr && <p style={{ color: "var(--danger)", fontSize: 14, fontFamily: "var(--font-body)", marginBottom: 10 }}>{adjErr}</p>}

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setAdjOpen(false); setAdjDeltaStr(""); setAdjNote(""); setAdjErr(""); }}
                  className="flex-1 p-[11px] rounded-full border border-hairline bg-transparent text-ink-muted-48 font-body text-[14px] cursor-pointer">
                  Huỷ
                </button>
                <button type="button" onClick={adjust} disabled={adjSaving || !adjDeltaStr}
                  className={`flex-[2] p-[11px] rounded-full border-none font-body text-[14px] transition-[background,opacity] ${adjDeltaStr ? "cursor-pointer" : "cursor-default"}`}
                  style={{
                    background: adjDeltaStr ? (adjSign === 1 ? "var(--success)" : "var(--danger)") : "var(--hairline)",
                    color: adjDeltaStr ? "#fff" : "var(--ink-muted-48)",
                  }}>
                  {adjSaving ? "Đang lưu…" : `${adjSign === 1 ? "Tăng" : "Giảm"} ${adjDeltaStr || "0"}₫`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Custom budgets ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Ngân sách riêng
            </p>
            <button type="button" onClick={() => setCbOpen(!cbOpen)}
              className="bg-primary text-white border-none rounded-full px-[14px] py-[5px] font-body text-[13px] cursor-pointer">
              + Thêm
            </button>
          </div>

          {/* Create form */}
          {cbOpen && (
            <div style={{
              background: "var(--canvas)", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--hairline)", padding: "16px 16px 12px", marginBottom: 10,
            }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                Ngân sách riêng mới
              </p>
              <input type="text" placeholder="Tên (vd: Du lịch, Mua laptop…)" aria-label="Tên ngân sách riêng" value={cbName}
                onChange={(e) => { setCbName(e.target.value); setCbErr(""); }}
                className="w-full px-[14px] py-[11px] rounded-md border border-hairline font-body text-[15px] text-ink bg-canvas-parchment outline-none mb-2"
              />
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input type="text" inputMode="numeric" placeholder="Mục tiêu" aria-label="Mục tiêu"
                  value={cbAmountStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    const n = parseInt(raw, 10);
                    setCbAmountStr(raw ? fmt(n) : "");
                    setCbErr("");
                  }}
                  className="w-full pt-[11px] pr-11 pb-[11px] pl-4 rounded-md border border-hairline font-display text-[20px] font-semibold text-ink bg-canvas-parchment outline-none"
                />
                <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-base text-ink-muted-48 font-display font-semibold">₫</span>
              </div>
              {cbErr && <p style={{ color: "var(--danger)", fontSize: 14, fontFamily: "var(--font-body)", marginBottom: 8 }}>{cbErr}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setCbOpen(false); setCbName(""); setCbAmountStr(""); setCbErr(""); }}
                  className="flex-1 p-2.5 rounded-full border border-hairline bg-transparent text-ink-muted-48 font-body text-[14px] cursor-pointer">
                  Huỷ
                </button>
                <button type="button" onClick={createCustom} disabled={cbSaving}
                  className="flex-[2] p-2.5 rounded-full border-none bg-primary text-white font-body text-[14px] cursor-pointer">
                  {cbSaving ? "Đang lưu…" : "Tạo"}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {customBudgets.length === 0 && !cbOpen ? (
            <div style={{
              background: "var(--canvas)", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--hairline)", padding: "24px 20px", textAlign: "center",
            }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
                Chưa có ngân sách riêng
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 4, lineHeight: 1.5 }}>
                Tạo quỹ riêng cho từng mục tiêu: du lịch, mua sắm, khẩn cấp…
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {customBudgets.map((cb) => {
                const pct = Math.min((cb.spent / cb.amount) * 100, 100);
                const over = cb.spent > cb.amount;
                const isEditing = editingCbId === cb.id;
                const canDelete = !cb.has_linked_transactions;
                const overuse = isCreditCardOveruse(cb.credit_card_spent, cb.spent);

                return (
                  <div key={cb.id} style={{
                    background: "var(--canvas)", borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--hairline)", padding: "16px",
                    opacity: cb.is_active ? 1 : 0.6,
                  }}>
                    {isEditing ? (
                      <div>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                          Sửa ngân sách
                        </p>
                        <input type="text" placeholder="Tên" aria-label="Tên ngân sách" value={editName}
                          onChange={(e) => { setEditName(e.target.value); setEditErr(""); }}
                          className="w-full px-[14px] py-[11px] rounded-md border border-hairline font-body text-[15px] text-ink bg-canvas-parchment outline-none mb-2"
                        />
                        <div style={{ position: "relative", marginBottom: 8 }}>
                          <input type="text" inputMode="numeric" placeholder="Mục tiêu" aria-label="Mục tiêu"
                            value={editAmountStr}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, "");
                              const n = parseInt(raw, 10);
                              setEditAmountStr(raw ? fmt(n) : "");
                              setEditErr("");
                            }}
                            className="w-full pt-[11px] pr-11 pb-[11px] pl-4 rounded-md border border-hairline font-display text-[20px] font-semibold text-ink bg-canvas-parchment outline-none"
                          />
                          <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-base text-ink-muted-48 font-display font-semibold">₫</span>
                        </div>
                        {editErr && <p style={{ color: "var(--danger)", fontSize: 14, fontFamily: "var(--font-body)", marginBottom: 8 }}>{editErr}</p>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" onClick={() => setEditingCbId(null)}
                            className="flex-1 p-2.5 rounded-full border border-hairline bg-transparent text-ink-muted-48 font-body text-[14px] cursor-pointer">
                            Huỷ
                          </button>
                          <button type="button" onClick={updateCustom} disabled={editSaving}
                            className={`flex-[2] p-2.5 rounded-full border-none bg-primary text-white font-body text-[14px] ${editSaving ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"}`}>
                            {editSaving ? "Đang lưu…" : "Lưu"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                              {cb.name}
                            </p>
                            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                              {fmt(cb.spent)}₫ / {fmt(cb.amount)}₫
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {cb.is_active === 1 && (
                              <button type="button" onClick={() => startEdit(cb)}
                                className="px-2.5 py-1 rounded-full border border-hairline bg-canvas-parchment text-ink-muted-48 font-body text-xs cursor-pointer">
                                Sửa
                              </button>
                            )}
                            <button type="button"
                              onClick={() => canDelete ? onDeleteCustomBudget(cb.id) : undefined}
                              disabled={!canDelete}
                              title={canDelete ? undefined : "Quỹ đang có giao dịch liên kết"}
                              className={`px-2 py-1 rounded-full bg-transparent font-body text-xs border ${canDelete ? "border-danger text-danger cursor-pointer opacity-100" : "border-hairline text-ink-muted-48 cursor-not-allowed opacity-[0.35]"}`}>
                              ✕
                            </button>
                          </div>
                        </div>
                        <div style={{ height: 4, background: "var(--hairline)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: over ? "var(--danger)" : "var(--primary)", borderRadius: 2, transition: "width 0.4s ease" }} />
                        </div>
                        {(over || cb.credit_card_spent > 0 || overuse) && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                            {over && (
                              <p style={{ fontSize: 12, color: "var(--danger)", fontFamily: "var(--font-body)" }}>
                                Vượt {fmt(cb.spent - cb.amount)}₫
                              </p>
                            )}
                            {cb.credit_card_spent > 0 && (
                              <p style={{ fontSize: 11, color: "var(--ink-muted-48)", fontFamily: "var(--font-body)" }}>
                                trong đó {fmt(cb.credit_card_spent)}₫ chưa trừ (thẻ tín dụng)
                              </p>
                            )}
                            {overuse && <Badge label="Dùng thẻ nhiều" variant="danger" />}
                          </div>
                        )}
                        <button type="button" onClick={() => onToggleCustomBudget(cb.id, cb.is_active !== 1)}
                          className={`w-full mt-3 py-2.5 rounded-full font-body text-[14px] font-semibold cursor-pointer border ${
                            cb.is_active ? "border-danger text-danger bg-transparent" : "border-hairline text-ink bg-canvas-parchment"
                          }`}>
                          {cb.is_active ? "Đóng ngân sách" : "Mở lại"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
