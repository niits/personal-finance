import type { AgentEvent } from "@/lib/statistics-report";

export type AnalysisProgressProps = { events: AgentEvent[]; failed?: boolean };

export function AnalysisProgress({ events, failed = false }: AnalysisProgressProps) {
  const steps = new Map<string, Extract<AgentEvent, { type: "step" }>>();
  for (const event of events) if (event.type === "step") steps.set(event.key, event);
  if (steps.size === 0) return null;
  return (
    <div className="my-lg border-y border-divider-soft py-sm text-left" aria-label="Tiến độ phân tích">
      <ol className="m-0 grid list-none gap-sm p-0 font-body text-[13px] leading-[18px]">
        {[...steps.values()].map(step => {
          const complete = step.status === "completed";
          const state = complete ? "Đã hoàn tất" : failed ? "Chưa hoàn tất" : "Đang xử lý";
          return (
            <li key={step.key} className="analysis-reveal flex items-start gap-sm">
              <span aria-hidden="true" className={`mt-xxs size-2 shrink-0 rounded-full ${complete ? "bg-ink-muted-48" : failed ? "bg-warning" : "bg-primary motion-safe:animate-pulse"}`} />
              <span className={`min-w-0 flex-1 ${complete ? "text-ink-muted-48" : "text-ink"}`}>{step.label}</span>
              <span className="shrink-0 text-ink-muted-48">{state}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
