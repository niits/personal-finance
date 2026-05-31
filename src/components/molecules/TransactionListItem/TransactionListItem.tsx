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
  debtParty?: string | null;
  debtType?: "lend" | "borrow" | null;
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
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(t.id); } } : undefined}
      className={`flex items-center px-4 py-[10px] gap-[10px] min-h-[44px] bg-canvas ${
        showDivider ? "border-t border-hairline" : ""
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <EmojiIcon
        emoji={displayEmoji}
        fallback={fallback}
        colorScheme={t.type}
        size="md"
      />

      <div className="flex-1 min-w-0">
        <p className="font-body text-[15px] text-ink tracking-[-0.374px] truncate leading-[1.3]">
          {t.categoryName}
        </p>
        <p className="font-body text-[12px] text-ink-muted-48 truncate leading-[1.3] min-h-[1em]">
          {t.note ?? ""}
        </p>
        {t.debtParty && (
          <p className="font-body text-[11px] text-ink-muted-48 leading-[1.3] mt-px">
            💸 {t.debtType === "lend" ? "Cho vay" : "Đi vay"} · {t.debtParty}
          </p>
        )}
        {t.customBudgets.length > 0 && (
          <div className="flex gap-1 mt-[3px] items-center">
            {t.customBudgets.slice(0, 2).map((cb) => (
              <span key={cb.id} className="max-w-[90px] overflow-hidden text-ellipsis">
                <Badge label={cb.name} variant="primary" size="sm" />
              </span>
            ))}
            {t.customBudgets.length > 2 && (
              <Badge label={`+${t.customBudgets.length - 2}`} variant="muted" size="sm" />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
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
