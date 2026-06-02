type MonthStepperProps = {
  month: string;
  isLatest: boolean;
  onPrev: () => void;
  onNext: () => void;
  dark?: boolean;
};

function toMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `Tháng ${parseInt(mo)}/${y}`;
}

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 18,
  padding: "0 6px",
  lineHeight: 1,
  flexShrink: 0,
};

export function MonthStepper({ month, isLatest, onPrev, onNext, dark = false }: MonthStepperProps) {
  const textColor = dark ? "var(--body-muted)" : "var(--ink-muted-48)";
  const chevronDisabledColor = dark ? "transparent" : "transparent";
  const chevronColor = dark ? "var(--body-muted)" : "var(--ink-muted-48)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <button type="button"
        style={{ ...btnStyle, cursor: "pointer", color: chevronColor }}
        onClick={onPrev}
      >
        ‹
      </button>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: textColor, letterSpacing: -0.12 }}>
        {toMonthLabel(month)}
      </span>
      <button type="button"
        style={{ ...btnStyle, cursor: isLatest ? "default" : "pointer", color: isLatest ? chevronDisabledColor : chevronColor }}
        onClick={() => !isLatest && onNext()}
        disabled={isLatest}
      >
        ›
      </button>
    </div>
  );
}
