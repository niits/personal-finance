type CreditCardToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function CreditCardToggle({ checked, onChange }: CreditCardToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        cursor: "pointer",
        border: checked ? "none" : "1px solid var(--hairline)",
        background: checked ? "var(--ink)" : "var(--canvas-parchment)",
        color: checked ? "#fff" : "var(--ink-muted-48)",
        fontFamily: "var(--font-body)",
        fontSize: 14,
        fontWeight: checked ? 600 : 400,
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
      }}
    >
      {checked && "✓ "}💳 Thẻ tín dụng
    </button>
  );
}
