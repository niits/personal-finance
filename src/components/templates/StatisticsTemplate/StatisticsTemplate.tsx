"use client";

import { Button } from "@/components/atoms/Button";
import { VegaChart } from "@/components/organisms/VegaChart";
import type { AgentEvent, Insight } from "@/lib/statistics";
import { formatReportTime, generationProgress, safeStatisticsError } from "./presentation";

export type AgentStep = AgentEvent & { id: number };

export type Report = {
  found: true;
  period_key: string;
  insights: Insight[];
  is_dirty: boolean;
  is_current_period: boolean;
  generated_at: number;
};

export type ApiError = {
  status: number;
  error: string;
  code?: string;
  details?: { name?: string; message?: string; stack?: string; value?: string; cause?: unknown };
};

export type StatisticsTemplateProps = {
  selectedMonth: string;
  isAtUpperBound: boolean;
  status: "loading" | "no-report" | "generating" | "ready" | "error";
  report: Report | null;
  agentSteps: AgentStep[];
  refreshing: boolean;
  error: ApiError | null;
  regenError: ApiError | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
  onDismissRegenError: () => void;
};

function toMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)}/${year}`;
}

function MonthHeader({
  selectedMonth,
  isAtUpperBound,
  onPrevMonth,
  onNextMonth,
}: Pick<StatisticsTemplateProps, "selectedMonth" | "isAtUpperBound" | "onPrevMonth" | "onNextMonth">) {
  return (
    <header className="border-b border-divider-soft bg-canvas px-5 pt-7 pb-5">
      <div className="mx-auto flex max-w-[720px] items-center gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Tháng trước"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent font-body text-[24px] text-primary"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="m-0 font-body text-[13px] leading-[18px] text-ink-muted-48">Phân tích chi tiêu</p>
          <p className="mt-1 mb-0 font-display text-[21px] leading-[26px] font-semibold text-ink">
            {toMonthLabel(selectedMonth)}
          </p>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          disabled={isAtUpperBound}
          aria-label="Tháng sau"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent font-body text-[24px] text-primary disabled:cursor-default disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </header>
  );
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return <div className="px-0 py-12 text-center">{children}</div>;
}

function NoReportState({ monthLabel, showCurrent, onGenerate, onNextMonth }: {
  monthLabel: string;
  showCurrent: boolean;
  onGenerate: () => void;
  onNextMonth: () => void;
}) {
  return (
    <CenteredState>
      <h1 className="m-0 font-display text-[21px] leading-[26px] font-semibold text-ink">Chưa có bản phân tích</h1>
      <p className="mx-auto mt-2 mb-6 max-w-[34ch] font-body text-[17px] leading-[25px] text-ink-muted-80">
        Khi bạn sẵn sàng, chúng tôi sẽ xem lại thu chi trong {monthLabel.toLowerCase()} và nêu những điều đáng chú ý.
      </p>
      <div className="mx-auto flex max-w-[320px] flex-col gap-2">
        <Button label="Phân tích tháng này" fullWidth onClick={onGenerate} />
        {showCurrent ? <Button label="Xem tháng hiện tại" variant="ghost" fullWidth onClick={onNextMonth} /> : null}
      </div>
    </CenteredState>
  );
}

function EmptyState({ monthLabel, showCurrent, onNextMonth }: {
  monthLabel: string;
  showCurrent: boolean;
  onNextMonth: () => void;
}) {
  return (
    <CenteredState>
      <h1 className="m-0 font-display text-[21px] leading-[26px] font-semibold text-ink">Chưa có giao dịch để phân tích</h1>
      <p className="mx-auto mt-2 mb-6 max-w-[34ch] font-body text-[17px] leading-[25px] text-ink-muted-80">
        Không có giao dịch nào trong {monthLabel.toLowerCase()}.
      </p>
      {showCurrent ? <Button label="Xem tháng hiện tại" variant="secondary" onClick={onNextMonth} /> : null}
    </CenteredState>
  );
}

function GeneratingState({ steps }: { steps: AgentStep[] }) {
  return (
    <CenteredState>
      <div className="mx-auto mb-5 size-9 animate-spin rounded-full border-[3px] border-hairline border-t-primary motion-reduce:animate-none" aria-hidden="true" />
      <h1 className="m-0 font-display text-[21px] leading-[26px] font-semibold text-ink">Đang phân tích tháng này</h1>
      <p aria-live="polite" className="mt-2 mb-0 font-body text-[17px] leading-[25px] text-ink-muted-80">
        {generationProgress(steps)}
      </p>
    </CenteredState>
  );
}

function ErrorState({ error, onRetry }: { error: ApiError | null; onRetry: () => void }) {
  return (
    <CenteredState>
      <h1 className="m-0 font-display text-[21px] leading-[26px] font-semibold text-ink">Chưa thể tạo bản phân tích</h1>
      <p className="mx-auto mt-2 mb-6 max-w-[36ch] font-body text-[17px] leading-[25px] text-ink-muted-80">
        {safeStatisticsError(error?.status)}
      </p>
      <Button label="Thử lại" onClick={onRetry} />
    </CenteredState>
  );
}

function ReportStatus({ report, refreshing, regenError, onRegenerate, onDismiss }: {
  report: Report;
  refreshing: boolean;
  regenError: ApiError | null;
  onRegenerate: () => void;
  onDismiss: () => void;
}) {
  const changed = report.is_dirty;

  return (
    <div className="mb-6 border-y border-divider-soft py-3">
      {regenError ? (
        <div role="status" className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-body text-[15px] leading-[21px] font-semibold text-ink">Chưa cập nhật được bản phân tích</p>
            <p className="mt-1 mb-0 font-body text-[13px] leading-[18px] text-ink-muted-48">
              Bản hiện tại vẫn ở đây. Bạn có thể thử cập nhật lại.
            </p>
          </div>
          <button type="button" onClick={onDismiss} aria-label="Đóng thông báo" className="flex size-11 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-[20px] text-ink-muted-48">×</button>
        </div>
      ) : (
        <p aria-live="polite" className="m-0 font-body text-[13px] leading-[18px] text-ink-muted-48">
          {refreshing && changed ? "Dữ liệu đã thay đổi. Đang cập nhật bản phân tích…" : null}
          {refreshing && !changed ? "Đang cập nhật bản phân tích. Nội dung cũ vẫn được giữ để bạn đọc…" : null}
          {!refreshing && changed ? "Dữ liệu đã thay đổi. Bản phân tích này cần được cập nhật." : null}
          {!refreshing && !changed ? `Cập nhật ${formatReportTime(report.generated_at)}` : null}
        </p>
      )}
      {!refreshing ? (
        <button type="button" onClick={onRegenerate} className="mt-2 min-h-11 cursor-pointer border-none bg-transparent p-0 font-body text-[15px] font-semibold text-primary">
          {changed || regenError ? "Cập nhật phân tích" : "Phân tích lại"}
        </button>
      ) : null}
    </div>
  );
}

export function StatisticsTemplate({
  selectedMonth,
  isAtUpperBound,
  status,
  report,
  agentSteps,
  refreshing,
  error,
  regenError,
  onPrevMonth,
  onNextMonth,
  onRegenerate,
  onRetry,
  onDismissRegenError,
}: StatisticsTemplateProps) {
  const monthLabel = toMonthLabel(selectedMonth);

  return (
    <div className="min-h-[calc(100svh-44px-72px)] bg-canvas">
      <style>{`.vega-embed { display: block !important; width: 100% !important; }`}</style>
      <MonthHeader
        selectedMonth={selectedMonth}
        isAtUpperBound={isAtUpperBound}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />
      <main className="mx-auto max-w-[720px] px-5 pt-8 pb-12">
        {status === "loading" ? (
          <p role="status" className="py-12 text-center font-body text-[17px] leading-[25px] text-ink-muted-48">Đang tải bản phân tích…</p>
        ) : null}
        {status === "no-report" ? (
          <NoReportState monthLabel={monthLabel} showCurrent={!isAtUpperBound} onGenerate={onRegenerate} onNextMonth={onNextMonth} />
        ) : null}
        {status === "generating" ? <GeneratingState steps={agentSteps} /> : null}
        {status === "error" ? <ErrorState error={error} onRetry={onRetry} /> : null}
        {status === "ready" && report?.insights.length === 0 ? (
          <EmptyState monthLabel={monthLabel} showCurrent={!isAtUpperBound} onNextMonth={onNextMonth} />
        ) : null}
        {status === "ready" && report?.insights.length ? (
          <>
            <ReportStatus
              report={report}
              refreshing={refreshing}
              regenError={regenError}
              onRegenerate={onRegenerate}
              onDismiss={onDismissRegenError}
            />
            <section aria-label={`Nhận xét cho ${monthLabel.toLowerCase()}`}>
              {report.insights.map((insight, index) => (
                <VegaChart key={`${insight.type ?? "insight"}-${insight.title}`} insight={insight} featured={index === 0} />
              ))}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
