import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";

type StatCardProps = {
  title: string;
  value: number;
  unit?: "vnd" | "percent" | "count";
  narrative?: string;
  dark?: boolean;
};

function StatValue({ value, unit, textColor }: { value: number; unit: "vnd" | "percent" | "count"; textColor: string }) {
  if (unit === "vnd") {
    return <CurrencyDisplay amount={value} size="lg" />;
  }
  return (
    <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: textColor }}>
      {unit === "percent" ? `${value.toFixed(1)}%` : value}
    </span>
  );
}

export function StatCard({ title, value, unit = "vnd", narrative, dark = false }: StatCardProps) {
  const bg = dark ? "rgba(255,255,255,0.07)" : "var(--canvas-parchment)";
  const titleColor = dark ? "var(--body-muted)" : "var(--ink-muted-48)";
  const textColor = dark ? "#fff" : "var(--ink)";

  return (
    <div style={{ background: bg, borderRadius: "var(--radius-md)", padding: "var(--space-sm) var(--space-md)" }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: titleColor, marginBottom: "var(--space-xs)" }}>
        {title}
      </p>
      <StatValue value={value} unit={unit} textColor={textColor} />
      {narrative && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: dark ? "var(--body-muted)" : "var(--ink-muted-48)", marginTop: "var(--space-xs)", lineHeight: 1.43, letterSpacing: -0.224 }}>
          {narrative}
        </p>
      )}
    </div>
  );
}
