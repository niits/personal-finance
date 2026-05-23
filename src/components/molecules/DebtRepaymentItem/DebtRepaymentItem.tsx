import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";

type DebtRepaymentItemProps = {
  amount: number;
  date: string;
  note: string | null;
  direction: "income" | "expense";
};

export function DebtRepaymentItem({ amount, date, note, direction }: DebtRepaymentItemProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      borderBottom: "1px solid var(--hairline)",
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
          {note ?? (direction === "income" ? "Trả nợ nhận được" : "Trả nợ")}
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 1 }}>
          {date}
        </div>
      </div>
      <CurrencyDisplay amount={amount} signed signType={direction} size="sm" />
    </div>
  );
}
