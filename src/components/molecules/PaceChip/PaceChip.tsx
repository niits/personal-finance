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
    <span style={{
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      background: c.bg,
      color: c.color,
      fontFamily: "var(--font-body)",
      fontSize: 12,
      fontWeight: 600,
    }}>
      {c.label(remainingAmount)}
    </span>
  );
}
