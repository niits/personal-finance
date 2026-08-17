"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import { Spinner } from "@/components/atoms/Spinner";
import type { BudgetPeriodDto, CustomEnvelopeDto } from "@/lib/ledger/contracts";
import { calendarMonthDefaults, validatePeriodAdjustment, validatePeriodDraft } from "@/lib/ledger/frontend";

export type PeriodDraft = {
  label: string;
  startDate: string;
  endDate: string;
  plannedIncome: number;
  savingsTarget: number;
  spendingLimit: number;
  objective: string | null;
};
export type PeriodMetadataDraft = { label: string; objective: string | null; startDate?: string; endDate?: string };
type Result = Promise<{ error?: string }>;
type Target = "planned_income" | "savings_target" | "spending_limit";
type Props = {
  periods: BudgetPeriodDto[];
  selectedId: number | null;
  envelopes: CustomEnvelopeDto[];
  envelopesLoading: boolean;
  submitting: boolean;
  error: string | null;
  onSelect: (id: number) => void;
  onCreatePeriod: (draft: PeriodDraft) => Result;
  onPatchPeriod: (id: number, draft: PeriodMetadataDraft) => Result;
  onAdjustPeriod: (id: number, target: Target, delta: number, note: string) => Result;
  onCreateEnvelope: (periodId: number, name: string, amount: number) => Result;
  onRenameEnvelope: (id: string, name: string) => Result;
  onAdjustEnvelope: (id: string, delta: number, note: string) => Result;
  onCloseEnvelope: (id: string) => Result;
};

const field = "mt-xxs min-h-11 w-full min-w-0 rounded-md border border-hairline bg-canvas px-sm font-body text-[15px] text-ink";
export function LedgerBudgetManager(props: Props) {
  const selected = props.periods.find((period) => period.id === props.selectedId) ?? null;
  const [defaults] = useState(calendarMonthDefaults);
  const [label, setLabel] = useState(defaults.label);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [income, setIncome] = useState("");
  const [savings, setSavings] = useState("0");
  const [limit, setLimit] = useState("");
  const [objective, setObjective] = useState("");
  const [target, setTarget] = useState<Target>("spending_limit");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [envelopeName, setEnvelopeName] = useState("");
  const [envelopeAmount, setEnvelopeAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function result(promise: Result) {
    setLocalError(null);
    const response = await promise;
    setLocalError(response.error ?? null);
  }

  function fail(message: string) {
    setLocalError(message);
  }

  return <div className="space-y-xl">
    <section className="rounded-lg border border-hairline bg-canvas p-lg">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <label className="min-w-52 flex-1 font-body text-[13px] text-ink-muted-48">Kỳ ngân sách<select value={props.selectedId ?? ""} disabled={props.submitting} onChange={(event) => { setLocalError(null); props.onSelect(Number(event.target.value)); }} className={field}><option value="">Chọn kỳ</option>{props.periods.map((period) => <option key={period.id} value={period.id}>{period.label} · {period.startDate} → {period.endDate}</option>)}</select></label>
        <details><summary className="flex min-h-11 cursor-pointer list-none items-center rounded-pill bg-primary px-md font-body text-[15px] text-on-primary">Tạo kỳ</summary>
          <form className="mt-md grid min-w-72 gap-sm sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            const draft: PeriodDraft = { label: label.trim(), startDate: start, endDate: end, plannedIncome: Number(income), savingsTarget: Number(savings), spendingLimit: Number(limit), objective: objective.trim() || null };
            const validation = validatePeriodDraft(draft);
            if (validation) { fail(validation); return; }
            void result(props.onCreatePeriod(draft));
          }}>
            <label className="font-body text-[13px] text-ink-muted-48">Tên<input required value={label} onChange={(event) => setLabel(event.target.value)} className={field} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Mục tiêu<input value={objective} onChange={(event) => setObjective(event.target.value)} className={field} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Từ<input required type="date" value={start} onChange={(event) => setStart(event.target.value)} className={field} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Đến<input required type="date" value={end} onChange={(event) => setEnd(event.target.value)} className={field} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Thu nhập<input required inputMode="numeric" type="number" min="0" step="1" value={income} onChange={(event) => setIncome(event.target.value)} className={field} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Tiết kiệm<input required inputMode="numeric" type="number" min="0" step="1" value={savings} onChange={(event) => setSavings(event.target.value)} className={field} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Giới hạn chi<input required inputMode="numeric" type="number" min="0" step="1" value={limit} onChange={(event) => setLimit(event.target.value)} className={field} /></label>
            <div className="self-end"><Button type="submit" label="Tạo kỳ" loading={props.submitting} pill /></div>
          </form>
        </details>
      </div>
    </section>

    {selected ? <>
      <section className="rounded-lg border border-hairline bg-canvas p-lg">
        <div className="flex justify-between gap-md"><div><p className="font-body text-[13px] text-ink-muted-48">{selected.startDate} → {selected.endDate}{selected.isLocked ? " · Đã khoá ngày" : ""}</p><h2 className="mt-xxs font-display text-[24px] font-semibold text-ink">{selected.label}</h2></div><div className={`text-right ${selected.actual.remaining < 0 ? "text-danger" : "text-ink"}`}><p className="font-body text-[12px] text-ink-muted-48">{selected.actual.remaining < 0 ? "Vượt giới hạn kỳ" : "Còn lại toàn kỳ"}</p><CurrencyDisplay amount={selected.actual.remaining} size="lg" /></div></div>
        <div className="mt-lg grid grid-cols-2 gap-md sm:grid-cols-4"><Metric label="Thu nhập kế hoạch" initial={selected.initial.plannedIncome} effective={selected.effective.plannedIncome} /><Metric label="Mục tiêu tiết kiệm" initial={selected.initial.savingsTarget} effective={selected.effective.savingsTarget} /><Metric label="Giới hạn chi" initial={selected.initial.spendingLimit} effective={selected.effective.spendingLimit} /><Metric label="Đã chi" initial={selected.actual.expense} effective={selected.actual.expense} /></div>
        <div className="mt-lg rounded-md bg-canvas-parchment p-md"><p className="font-body text-[13px] text-ink-muted-48">Đối chiếu: phần chưa giao {new Intl.NumberFormat("vi-VN").format(selected.capacity.unassignedRemaining)}₫ + phong bì còn {new Intl.NumberFormat("vi-VN").format(selected.capacity.customRemaining)}₫ = {new Intl.NumberFormat("vi-VN").format(selected.capacity.reconciledRemaining)}₫.</p><p className="mt-xxs font-body text-[13px] font-semibold text-ink">Số dư phong bì đã nằm trong số còn lại toàn kỳ, không cộng thêm.</p></div>
        <details className="mt-lg"><summary className="cursor-pointer font-body text-[14px] text-primary">Sửa tên / ngày / mục tiêu</summary><form key={selected.id} className="mt-md grid gap-sm sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const startDate = String(form.get("startDate")); const endDate = String(form.get("endDate")); if (!selected.isLocked && startDate > endDate) { fail("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu."); return; } const metadata: PeriodMetadataDraft = { label: String(form.get("label")).trim(), objective: String(form.get("objective")).trim() || null, ...(!selected.isLocked ? { startDate, endDate } : {}) }; void result(props.onPatchPeriod(selected.id, metadata)); }}><label className="font-body text-[13px] text-ink-muted-48">Tên<input name="label" required defaultValue={selected.label} className={field} /></label><label className="font-body text-[13px] text-ink-muted-48">Mục tiêu<input name="objective" defaultValue={selected.objective ?? ""} className={field} /></label><label className="font-body text-[13px] text-ink-muted-48">Từ<input name="startDate" type="date" required defaultValue={selected.startDate} disabled={selected.isLocked} className={field} /></label><label className="font-body text-[13px] text-ink-muted-48">Đến<input name="endDate" type="date" required defaultValue={selected.endDate} disabled={selected.isLocked} className={field} /></label><Button type="submit" label="Lưu mô tả" loading={props.submitting} pill /></form></details>
        <details className="mt-lg"><summary className="cursor-pointer font-body text-[14px] text-primary">Điều chỉnh kế hoạch</summary><form className="mt-md grid gap-sm sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const change = Number(delta); const validation = validatePeriodAdjustment(selected.effective, target, change); if (validation) { fail(validation); return; } if (!reason.trim()) { fail("Lý do điều chỉnh là bắt buộc."); return; } void result(props.onAdjustPeriod(selected.id, target, change, reason.trim())); }}><label className="font-body text-[13px] text-ink-muted-48">Chỉ tiêu<select value={target} onChange={(event) => setTarget(event.target.value as Target)} className={field}><option value="planned_income">Thu nhập</option><option value="savings_target">Tiết kiệm</option><option value="spending_limit">Giới hạn chi</option></select></label><label className="font-body text-[13px] text-ink-muted-48">Thay đổi có dấu<input inputMode="numeric" type="number" step="1" required value={delta} onChange={(event) => setDelta(event.target.value)} className={field} /></label><label className="font-body text-[13px] text-ink-muted-48">Lý do<input required value={reason} onChange={(event) => setReason(event.target.value)} className={field} /></label><Button type="submit" label="Ghi điều chỉnh" loading={props.submitting} pill /></form></details>
      </section>

      <section className="rounded-lg border border-hairline bg-canvas p-lg">
        <h2 className="font-display text-[21px] font-semibold text-ink">Phong bì trong kỳ</h2>
        {props.envelopesLoading ? <div className="min-h-28"><Spinner label="Đang tải phong bì…" /></div> : <>
          <form className="mt-md grid gap-sm sm:grid-cols-[1fr_180px_auto]" onSubmit={(event) => { event.preventDefault(); const amount = Number(envelopeAmount); if (!envelopeName.trim()) { fail("Tên phong bì là bắt buộc."); return; } if (!Number.isSafeInteger(amount) || amount <= 0) { fail("Hạn mức phong bì phải là số nguyên dương."); return; } void result(props.onCreateEnvelope(selected.id, envelopeName.trim(), amount)); }}><label className="font-body text-[13px] text-ink-muted-48">Tên<input required value={envelopeName} onChange={(event) => setEnvelopeName(event.target.value)} className={field} /></label><label className="font-body text-[13px] text-ink-muted-48">Hạn mức<input required inputMode="numeric" type="number" min="1" step="1" value={envelopeAmount} onChange={(event) => setEnvelopeAmount(event.target.value)} className={field} /></label><div className="self-end"><Button type="submit" label="Thêm phong bì" loading={props.submitting} pill /></div></form>
          <div className="mt-lg space-y-sm">{props.envelopes.length ? props.envelopes.map((envelope) => <Envelope key={envelope.id} envelope={envelope} submitting={props.submitting} onValidationError={fail} onRename={(name) => result(props.onRenameEnvelope(envelope.id, name))} onAdjust={(change, note) => result(props.onAdjustEnvelope(envelope.id, change, note))} onClose={() => result(props.onCloseEnvelope(envelope.id))} />) : <p className="font-body text-[14px] text-ink-muted-48">Chưa có phong bì. Chi tiêu vẫn được tính đầy đủ ở cấp kỳ.</p>}</div>
        </>}
      </section>
    </> : <section className="rounded-lg border border-hairline bg-canvas p-xl text-center"><h2 className="font-display text-[21px] font-semibold text-ink">Chưa có kỳ ngân sách</h2><p className="mt-xs font-body text-[14px] text-ink-muted-48">Tạo kỳ đầu tiên để tính mức chi an toàn.</p></section>}
    {localError || props.error ? <p role="alert" aria-live="assertive" className="font-body text-[14px] text-danger">{localError ?? props.error}</p> : null}
  </div>;
}

function Metric({ label, initial, effective }: { label: string; initial: number; effective: number }) {
  return <div><p className="font-body text-[12px] text-ink-muted-48">{label}</p><CurrencyDisplay amount={effective} size="md" /><p className="font-body text-[11px] text-ink-muted-48">Gốc {new Intl.NumberFormat("vi-VN").format(initial)}₫</p></div>;
}

function Envelope({ envelope, submitting, onValidationError, onRename, onAdjust, onClose }: { envelope: CustomEnvelopeDto; submitting: boolean; onValidationError: (message: string) => void; onRename: (name: string) => void; onAdjust: (delta: number, note: string) => void; onClose: () => void }) {
  return <details className="rounded-md bg-canvas-parchment p-md"><summary className="flex cursor-pointer list-none items-center justify-between gap-md"><span className="font-body text-[15px] font-semibold text-ink">{envelope.name}{envelope.locked ? " · Đã đóng" : ""}</span><CurrencyDisplay amount={envelope.remaining} size="sm" /></summary><div className="mt-md grid gap-md sm:grid-cols-2"><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name")).trim(); if (!name) { onValidationError("Tên phong bì là bắt buộc."); return; } onRename(name); }}><label className="font-body text-[13px] text-ink-muted-48">Đổi tên<input name="name" required defaultValue={envelope.name} disabled={envelope.locked} className={field} /></label><div className="mt-xs"><Button type="submit" label="Lưu tên" size="sm" disabled={envelope.locked} loading={submitting} /></div></form><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const delta = Number(form.get("delta")); const note = String(form.get("note")).trim(); if (!Number.isSafeInteger(delta) || delta === 0) { onValidationError("Mức điều chỉnh phong bì phải là số nguyên khác 0."); return; } if (envelope.effectiveAmount + delta < 0) { onValidationError("Hạn mức hiệu lực của phong bì không thể âm."); return; } if (!note) { onValidationError("Lý do điều chỉnh phong bì là bắt buộc."); return; } onAdjust(delta, note); }}><div className="grid grid-cols-2 gap-xs"><label className="font-body text-[13px] text-ink-muted-48">Thay đổi<input name="delta" inputMode="numeric" type="number" step="1" required disabled={envelope.locked} className={field} /></label><label className="font-body text-[13px] text-ink-muted-48">Lý do<input name="note" required disabled={envelope.locked} className={field} /></label></div><div className="mt-xs"><Button type="submit" label="Điều chỉnh hạn mức" size="sm" disabled={envelope.locked} loading={submitting} /></div></form></div>{!envelope.locked ? <button type="button" disabled={envelope.remaining !== 0 || submitting} onClick={onClose} className="mt-md min-h-11 border-0 bg-transparent font-body text-[14px] text-primary disabled:text-ink-muted-48">Đóng phong bì{envelope.remaining !== 0 ? " · cần số dư 0" : ""}</button> : null}</details>;
}
