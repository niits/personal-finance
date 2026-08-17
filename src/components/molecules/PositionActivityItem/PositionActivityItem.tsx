import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import type { PositionActivity } from "@/lib/ledger/positions";

type PositionActivityItemProps = { activity: PositionActivity };

export function PositionActivityItem({ activity }: PositionActivityItemProps) {
  if (activity.type === "lifecycle") {
    return (
      <li className="grid grid-cols-[32px_minmax(0,1fr)] gap-sm border-b border-hairline py-md last:border-b-0">
        <span className="mt-xxs flex size-8 items-center justify-center rounded-full bg-canvas-parchment font-body text-[14px] text-ink" aria-hidden="true">
          {activity.code === "positionClosed" ? "✓" : "↶"}
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[15px] font-semibold text-ink">{activity.label}</span>
          <span className="block font-body text-[13px] text-ink-muted-48">
            {activity.date.split("-").reverse().join("/")} · Vòng đời vị thế
          </span>
        </span>
      </li>
    );
  }
  const detail = activity.category
    ? `${activity.category.emoji ?? "•"} ${activity.category.name}`
    : activity.note;
  return (
    <li className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-sm border-b border-hairline py-md last:border-b-0">
      <span className={`mt-xxs flex size-8 items-center justify-center rounded-full font-body text-[14px] ${activity.isCloseSettlement ? "bg-primary text-on-primary" : "bg-canvas-parchment text-ink"}`} aria-hidden="true">
        {activity.isCloseSettlement ? "✓" : activity.positionChange > 0 ? "+" : "−"}
      </span>
      <span className="min-w-0">
        <span className="block font-body text-[15px] font-semibold text-ink">{activity.label}</span>
        <span className="block font-body text-[13px] text-ink-muted-48">
          {activity.date.split("-").reverse().join("/")}{detail ? ` · ${detail}` : ""}
        </span>
        {activity.allocations.length > 0 ? (
          <span className="mt-xxs block truncate font-body text-[12px] text-ink-muted-48">
            {activity.allocations.map((allocation) => allocation.name).join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="pt-xxs text-right">
        <CurrencyDisplay amount={activity.amount} size="sm" muted={activity.reversal.reversedByActivityId !== null} />
        {activity.cashChange !== 0 ? (
          <span className="block font-body text-[12px] text-ink-muted-48">
            Tiền mặt {activity.cashChange > 0 ? "+" : "−"}
          </span>
        ) : null}
      </span>
    </li>
  );
}
