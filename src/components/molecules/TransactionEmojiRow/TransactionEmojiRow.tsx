type TransactionEmojiRowProps = {
  transactionId: number;
  note: string;
  currentEmoji: string | null;
  suggestedEmoji: string;
  reason: string;
  checked: boolean;
  onChange: (transactionId: number, checked: boolean) => void;
};

export function TransactionEmojiRow({
  transactionId,
  note,
  currentEmoji,
  suggestedEmoji,
  reason,
  checked,
  onChange,
}: TransactionEmojiRowProps) {
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
        <p className="font-body text-[15px] text-ink tracking-[-0.374px] truncate leading-[1.3]">
          {note}
        </p>

        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--ink-muted-48)",
          lineHeight: 1.4,
          marginTop: 2,
        }}>
          <span>{currentEmoji ? `${currentEmoji}️` : "—"}</span>
          {" → "}
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{suggestedEmoji}️</span>
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
