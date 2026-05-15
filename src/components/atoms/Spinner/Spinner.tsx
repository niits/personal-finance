type SpinnerProps = {
  label?: string;
  size?: "sm" | "md";
};

export function Spinner({ label = "Đang tải…", size = "md" }: SpinnerProps) {
  return (
    <div style={{
      textAlign: "center",
      padding: size === "md" ? "48px 22px" : "16px",
      color: "var(--ink-muted-48)",
      fontFamily: "var(--font-body)",
      fontSize: size === "md" ? 14 : 13,
    }}>
      {label}
    </div>
  );
}
