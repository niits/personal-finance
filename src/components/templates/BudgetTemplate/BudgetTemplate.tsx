"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmationSheet } from "@/components/organisms/ConfirmationSheet";

// ── Types ──────────────────────────────────────────────────────────────────

export type Adjustment = { id: number; delta: number; note: string | null; created_at: number };
export type MonthlyBudget = {
  id: number;
  month: string;
  amount: number;
  objective: string | null;
  adjustments: Adjustment[];
};
export type CustomBudget = {
  id: number;
  name: string;
  amount: number;
  is_active: number;
  spent: number;
  linked_transaction_count: number;
  adjustments?: { id: number; previous_amount: number; new_amount: number; created_at: number }[];
};
export type BudgetDashboard = {
  total_expense: number;
  monthly_budget: { id: number; amount: number; remaining: number } | null;
  days_in_period: number;
  days_elapsed: number;
  pace_status: "under" | "over" | "no_budget";
};

export type BudgetTemplateProps = {
  month: string | null;
  period: { start: string; end: string } | null;
  monthlyBudget: MonthlyBudget | null;
  customBudgets: CustomBudget[];
  dashboard: BudgetDashboard | null;
  defaultMonthlyAmount: number | null;
  loading: boolean;
  error: string | null;
  isCurrentMonth: boolean;
  onRetry: () => void;
  onCreateMonthlyBudget: (amount: number, objective: string | null) => Promise<{ error?: string }>;
  onCreateAdjustment: (delta: number, note: string | null) => Promise<{ error?: string }>;
  onUpdateMonthlyObjective: (objective: string | null) => Promise<{ error?: string }>;
  onCreateCustomBudget: (name: string, amount: number) => Promise<{ error?: string }>;
  onEditCustomBudget: (id: number, name: string, amount: number) => Promise<{ error?: string }>;
  onToggleCustomBudget: (id: number, active: boolean) => Promise<{ error?: string }>;
  onDeleteCustomBudget: (id: number) => Promise<{ error?: string; affectedCount?: number }>;
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
  dashboard,
  defaultMonthlyAmount,
  loading,
  error,
  onRetry,
  onCreateMonthlyBudget,
  onCreateAdjustment,
  onUpdateMonthlyObjective,
  onCreateCustomBudget,
  onEditCustomBudget,
  onToggleCustomBudget,
  onDeleteCustomBudget,
}: BudgetTemplateProps) {
  const monthLabel = month
    ? (() => { const [y, m] = month.split("-"); return `Tháng ${parseInt(m)}/${y}`; })()
    : "";

  // Monthly budget create
  const [createStr, setCreateStr] = useState<string | null>(null);
  const [createObjective, setCreateObjective] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  // Adjustment
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjDeltaStr, setAdjDeltaStr] = useState("");
  const [adjSign, setAdjSign] = useState<1 | -1>(1);
  const [adjNote, setAdjNote] = useState("");
  const [adjErr, setAdjErr] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  // Monthly objective edit
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [objectiveText, setObjectiveText] = useState("");
  const [objectiveErr, setObjectiveErr] = useState("");
  const [objectiveSaving, setObjectiveSaving] = useState(false);

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

  // Custom budget delete confirm
  const [blockedDelete, setBlockedDelete] = useState<{ id: number; count: number; error?: string } | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CustomBudget | null>(null);

  const effectiveCreateStr = createStr ?? (defaultMonthlyAmount ? fmt(defaultMonthlyAmount) : "");

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function createBudget() {
    const amount = parseVND(effectiveCreateStr);
    if (!amount || !month) { setCreateErr("Số tiền không hợp lệ"); return; }
    setCreateSaving(true); setCreateErr("");
    const result = await onCreateMonthlyBudget(amount, createObjective.trim() || null);
    if (result.error) { setCreateErr(result.error); setCreateSaving(false); return; }
    setCreateStr(null);
    setCreateObjective("");
    setCreateSaving(false);
  }

  async function adjust() {
    const abs = parseInt(adjDeltaStr.replace(/[^\d]/g, ""), 10);
    if (!abs || abs <= 0) { setAdjErr("Nhập số tiền hợp lệ"); return; }
    if (!adjNote.trim()) { setAdjErr("Nhập lý do điều chỉnh"); return; }
    const delta = abs * adjSign;
    if (monthlyBudget && monthlyBudget.amount + delta <= 0) { setAdjErr("Ngân sách sau điều chỉnh phải lớn hơn 0"); return; }
    setAdjSaving(true); setAdjErr("");
    const result = await onCreateAdjustment(delta, adjNote.trim());
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

  async function updateObjective() {
    setObjectiveSaving(true); setObjectiveErr("");
    const result = await onUpdateMonthlyObjective(objectiveText.trim() || null);
    if (result.error) { setObjectiveErr(result.error); setObjectiveSaving(false); return; }
    setObjectiveOpen(false); setObjectiveSaving(false);
  }

  function startEdit(cb: CustomBudget) {
    setEditingCbId(cb.id);
    setEditName(cb.name);
    setEditAmountStr(fmt(cb.amount));
    setEditErr("");
  }

  async function requestDelete(cb: CustomBudget) {
    if (cb.linked_transaction_count > 0) {
      setBlockedDelete({ id: cb.id, count: cb.linked_transaction_count });
      return;
    }
    setDeleteCandidate(cb);
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    const result = await onDeleteCustomBudget(deleteCandidate.id);
    if (result.error) {
      setBlockedDelete({ id: deleteCandidate.id, count: result.affectedCount ?? 0, error: result.error });
      setDeleteCandidate(null);
    } else {
      setDeleteCandidate(null);
    }
  }

  if (loading) return (
    <div role="status" aria-live="polite" className="px-5 py-12 font-body text-ink-muted-48">
      <p className="mb-4 text-[15px]">Đang tải ngân sách…</p>
      <div className="h-32 animate-pulse rounded-lg bg-hairline" />
    </div>
  );

  if (error) return (
    <div role="alert" className="px-5 py-12 font-body">
      <h1 className="mb-2 font-display text-[28px] font-semibold text-ink">Không tải được ngân sách</h1>
      <p className="mb-5 text-[15px] text-ink-muted-80">{error}</p>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-full border-none bg-primary px-5 text-[15px] text-white">Thử lại</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ background: "var(--surface-black)", padding: "28px 22px 24px" }}>
        <nav aria-label="Điều hướng cài đặt" className="mb-xs">
          <Link
            href="/account"
            className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-body text-[14px] text-primary-on-dark no-underline"
          >
            <span aria-hidden="true" className="text-[22px] leading-none">‹</span>
            <span>Cài đặt</span>
          </Link>
        </nav>
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
                {dashboard?.monthly_budget ? (
                  <div className="mb-4">
                    <p className="font-body text-[13px] text-ink-muted-48">
                      {dashboard.monthly_budget.remaining < 0 ? "Đã vượt ngân sách" : "Còn có thể chi"}
                    </p>
                    <p className={`font-display text-[34px] font-semibold tracking-tight ${dashboard.monthly_budget.remaining < 0 ? "text-danger" : "text-ink"}`}>
                      {fmt(Math.abs(dashboard.monthly_budget.remaining))}₫
                    </p>
                    <p className="mt-1 font-body text-[13px] text-ink-muted-80">
                      Đã chi {fmt(dashboard.total_expense)}₫ · {dashboard.pace_status === "over" ? "Chi nhanh hơn kế hoạch" : "Vẫn trong kế hoạch"}
                    </p>
                  </div>
                ) : null}
                <p className="font-body text-[13px] text-ink-muted-48">Hạn mức hiện tại</p>
                <p className="font-display text-[21px] font-semibold text-ink">
                  {fmt(monthlyBudget.amount)}₫
                </p>
                {objectiveOpen ? (
                  <div className="mt-4 border-t border-hairline pt-4">
                    <label htmlFor="monthly-objective-edit" className="mb-1 block font-body text-[13px] text-ink-muted-80">Mục tiêu tháng (tuỳ chọn)</label>
                    <input id="monthly-objective-edit" type="text" maxLength={500} value={objectiveText}
                      onChange={(event) => { setObjectiveText(event.target.value); setObjectiveErr(""); }}
                      className="mb-2 min-h-11 w-full rounded-md border border-hairline bg-canvas-parchment px-[14px] font-body text-[17px] text-ink outline-none" />
                    {objectiveErr ? <p className="mb-2 font-body text-[14px] text-danger">{objectiveErr}</p> : null}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setObjectiveOpen(false)} className="min-h-11 flex-1 rounded-full border border-hairline bg-transparent font-body text-[14px] text-ink-muted-80">Huỷ</button>
                      <button type="button" onClick={updateObjective} disabled={objectiveSaving} className="min-h-11 flex-[2] rounded-full border-none bg-primary font-body text-[14px] text-white disabled:opacity-70">
                        {objectiveSaving ? "Đang lưu…" : "Lưu mục tiêu"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setObjectiveText(monthlyBudget.objective ?? ""); setObjectiveOpen(true); }} className="mt-3 min-h-11 bg-transparent p-0 font-body text-[14px] text-primary">
                    {monthlyBudget.objective ? `Mục tiêu: ${monthlyBudget.objective}` : "+ Thêm mục tiêu tháng"}
                  </button>
                )}
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
                  value={effectiveCreateStr}
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
                    className={`px-3 py-[5px] rounded-full border border-hairline font-body text-[13px] cursor-pointer transition-colors ${effectiveCreateStr === fmt(n) ? "bg-primary text-white" : "bg-canvas-parchment text-ink-muted-48"}`}>
                    {n / 1000000}tr
                  </button>
                ))}
              </div>
              <label htmlFor="monthly-objective-create" className="mb-1 block font-body text-[13px] text-ink-muted-80">Mục tiêu tháng (tuỳ chọn)</label>
              <input id="monthly-objective-create" type="text" maxLength={500} placeholder="Ví dụ: Hạn chế ăn ngoài" value={createObjective}
                onChange={(event) => setCreateObjective(event.target.value)}
                className="mb-3 min-h-11 w-full rounded-md border border-hairline bg-canvas-parchment px-[14px] font-body text-[17px] text-ink outline-none" />
              {createErr && <p style={{ color: "var(--danger)", fontSize: 14, fontFamily: "var(--font-body)", marginBottom: 10 }}>{createErr}</p>}
              <button type="button" onClick={createBudget} disabled={createSaving || !effectiveCreateStr}
                className={`w-full p-3 rounded-full border-none font-body text-[15px] transition-[background,opacity] ${effectiveCreateStr ? "bg-primary text-white cursor-pointer" : "bg-hairline text-ink-muted-48 cursor-default"}`}>
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
                    className={`flex-1 p-2 rounded-sm border-none font-body text-[15px] cursor-pointer transition-colors ${adjSign === s ? "bg-primary font-semibold text-white" : "bg-transparent font-normal text-ink-muted-48"}`}>
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

              <label htmlFor="adjustment-reason" className="mb-1 block font-body text-[13px] text-ink-muted-80">Lý do điều chỉnh</label>
              <input id="adjustment-reason" required type="text" placeholder="Ví dụ: Phát sinh chi phí y tế" value={adjNote}
                onChange={(e) => { setAdjNote(e.target.value); setAdjErr(""); }}
                className="w-full px-[14px] py-2.5 rounded-md border border-hairline font-body text-[17px] text-ink bg-canvas-parchment outline-none mb-2.5"
              />

              {adjErr && <p style={{ color: "var(--danger)", fontSize: 14, fontFamily: "var(--font-body)", marginBottom: 10 }}>{adjErr}</p>}

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setAdjOpen(false); setAdjDeltaStr(""); setAdjNote(""); setAdjErr(""); }}
                  className="flex-1 p-[11px] rounded-full border border-hairline bg-transparent text-ink-muted-48 font-body text-[14px] cursor-pointer">
                  Huỷ
                </button>
                <button type="button" onClick={adjust} disabled={adjSaving || !adjDeltaStr || !adjNote.trim()}
                  className={`flex-[2] p-[11px] rounded-full border-none font-body text-[14px] transition-[background,opacity] ${adjDeltaStr && adjNote.trim() ? "cursor-pointer bg-primary text-white" : "cursor-default bg-hairline text-ink-muted-48"}`}>
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
                const isDeleteBlocked = blockedDelete?.id === cb.id;

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
                    ) : isDeleteBlocked ? (
                      <div>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                          Chưa thể xoá &ldquo;{cb.name}&rdquo;
                        </p>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginBottom: 16, lineHeight: 1.5 }}>
                          {blockedDelete.error ?? `Ngân sách này đang liên kết với ${blockedDelete.count} giao dịch. Gỡ các liên kết trước khi xoá.`}
                        </p>
                        <button type="button" onClick={() => setBlockedDelete(null)}
                          className="min-h-11 rounded-full border border-hairline bg-transparent px-5 text-ink-muted-80 font-body text-[14px] cursor-pointer">
                          Đã hiểu
                        </button>
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
                            <button type="button" onClick={() => onToggleCustomBudget(cb.id, cb.is_active !== 1)}
                              className={`px-2.5 py-1 rounded-full border border-hairline font-body text-xs cursor-pointer ${cb.is_active ? "bg-canvas-parchment text-ink-muted-48" : "bg-ink text-white"}`}>
                              {cb.is_active ? "Tắt" : "Bật"}
                            </button>
                            <button type="button"
                              onClick={() => requestDelete(cb)}
                              aria-label={`Xoá ngân sách ${cb.name}`}
                              className="cursor-pointer rounded-full border border-danger bg-transparent px-2 py-1 font-body text-xs text-danger">
                              ✕
                            </button>
                          </div>
                        </div>
                        <div style={{ height: 4, background: "var(--hairline)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: over ? "var(--danger)" : "var(--primary)", borderRadius: 2, transition: "width 0.4s ease" }} />
                        </div>
                        {over && (
                          <p style={{ fontSize: 12, color: "var(--danger)", fontFamily: "var(--font-body)", marginTop: 4 }}>
                            Vượt {fmt(cb.spent - cb.amount)}₫
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ConfirmationSheet
        open={Boolean(deleteCandidate)}
        title={deleteCandidate ? `Xoá “${deleteCandidate.name}”?` : "Xoá ngân sách?"}
        consequence="Ngân sách riêng sẽ bị xoá vĩnh viễn. Không thể hoàn tác thao tác này."
        confirmLabel="Xác nhận xoá"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}
