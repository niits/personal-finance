import { Button } from "@/components/atoms/Button";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import { Spinner } from "@/components/atoms/Spinner";
import { PositionCard } from "@/components/molecules/PositionCard";
import type { PositionListResponse } from "@/lib/ledger/positions";

type PositionsTemplateProps = {
  data: PositionListResponse | null;
  loading: boolean;
  error: string | null;
  historyExpanded: boolean;
  onToggleHistory: () => void;
  onCreatePosition: () => void;
  onRetry: () => void;
};

export function PositionsTemplate({ data, loading, error, historyExpanded, onToggleHistory, onCreatePosition, onRetry }: PositionsTemplateProps) {
  if (loading) return <main className="min-h-[calc(100svh-116px)] bg-canvas-parchment"><Spinner label="Đang tải vị thế…" /></main>;
  if (error || !data) {
    return (
      <main className="flex min-h-[calc(100svh-116px)] items-center justify-center bg-canvas-parchment p-lg">
        <div className="max-w-md text-center">
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.4px] text-ink">Chưa thể tải vị thế</h1>
          <p className="my-md font-body text-[15px] text-ink-muted-48">{error ?? "Dữ liệu không khả dụng."}</p>
          <Button label="Thử lại" onClick={onRetry} pill />
        </div>
      </main>
    );
  }

  const activeCount = data.groups.reduce((sum, group) => sum + group.count, 0);
  const receivable = data.groups.filter((group) => group.code === "owedToMe" || group.code === "termDeposits").reduce((sum, group) => sum + group.normalTotal, 0);
  const payable = data.groups.filter((group) => group.code === "iOwe" || group.code === "creditCards").reduce((sum, group) => sum + group.normalTotal, 0);

  return (
    <main className="min-h-[calc(100svh-116px)] bg-canvas-parchment pb-section">
      <header className="bg-canvas px-lg pb-xl pt-lg">
        <div className="mx-auto max-w-5xl">
          <p className="font-body text-[14px] text-ink-muted-48">Tài sản và nghĩa vụ gốc</p>
          <div className="mt-xs flex items-end justify-between gap-lg">
            <div>
              <h1 className="font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.4px] text-ink">Vị thế</h1>
              <p className="mt-xs font-body text-[15px] text-ink-muted-48">{activeCount} vị thế đang theo dõi</p>
            </div>
            <Button label="Tạo mới" onClick={onCreatePosition} pill />
          </div>
          {activeCount > 0 ? (
            <div className="mt-xl grid grid-cols-2 gap-sm border-t border-hairline pt-lg">
              <div>
                <p className="font-body text-[13px] text-ink-muted-48">Sẽ nhận</p>
                <div className="mt-xxs"><CurrencyDisplay amount={receivable} size="lg" /></div>
              </div>
              <div className="border-l border-hairline pl-lg">
                <p className="font-body text-[13px] text-ink-muted-48">Sẽ trả</p>
                <div className="mt-xxs"><CurrencyDisplay amount={payable} size="lg" /></div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-xl px-lg py-xl">
        {activeCount === 0 ? (
          <section className="rounded-lg border border-hairline bg-canvas p-xl text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-canvas-parchment font-display text-[24px] text-ink" aria-hidden="true">◇</div>
            <h2 className="mt-md font-display text-[21px] font-semibold text-ink">Chưa có vị thế nào</h2>
            <p className="mx-auto mt-xs max-w-sm font-body text-[14px] text-ink-muted-48">Tạo một khoản cho vay, đi vay, tiền gửi hoặc thẻ tín dụng để theo dõi phần gốc.</p>
          </section>
        ) : data.groups.map((group) => group.count > 0 ? (
          <section key={group.code}>
            <div className="mb-xs flex items-end justify-between gap-md">
              <div>
                <h2 className="font-display text-[21px] font-semibold tracking-[-0.2px] text-ink">{group.label}</h2>
                {group.oppositeSignTotal > 0 ? <p className="mt-xxs font-body text-[12px] text-ink-muted-48">Số dư ngược chiều: {new Intl.NumberFormat("vi-VN").format(group.oppositeSignTotal)}₫</p> : null}
              </div>
              <span className="font-body text-[13px] text-ink-muted-48">{group.count}</span>
            </div>
            <div className="grid gap-xs md:grid-cols-2">
              {group.positions.map((position) => <PositionCard key={position.id} position={position} href={`/debts/${position.id}`} />)}
            </div>
          </section>
        ) : null)}

        {data.closedHistory.length > 0 ? (
          <section className="border-t border-hairline pt-lg">
            <button type="button" aria-expanded={historyExpanded} aria-controls="closed-position-history" onClick={onToggleHistory} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent font-body text-[15px] font-semibold text-ink">
              <span>Lịch sử đã tất toán</span><span aria-hidden="true">{historyExpanded ? "−" : "+"}</span>
            </button>
            {historyExpanded ? <div id="closed-position-history" className="mt-xs grid gap-xs md:grid-cols-2">{data.closedHistory.map((position) => <PositionCard key={position.id} position={position} href={`/debts/${position.id}`} />)}</div> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
