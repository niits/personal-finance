import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import { Spinner } from "@/components/atoms/Spinner";
import { PositionActivityItem } from "@/components/molecules/PositionActivityItem";
import type { PositionAvailableAction, PositionDetailResponse } from "@/lib/ledger/positions";

type PositionDetailTemplateProps = {
  data: PositionDetailResponse | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onSelectAction: (action: PositionAvailableAction) => void;
  onReverseClose: () => void;
};

export function PositionDetailTemplate({ data, loading, error, onBack, onRetry, onSelectAction, onReverseClose }: PositionDetailTemplateProps) {
  if (loading) return <main className="min-h-[calc(100svh-116px)] bg-canvas-parchment"><Spinner label="Đang tải chi tiết…" /></main>;
  if (error || !data) {
    return <main className="flex min-h-[calc(100svh-116px)] items-center justify-center bg-canvas-parchment p-lg"><div className="text-center"><p className="mb-md font-body text-[15px] text-ink-muted-48">{error ?? "Không tìm thấy vị thế."}</p><Button label="Thử lại" onClick={onRetry} pill /></div></main>;
  }
  const { position } = data;
  const balanceLabel = position.balance > 0 ? "Sẽ nhận" : position.balance < 0 ? "Sẽ trả" : "Số dư hiện tại";

  return (
    <main className="min-h-[calc(100svh-116px)] bg-canvas-parchment pb-section">
      <header className="bg-canvas px-lg pb-xl pt-md">
        <div className="mx-auto max-w-3xl">
          <button type="button" onClick={onBack} className="mb-lg min-h-11 border-0 bg-transparent font-body text-[17px] text-primary">← Vị thế</button>
          <div className="flex items-start justify-between gap-md">
            <div className="min-w-0">
              <div className="flex items-center gap-xs">
                <p className="font-body text-[14px] text-ink-muted-48">{position.kindLabel}</p>
                {position.status === "closed" ? <Badge label="Đã tất toán" variant="muted" /> : position.status === "overdue" ? <Badge label="Quá hạn" variant="danger" /> : null}
              </div>
              <h1 className="mt-xs font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.4px] text-ink">{position.name}</h1>
              {position.counterparty ? <p className="mt-xs font-body text-[15px] text-ink-muted-48">{position.counterparty}</p> : null}
            </div>
          </div>
          <div className="mt-xl border-t border-hairline pt-lg text-center">
            <p className="font-body text-[13px] text-ink-muted-48">{balanceLabel}</p>
            <div className="mt-xs"><CurrencyDisplay amount={Math.abs(position.balance)} size="xl" muted={position.status === "closed"} /></div>
            {position.dueDate ? <p className="mt-sm font-body text-[13px] text-ink-muted-48">Đến hạn {position.dueDate.split("-").reverse().join("/")}</p> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-xl px-lg py-xl">
        {data.actions.length > 0 ? (
          <section>
            <h2 className="mb-xs font-body text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-muted-48">Thao tác</h2>
            <div className="flex snap-x gap-xs overflow-x-auto pb-xxs">
              {data.actions.map((action) => <button key={action.code} type="button" onClick={() => onSelectAction(action)} className={`min-h-11 shrink-0 snap-start rounded-pill border px-md font-body text-[15px] ${action.code === "close" ? "border-primary bg-primary text-on-primary" : "border-hairline bg-canvas text-primary"}`}>{action.label}</button>)}
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-hairline bg-canvas p-md"><p className="font-body text-[14px] text-ink-muted-48">Vị thế này đã đóng. Lịch sử bên dưới được giữ nguyên để đối chiếu.</p>{data.closure ? <button type="button" onClick={onReverseClose} className="mt-sm min-h-11 border-0 bg-transparent font-body text-[14px] text-primary">Điều chỉnh lần tất toán</button> : null}</section>
        )}

        {position.note ? <section><h2 className="mb-xs font-body text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-muted-48">Ghi chú</h2><p className="rounded-lg bg-canvas p-md font-body text-[15px] text-ink">{position.note}</p></section> : null}

        <section>
          <div className="mb-xs flex items-end justify-between">
            <h2 className="font-display text-[21px] font-semibold text-ink">Dòng sự kiện</h2>
            <span className="font-body text-[13px] text-ink-muted-48">{data.activities.length}</span>
          </div>
          <ul className="rounded-lg border border-hairline bg-canvas px-md">
            {data.activities.length > 0 ? data.activities.map((activity) => <PositionActivityItem key={activity.id} activity={activity} />) : <li className="py-xl text-center font-body text-[14px] text-ink-muted-48">Chưa có sự kiện tài chính.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
