import { EmojiIcon } from "@/components/atoms/EmojiIcon";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import { Badge } from "@/components/atoms/Badge";

export type TransactionItemData = {
  id: number;
  amount: number;
  type: "expense" | "income";
  emoji: string | null;
  categoryName: string;
  categoryEmoji: string | null;
  note: string | null;
  customBudgets: { id: number; name: string }[];
};

type TransactionListItemProps = {
  transaction: TransactionItemData;
  showDivider?: boolean;
  onClick?: (id: number) => void;
};

export function TransactionListItem({ transaction: t, showDivider, onClick }: TransactionListItemProps) {
  const displayEmoji = t.emoji ?? t.categoryEmoji;
  const fallback = t.categoryName.charAt(0).toUpperCase();

  return (
    <div
      onClick={() => onClick?.(t.id)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 16px",
        borderTop: showDivider ? "1px solid var(--hairline)" : "none",
        cursor: onClick ? "pointer" : "default",
        minHeight: 44,
        gap: 10,
        background: "var(--canvas)",
      }}
    >
      <EmojiIcon
        emoji={displayEmoji}
        fallback={fallback}
        colorScheme={t.type}
        size="md"
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
          {t.categoryName}
        </p>
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--ink-muted-48)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.3,
          minHeight: "1em",
        }}>
          {t.note ?? ""}
        </p>
        {t.customBudgets.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 3, alignItems: "center" }}>
            {t.customBudgets.slice(0, 2).map((cb) => (
              <span key={cb.id} style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                <Badge label={cb.name} variant="primary" size="sm" />
              </span>
            ))}
            {t.customBudgets.length > 2 && (
              <Badge label={`+${t.customBudgets.length - 2}`} variant="muted" size="sm" />
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <CurrencyDisplay
          amount={t.amount}
          signed
          signType={t.type}
          size="md"
        />
      </div>
    </div>
  );
}
