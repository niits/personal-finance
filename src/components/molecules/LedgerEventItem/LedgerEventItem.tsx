import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import type { FinancialEventDto } from "@/lib/ledger/contracts";
type LedgerEventItemProps = { event: FinancialEventDto; onRefund: (event: FinancialEventDto) => void; onReverse: (event: FinancialEventDto) => void };
export function LedgerEventItem({ event, onRefund, onReverse }: LedgerEventItemProps) {
  const operating = event.activity.type === "income" || event.activity.type === "expense" || event.activity.type === "refund";
  const direction = event.activity.type === "income" || event.activity.type === "refund" ? "income" : "expense";
  const canRefund = event.activity.actions.canRefund && (event.remainingRefundableAmount ?? 0) > 0;
  return <li className="border-b border-hairline py-md last:border-b-0">
    <div className="flex items-start gap-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas-parchment font-body text-[16px] text-ink" aria-hidden="true">{event.category?.emoji ?? (event.activity.type === "transfer" ? "↔" : event.activity.type === "correction" ? "↶" : "•")}</span>
      <div className="min-w-0 flex-1"><p className="font-body text-[15px] font-semibold text-ink">{event.activity.label}</p><p className="truncate font-body text-[13px] text-ink-muted-48">{event.category?.path ?? event.position?.name ?? event.note ?? event.kind} · {event.date.split("-").reverse().join("/")}</p>{event.allocations.length ? <p className="mt-xxs font-body text-[12px] text-ink-muted-48">Phong bì: {event.allocations.map((item) => item.name).join(", ")}</p> : null}</div>
      <div className="shrink-0 text-right"><CurrencyDisplay amount={event.amount} size="sm" signed={operating} signType={direction} /><p className="font-body text-[11px] text-ink-muted-48">{operating ? (event.activity.type === "expense" ? "Chi tiêu" : event.activity.type === "income" ? "Thu nhập" : "Hoàn tiền") : "Không tính thu/chi"}</p></div>
    </div>
    {canRefund || event.activity.actions.canReverse ? <div className="mt-xs flex justify-end gap-xs">{canRefund ? <button type="button" onClick={() => onRefund(event)} className="min-h-9 border-0 bg-transparent px-xs font-body text-[13px] text-primary">Hoàn tiền · còn {new Intl.NumberFormat("vi-VN").format(event.remainingRefundableAmount ?? 0)}₫</button> : null}{event.activity.actions.canReverse ? <button type="button" onClick={() => onReverse(event)} className="min-h-9 border-0 bg-transparent px-xs font-body text-[13px] text-primary">Đảo bút toán</button> : null}</div> : null}
  </li>;
}
