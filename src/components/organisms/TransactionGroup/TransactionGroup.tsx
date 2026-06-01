import { TransactionListItem, type TransactionItemData } from "@/components/molecules/TransactionListItem";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatDateHeader(s: string): string {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (s === todayStr) return "Hôm nay";
  if (s === yest.toISOString().substring(0, 10)) return "Hôm qua";
  const d = new Date(s + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}

type TransactionGroupProps = {
  date: string;
  transactions: TransactionItemData[];
  onTransactionClick?: (id: number) => void;
};

export function TransactionGroup({ date, transactions, onTransactionClick }: TransactionGroupProps) {
  const netAmount = transactions.reduce(
    (sum, t) => sum + (t.type === "expense" ? -t.amount : t.amount),
    0,
  );

  return (
    <div>
      <div style={{ padding: "12px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.224 }}>
          {formatDateHeader(date)}
        </span>
        <CurrencyDisplay amount={Math.abs(netAmount)} size="sm" muted />
      </div>
      <div style={{ background: "var(--canvas)" }}>
        {transactions.map((txn, i) => (
          <TransactionListItem
            key={txn.id}
            transaction={txn}
            showDivider={i > 0}
            onClick={onTransactionClick}
          />
        ))}
      </div>
    </div>
  );
}
