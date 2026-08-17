import { Badge } from "@/components/atoms/Badge";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import type { PositionSummary } from "@/lib/ledger/positions";

type PositionCardProps = {
  position: PositionSummary;
  href: string;
};

const statusLabels = {
  open: "Đang mở",
  overdue: "Quá hạn",
  settled: "Số dư 0",
  closed: "Đã tất toán",
} as const;

export function PositionCard({ position, href }: PositionCardProps) {
  const balanceLabel = position.balance > 0
    ? "Sẽ nhận"
    : position.balance < 0
      ? "Sẽ trả"
      : "Không còn số dư";
  return (
    <Link
      href={href}
      className="flex min-h-24 w-full items-center gap-md rounded-lg border border-hairline bg-canvas p-md text-left text-ink no-underline active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas-parchment font-display text-[20px] text-ink" aria-hidden="true">
        {position.kind === "credit_card" ? "▰" : position.kind === "term_deposit" ? "◇" : "↔"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-xs">
          <span className="truncate font-body text-[17px] font-semibold text-ink">{position.name}</span>
          {position.status !== "open" ? (
            <Badge label={statusLabels[position.status]} variant={position.status === "overdue" ? "danger" : "muted"} />
          ) : null}
        </span>
        <span className="mt-xxs block truncate font-body text-[14px] text-ink-muted-48">
          {position.counterparty ?? position.kindLabel}
          {position.dueDate ? ` · ${position.dueDate.split("-").reverse().join("/")}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-body text-[12px] text-ink-muted-48">{balanceLabel}</span>
        <CurrencyDisplay amount={Math.abs(position.balance)} size="md" muted={position.status === "closed"} />
      </span>
    </Link>
  );
}
import Link from "next/link";
