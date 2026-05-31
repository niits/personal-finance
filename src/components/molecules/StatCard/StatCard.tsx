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
  const titleColor = dark ? "rgba(255,255,255,0.4)" : "var(--ink-muted-48)";
  const textColor = dark ? "#fff" : "var(--ink)";

  return (
    <div style={{ background: bg, borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: titleColor, marginBottom: 6 }}>
        {title}
      </p>
      <StatValue value={value} unit={unit} textColor={textColor} />
      {narrative && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: dark ? "rgba(255,255,255,0.5)" : "var(--ink-muted-48)", marginTop: 6, lineHeight: 1.5 }}>
          {narrative}
        </p>
      )}
    </div>
  );
}
