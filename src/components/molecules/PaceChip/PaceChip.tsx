type PaceStatus = "under" | "over" | "no_budget";

type PaceChipProps = {
  status: PaceStatus;
  remainingAmount?: number;
};

const _fmt = new Intl.NumberFormat("vi-VN");

const config: Record<PaceStatus, { label: (n?: number) => string; color: string; bg: string }> = {
  under: {
    label: (n) => n != null ? `Còn ${_fmt.format(n)}₫` : "Đúng pace",
    color: "#30d158",
    bg: "rgba(48,209,88,0.1)",
  },
  over: {
    label: (n) => n != null ? `Vượt ${_fmt.format(Math.abs(n))}₫` : "Vượt pace",
    color: "#ff453a",
    bg: "rgba(255,69,58,0.1)",
  },
  no_budget: {
    label: () => "Chưa có ngân sách",
    color: "var(--ink-muted-48)",
    bg: "var(--canvas-parchment)",
  },
};

export function PaceChip({ status, remainingAmount }: PaceChipProps) {
  const c = config[status];
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-full font-body text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label(remainingAmount)}
    </span>
  );
}
