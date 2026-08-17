import Link from "next/link";
import { Button } from "@/components/atoms/Button";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import { Spinner } from "@/components/atoms/Spinner";
import { LedgerEventItem } from "@/components/molecules/LedgerEventItem";
import type { FinancialEventDto, LedgerSummaryDto } from "@/lib/ledger/contracts";

type Props = {
  summary: LedgerSummaryDto | null;
  events: FinancialEventDto[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  feedError: string | null;
  onOpenEntry: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onRefund: (event: FinancialEventDto) => void;
  onReverse: (event: FinancialEventDto) => void;
};

export function LedgerDashboardTemplate({ summary, events, nextCursor, loading, loadingMore, error, feedError, onOpenEntry, onRetry, onLoadMore, onRefund, onReverse }: Props) {
  if (loading) return <main className="min-h-[60svh] bg-canvas-parchment"><Spinner label="Đang đọc sổ tài chính…" /></main>;
  if (error || !summary) return <main className="flex min-h-[60svh] items-center justify-center bg-canvas-parchment p-lg"><div className="text-center"><p className="mb-md font-body text-[15px] text-ink-muted-48">{error ?? "Không có dữ liệu."}</p><Button label="Thử lại" onClick={onRetry} pill /></div></main>;
  const period = summary.activePeriod;

  return <main className="min-h-[calc(100svh-116px)] bg-canvas-parchment pb-section">
    <header className="bg-canvas px-lg py-xl"><div className="mx-auto max-w-5xl"><p className="font-body text-[14px] text-ink-muted-48">Có thể chi an toàn</p><div className="mt-xs"><CurrencyDisplay amount={summary.safeToSpend ?? 0} size="xl" muted={summary.safeToSpend === null} /></div><p className="mt-xs font-body text-[13px] text-ink-muted-48">Sau nghĩa vụ thẻ, mức dự phòng và giới hạn kế hoạch.</p>{period ? <div className="mt-lg"><Button label="Ghi giao dịch" onClick={onOpenEntry} pill /></div> : null}</div></header>
    <div className="mx-auto max-w-5xl space-y-xl px-lg py-xl">
      {period ? <section className="rounded-lg border border-hairline bg-canvas p-lg"><div className="flex justify-between gap-md"><div><p className="font-body text-[13px] text-ink-muted-48">{period.label}</p><h2 className="mt-xxs font-display text-[21px] font-semibold text-ink">Chi tiêu và kế hoạch</h2></div><Link href="/budget" className="font-body text-[14px] text-primary no-underline">Quản lý</Link></div><div className="mt-lg grid grid-cols-2 gap-md sm:grid-cols-4"><Metric label="Đã chi" value={period.actual.expense} /><Metric label="Còn lại kỳ" value={period.actual.remaining} /><Metric label="Tiết kiệm thực tế" value={period.actual.savings} /><Metric label="Khoảng cách mục tiêu" value={period.actual.savingsTargetGap} /></div><p className="mt-md font-body text-[13px] text-ink-muted-48">Còn lại được đối chiếu từ phần chưa giao và số dư phong bì; không cộng phong bì lần thứ hai.</p></section> : <section className="rounded-lg border border-hairline bg-canvas p-lg"><h2 className="font-display text-[21px] font-semibold text-ink">Cần một kế hoạch đang hiệu lực</h2><p className="mt-xs font-body text-[14px] text-ink-muted-48">Tạo kỳ ngân sách để tính mức có thể chi an toàn và bắt đầu ghi giao dịch.</p><Link href="/budget" className="mt-md inline-flex min-h-11 items-center font-body text-[15px] text-primary no-underline">Tạo kỳ ngân sách</Link></section>}
      <section><div className="mb-xs flex items-end justify-between"><div><p className="font-body text-[13px] text-ink-muted-48">Append-only</p><h2 className="font-display text-[21px] font-semibold text-ink">Dòng sự kiện</h2></div><span className="font-body text-[13px] text-ink-muted-48">{events.length}</span></div><ul className="rounded-lg border border-hairline bg-canvas px-md">{events.length ? events.map((event) => <LedgerEventItem key={event.id} event={event} onRefund={onRefund} onReverse={onReverse} />) : <li className="py-xl text-center font-body text-[14px] text-ink-muted-48">Chưa có sự kiện tài chính.</li>}</ul>{feedError ? <p role="alert" aria-live="assertive" className="mt-sm font-body text-[13px] text-danger">{feedError}</p> : null}{nextCursor ? <div className="mt-md flex justify-center"><Button label="Tải sự kiện cũ hơn" loading={loadingMore} disabled={loadingMore} onClick={onLoadMore} variant="secondary" pill /></div> : null}</section>
      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4"><Balance label="Tiền mặt" value={summary.balances.cash} /><Balance label="Vị thế" value={summary.balances.positions} /><Balance label="Nợ thẻ dự phòng" value={summary.balances.reservedCardDebt} /><Balance label="Tài sản ròng" value={summary.balances.netWorth} /></section>
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div><p className="font-body text-[12px] text-ink-muted-48">{label}</p><div className="mt-xxs"><CurrencyDisplay amount={value} size="md" /></div></div>; }
function Balance({ label, value }: { label: string; value: number }) { return <div className="rounded-md bg-canvas p-md"><p className="font-body text-[12px] text-ink-muted-48">{label}</p><div className="mt-xxs"><CurrencyDisplay amount={value} size="md" /></div></div>; }
