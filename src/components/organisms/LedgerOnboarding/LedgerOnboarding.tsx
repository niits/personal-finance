"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import type { LedgerProfileResponse } from "@/lib/ledger/contracts";
import type { PositionKind } from "@/lib/ledger/types";

export type LedgerInitializationIntent = {
  ledgerStartDate: string;
  openingCash: number;
  minimumCashReserve: number;
  acceptLegacyDataFreshStart?: boolean;
  positions: Array<{ name: string; kind: PositionKind; balance: number; counterparty: string | null; dueDate: string | null; note: string | null }>;
  budget: { label: string; startDate: string; endDate: string; plannedIncome: number; savingsTarget: number; spendingLimit: number; objective: string | null };
};

type OpeningPosition = { name: string; kind: PositionKind; amount: string; counterparty: string; dueDate: string };
type LedgerOnboardingProps = {
  profile: LedgerProfileResponse;
  submitting: boolean;
  error: string | null;
  onSubmit: (intent: LedgerInitializationIntent) => void;
};

const inputClass = "mt-xxs min-h-11 w-full min-w-0 rounded-md border border-hairline bg-canvas px-sm font-body text-[16px] text-ink";
const positionKinds: Array<{ value: PositionKind; label: string }> = [
  { value: "term_deposit", label: "Tiền gửi kỳ hạn" },
  { value: "personal_receivable", label: "Người khác nợ tôi" },
  { value: "credit_card", label: "Thẻ tín dụng" },
  { value: "personal_payable", label: "Tôi đang nợ" },
];

function defaults() {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [year, month] = today.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { today, startDate, endDate, label: `Tháng ${month}/${year}` };
}

export function LedgerOnboarding({ profile, submitting, error, onSubmit }: LedgerOnboardingProps) {
  const [initial] = useState(defaults);
  const [ledgerStartDate, setLedgerStartDate] = useState(initial.today);
  const [openingCash, setOpeningCash] = useState("0");
  const [reserve, setReserve] = useState("0");
  const [positions, setPositions] = useState<OpeningPosition[]>([]);
  const [label, setLabel] = useState(initial.label);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [plannedIncome, setPlannedIncome] = useState("");
  const [savingsTarget, setSavingsTarget] = useState("0");
  const [spendingLimit, setSpendingLimit] = useState("");
  const [objective, setObjective] = useState("");
  const [consent, setConsent] = useState(false);
  const needsConsent = profile.mode === "legacy-data";
  const numeric = [openingCash, reserve, plannedIncome, savingsTarget, spendingLimit].map((value) => Number(value));
  const validAmounts = numeric.every((value) => Number.isSafeInteger(value) && value >= 0);
  const planValid = validAmounts && numeric[3] + numeric[4] <= numeric[2];

  function updatePosition(index: number, patch: Partial<OpeningPosition>) {
    setPositions((current) => current.map((position, positionIndex) => positionIndex === index ? { ...position, ...patch } : position));
  }

  return (
    <main className="min-h-[calc(100svh-116px)] bg-canvas-parchment px-lg py-xl">
      <form className="mx-auto max-w-3xl space-y-xl" onSubmit={(event) => {
        event.preventDefault();
        if (!planValid || (needsConsent && !consent)) return;
        onSubmit({
          ledgerStartDate,
          openingCash: numeric[0],
          minimumCashReserve: numeric[1],
          acceptLegacyDataFreshStart: needsConsent ? true : undefined,
          positions: positions.map((position) => ({
            name: position.name.trim(), kind: position.kind,
            balance: position.kind === "credit_card" || position.kind === "personal_payable" ? -Number(position.amount) : Number(position.amount),
            counterparty: position.counterparty.trim() || null, dueDate: position.dueDate || null, note: null,
          })),
          budget: { label: label.trim(), startDate, endDate, plannedIncome: numeric[2], savingsTarget: numeric[3], spendingLimit: numeric[4], objective: objective.trim() || null },
        });
      }}>
        <header>
          <p className="font-body text-[14px] text-ink-muted-48">Sổ tài chính mới</p>
          <h1 className="mt-xs font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.4px] text-ink">Bắt đầu từ hôm nay, rõ ràng từ đầu.</h1>
          <p className="mt-md max-w-2xl font-body text-[15px] text-ink-muted-48">Thiết lập một số dư tiền mặt tổng hợp, các vị thế đang có và kế hoạch đầu tiên. Các số mở đầu không được tính là thu nhập hay chi phí.</p>
        </header>

        {needsConsent ? (
          <section className="rounded-lg border border-hairline bg-canvas p-lg">
            <h2 className="font-display text-[21px] font-semibold text-ink">Xác nhận bắt đầu mới</h2>
            <p className="mt-xs font-body text-[14px] text-ink-muted-48">Bạn đang có dữ liệu cũ. Hãy tải bản xuất để tự lưu trữ trước; hệ thống không thể xác minh việc tải đã hoàn tất. Dữ liệu cũ vẫn là kho lưu trữ chỉ đọc.</p>
            <a href="/api/account/export" download className="mt-md inline-flex min-h-11 items-center rounded-pill border border-primary px-md font-body text-[15px] text-primary no-underline">Tải bản xuất dữ liệu</a>
            <label className="mt-md flex gap-sm font-body text-[14px] text-ink">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-xxs size-5 accent-primary" />
              <span>Tôi hiểu dữ liệu cũ vẫn được lưu chỉ đọc và sổ mới bắt đầu độc lập, không chuyển đổi lịch sử.</span>
            </label>
          </section>
        ) : null}

        <section className="rounded-lg border border-hairline bg-canvas p-lg">
          <h2 className="font-display text-[21px] font-semibold text-ink">Điểm bắt đầu</h2>
          <div className="mt-md grid gap-md sm:grid-cols-3">
            <label className="font-body text-[13px] text-ink-muted-48">Ngày bắt đầu<input name="ledgerStartDate" type="date" required max={initial.today} value={ledgerStartDate} onChange={(event) => { setLedgerStartDate(event.target.value); if (event.target.value < startDate) setStartDate(event.target.value); }} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Tiền mặt tổng hợp<input name="openingCash" inputMode="numeric" type="number" required min="0" step="1" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Mức dự phòng tối thiểu<input name="reserve" inputMode="numeric" type="number" required min="0" step="1" value={reserve} onChange={(event) => setReserve(event.target.value)} className={inputClass} /></label>
          </div>
        </section>

        <section className="rounded-lg border border-hairline bg-canvas p-lg">
          <div className="flex items-center justify-between gap-md"><div><h2 className="font-display text-[21px] font-semibold text-ink">Vị thế mở đầu</h2><p className="mt-xxs font-body text-[13px] text-ink-muted-48">Nhập số tiền dương; nghĩa vụ sẽ được ghi nhận âm tự động.</p></div><Button label="Thêm" variant="secondary" onClick={() => setPositions((current) => [...current, { name: "", kind: "term_deposit", amount: "", counterparty: "", dueDate: "" }])} pill /></div>
          <div className="mt-md space-y-md">
            {positions.length === 0 ? <p className="font-body text-[14px] text-ink-muted-48">Không bắt buộc. Bạn có thể tạo vị thế sau.</p> : positions.map((position, index) => (
              <fieldset key={index} className="grid gap-sm rounded-md bg-canvas-parchment p-md sm:grid-cols-2">
                <legend className="sr-only">Vị thế {index + 1}</legend>
                <label className="font-body text-[13px] text-ink-muted-48">Loại<select value={position.kind} onChange={(event) => updatePosition(index, { kind: event.target.value as PositionKind })} className={inputClass}>{positionKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
                <label className="font-body text-[13px] text-ink-muted-48">Tên<input required value={position.name} onChange={(event) => updatePosition(index, { name: event.target.value })} className={inputClass} /></label>
                <label className="font-body text-[13px] text-ink-muted-48">Số tiền mở đầu<input inputMode="numeric" type="number" required min="0" step="1" value={position.amount} onChange={(event) => updatePosition(index, { amount: event.target.value })} className={inputClass} /></label>
                <label className="font-body text-[13px] text-ink-muted-48">Đối tác<input value={position.counterparty} onChange={(event) => updatePosition(index, { counterparty: event.target.value })} className={inputClass} /></label>
                <label className="font-body text-[13px] text-ink-muted-48">Ngày đến hạn<input type="date" value={position.dueDate} onChange={(event) => updatePosition(index, { dueDate: event.target.value })} className={inputClass} /></label>
                <button type="button" onClick={() => setPositions((current) => current.filter((_, positionIndex) => positionIndex !== index))} className="min-h-11 self-end border-0 bg-transparent font-body text-[14px] text-primary">Bỏ vị thế</button>
              </fieldset>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-hairline bg-canvas p-lg">
          <h2 className="font-display text-[21px] font-semibold text-ink">Kế hoạch đầu tiên</h2>
          <p className="mt-xxs font-body text-[13px] text-ink-muted-48">Khoảng ngày phải bao phủ ngày bắt đầu sổ.</p>
          <div className="mt-md grid gap-md sm:grid-cols-2">
            <label className="font-body text-[13px] text-ink-muted-48">Tên kỳ<input required value={label} onChange={(event) => setLabel(event.target.value)} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Mục tiêu<input value={objective} onChange={(event) => setObjective(event.target.value)} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Từ ngày<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Đến ngày<input type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Thu nhập dự kiến<input inputMode="numeric" type="number" required min="0" step="1" value={plannedIncome} onChange={(event) => setPlannedIncome(event.target.value)} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Mục tiêu tiết kiệm<input inputMode="numeric" type="number" required min="0" step="1" value={savingsTarget} onChange={(event) => setSavingsTarget(event.target.value)} className={inputClass} /></label>
            <label className="font-body text-[13px] text-ink-muted-48">Giới hạn chi tiêu<input inputMode="numeric" type="number" required min="0" step="1" value={spendingLimit} onChange={(event) => setSpendingLimit(event.target.value)} className={inputClass} /></label>
          </div>
          {!planValid ? <p role="alert" className="mt-sm font-body text-[13px] text-danger">Giới hạn chi tiêu và mục tiêu tiết kiệm không được vượt thu nhập dự kiến.</p> : null}
        </section>
        {error ? <p role="alert" className="rounded-md bg-canvas p-md font-body text-[14px] text-danger">{error}</p> : null}
        <Button type="submit" label="Khởi tạo sổ tài chính" loading={submitting} disabled={!planValid || !label.trim() || (needsConsent && !consent)} fullWidth pill />
      </form>
    </main>
  );
}
