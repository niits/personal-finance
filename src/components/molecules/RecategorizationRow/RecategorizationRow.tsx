type RecategorizationRowProps = {
  transactionId: number;
  note: string;
  currentCategory: string;
  suggestedCategory: string;
  isNewCategory?: boolean;
  reason: string;
  checked: boolean;
  onChange: (transactionId: number, checked: boolean) => void;
};

export function RecategorizationRow({
  transactionId,
  note,
  currentCategory,
  suggestedCategory,
  isNewCategory,
  reason,
  checked,
  onChange,
}: RecategorizationRowProps) {
  return (
    <label style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "10px 16px",
      cursor: "pointer",
      minHeight: 44,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(transactionId, e.target.checked)}
        style={{ marginTop: 2, accentColor: "var(--primary)", flexShrink: 0, width: 16, height: 16 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 15,
          color: "var(--ink)",
          letterSpacing: -0.374,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}>
          {note}
        </p>

        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--ink-muted-48)",
          lineHeight: 1.4,
          marginTop: 2,
        }}>
          <span style={{ color: "var(--ink)" }}>{currentCategory}</span>
          {" → "}
          <span style={{ color: isNewCategory ? "var(--primary)" : "var(--ink)", fontWeight: isNewCategory ? 600 : 400 }}>
            {isNewCategory ? "✦ " : ""}{suggestedCategory}
          </span>
        </p>

        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--ink-muted-48)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginTop: 1,
        }}>
          {reason}
        </p>
      </div>
    </label>
  );
}
