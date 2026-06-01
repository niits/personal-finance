type BadgeProps = {
  label: string;
  variant?: "default" | "primary" | "success" | "danger" | "muted";
  size?: "sm" | "md";
};

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, React.CSSProperties> = {
  default: { background: "var(--canvas-parchment)", color: "var(--ink-muted-48)" },
  primary: { background: "rgba(0,102,204,0.08)", color: "var(--primary)" },
  success: { background: "rgba(52,199,89,0.1)", color: "var(--success)" },
  danger: { background: "rgba(255,59,48,0.1)", color: "var(--danger)" },
  muted: { background: "var(--surface-chip-translucent)", color: "var(--ink-muted-48)" },
};

const sizeStyles: Record<NonNullable<BadgeProps["size"]>, React.CSSProperties> = {
  sm: { fontSize: 12, padding: "2px 7px" },
  md: { fontSize: 14, padding: "4px 10px" },
};

export function Badge({ label, variant = "default", size = "sm" }: BadgeProps) {
  return (
    <span style={{
      fontFamily: "var(--font-body)",
      fontWeight: 600,
      borderRadius: 999,
      whiteSpace: "nowrap",
      display: "inline-block",
      ...variantStyles[variant],
      ...sizeStyles[size],
    }}>
      {label}
    </span>
  );
}
