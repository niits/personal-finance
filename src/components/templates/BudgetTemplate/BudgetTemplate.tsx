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
    if (!cbName.trim()) { setCbErr("Vui lòng nhập tên ngân sách riêng."); return; }
    const amount = parseVND(cbAmountStr);
    if (!amount) { setCbErr("Số tiền không hợp lệ"); return; }
    setCbSaving(true); setCbErr("");
    const result = await onCreateCustomBudget(cbName.trim(), amount);
    if (result.error) { setCbErr(result.error); setCbSaving(false); return; }
    setCbOpen(false); setCbName(""); setCbAmountStr(""); setCbSaving(false);
  }

  async function updateCustom() {
    if (!editingCbId) return;
    if (!editName.trim()) { setEditErr("Vui lòng nhập tên ngân sách riêng."); return; }
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
      <div className="mx-auto max-w-[720px] border-b border-hairline bg-canvas px-5 pb-lg pt-lg">
        <nav aria-label="Điều hướng cài đặt" className="mb-xs">
          <Link
            href="/account"
            className="-ml-xs inline-flex min-h-11 items-center gap-xxs px-xs font-body text-[15px] text-primary no-underline"
          >
            <span aria-hidden="true" className="text-[22px] leading-none">‹</span>
            <span>Cài đặt</span>
          </Link>
        </nav>
        <p className="mb-xs font-body text-[13px] text-ink-muted-48">
          {monthLabel}{period ? ` · ${fmtPeriodDate(period.start)} – ${fmtPeriodDate(period.end)}` : ""}
        </p>
        <h1 className="font-display text-[28px] font-semibold leading-[33px] tracking-[-0.28px] text-ink">
          Ngân sách
        </h1>
      </div>

      <div className="mx-auto flex max-w-[720px] flex-col gap-md px-5 pb-xl pt-md">

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
                    <label htmlFor="monthly-objective-edit" className="mb-1 block font-body text-[13px] text-ink-muted-80">Mục tiêu tháng (tùy chọn)</label>
                    <input id="monthly-objective-edit" type="text" maxLength={500} value={objectiveText}
                      onChange={(event) => { setObjectiveText(event.target.value); setObjectiveErr(""); }}
                      className="mb-2 min-h-11 w-full rounded-md border border-hairline bg-canvas-parchment px-[14px] font-body text-[17px] text-ink outline-none" />
                    {objectiveErr ? <p className="mb-2 font-body text-[14px] text-danger">{objectiveErr}</p> : null}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setObjectiveOpen(false)} className="min-h-11 flex-1 rounded-full border border-hairline bg-transparent font-body text-[14px] text-ink-muted-80">Hủy</button>
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
                    className={`min-h-11 rounded-pill border border-hairline px-sm font-body text-[13px] transition-colors ${effectiveCreateStr === fmt(n) ? "bg-primary text-on-primary" : "bg-canvas-parchment text-ink-muted-48"}`}>
                    {n / 1000000}tr
                  </button>
                ))}
              </div>
              <label htmlFor="monthly-objective-create" className="mb-1 block font-body text-[13px] text-ink-muted-80">Mục tiêu tháng (tùy chọn)</label>
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
                    className={`min-h-11 flex-1 rounded-sm border-none font-body text-[15px] transition-colors ${adjSign === s ? "bg-primary font-semibold text-on-primary" : "bg-transparent font-normal text-ink-muted-48"}`}>
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
                  Hủy
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
              className="min-h-11 rounded-pill border-0 bg-primary px-md font-body text-[15px] font-semibold text-on-primary">
              Thêm
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
              <input type="text" placeholder="Ví dụ: Du lịch, mua máy tính" aria-label="Tên ngân sách riêng" value={cbName}
                onChange={(e) => { setCbName(e.target.value); setCbErr(""); }}
                className="mb-2 w-full rounded-md border border-hairline bg-canvas-parchment px-[14px] py-[11px] font-body text-[17px] text-ink outline-none"
              />
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input type="text" inputMode="numeric" placeholder="Số tiền mục tiêu" aria-label="Số tiền mục tiêu"
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
                  className="min-h-11 flex-1 rounded-pill border border-hairline bg-transparent font-body text-[14px] text-ink-muted-48">
                  Hủy
                </button>
                <button type="button" onClick={createCustom} disabled={cbSaving}
                  className="min-h-11 flex-[2] rounded-pill border-none bg-primary font-body text-[14px] text-on-primary">
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
                Tạo ngân sách riêng cho các khoản chi như du lịch hoặc mua sắm.
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
                          className="mb-2 w-full rounded-md border border-hairline bg-canvas-parchment px-[14px] py-[11px] font-body text-[17px] text-ink outline-none"
                        />
                        <div style={{ position: "relative", marginBottom: 8 }}>
                          <input type="text" inputMode="numeric" placeholder="Số tiền mục tiêu" aria-label="Số tiền mục tiêu"
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
                            className="min-h-11 flex-1 rounded-pill border border-hairline bg-transparent font-body text-[14px] text-ink-muted-48">
                            Hủy
                          </button>
                          <button type="button" onClick={updateCustom} disabled={editSaving}
                            className={`min-h-11 flex-[2] rounded-pill border-none bg-primary font-body text-[14px] text-on-primary ${editSaving ? "cursor-not-allowed opacity-70" : "cursor-pointer opacity-100"}`}>
                            {editSaving ? "Đang lưu…" : "Lưu"}
                          </button>
                        </div>
                      </div>
                    ) : isDeleteBlocked ? (
                      <div>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                          Chưa thể xóa &ldquo;{cb.name}&rdquo;
                        </p>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginBottom: 16, lineHeight: 1.5 }}>
                          {blockedDelete.error ?? `Ngân sách này đang liên kết với ${blockedDelete.count} giao dịch. Hãy bỏ liên kết trong từng giao dịch trước khi xóa.`}
                        </p>
                        <button type="button" onClick={() => setBlockedDelete(null)}
                          className="min-h-11 rounded-full border border-hairline bg-transparent px-5 text-ink-muted-80 font-body text-[14px] cursor-pointer">
                          Đã hiểu
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-xs min-w-0">
                          <div className="min-w-0">
                            <p className="break-words font-body text-[17px] font-semibold text-ink">
                              {cb.name}
                            </p>
                            <p className="mt-xxs font-body text-[13px] text-ink-muted-48">
                              {fmt(cb.spent)}₫ / {fmt(cb.amount)}₫
                            </p>
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
                        <div className="mt-xs flex gap-xs border-t border-divider-soft pt-xs">
                            {cb.is_active === 1 && (
                              <button type="button" onClick={() => startEdit(cb)}
                                className="min-h-11 flex-1 rounded-sm border-0 bg-transparent font-body text-[15px] font-semibold text-primary hover:bg-canvas-parchment">
                                Sửa
                              </button>
                            )}
                            <button type="button" onClick={() => onToggleCustomBudget(cb.id, cb.is_active !== 1)}
                              className="min-h-11 flex-1 rounded-sm border-0 bg-transparent font-body text-[15px] font-semibold text-primary hover:bg-canvas-parchment">
                              {cb.is_active ? "Tắt" : "Bật"}
                            </button>
                            <button type="button"
                              onClick={() => requestDelete(cb)}
                              aria-label={`Xóa ngân sách ${cb.name}`}
                              className="min-h-11 flex-1 rounded-sm border-0 bg-transparent font-body text-[15px] font-semibold text-ink-muted-80 hover:bg-canvas-parchment">
                              Xóa
                            </button>
                        </div>
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
        title={deleteCandidate ? `Xóa “${deleteCandidate.name}”?` : "Xóa ngân sách?"}
        consequence="Ngân sách riêng sẽ bị xóa vĩnh viễn. Không thể hoàn tác thao tác này."
        confirmLabel="Xác nhận xóa"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}
