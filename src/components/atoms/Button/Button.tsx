type ButtonProps = {
  label: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  pill?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
  primary: {
    background: "var(--primary)",
    color: "#fff",
    border: "none",
  },
  secondary: {
    background: "var(--canvas-parchment)",
    color: "var(--ink)",
    border: "none",
  },
  ghost: {
    background: "transparent",
    color: "var(--primary)",
    border: "none",
  },
  destructive: {
    background: "rgba(255,69,58,0.1)",
    color: "#ff453a",
    border: "none",
  },
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, React.CSSProperties> = {
  sm: { padding: "7px 14px", fontSize: 13, borderRadius: 8 },
  md: { padding: "14px 20px", fontSize: 16, borderRadius: 12 },
  lg: { padding: "15px 20px", fontSize: 17, borderRadius: 999 },
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  fullWidth,
  pill,
  onClick,
  type = "button",
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "opacity 0.15s",
        width: fullWidth ? "100%" : undefined,
        borderRadius: pill ? 999 : undefined,
        ...variantStyles[variant],
        ...sizeStyles[size],
      }}
    >
      {loading ? "Đang lưu…" : label}
    </button>
  );
}
