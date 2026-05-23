import { DebtProgressBar } from "@/components/atoms/DebtProgressBar";
import { DebtRepaymentItem } from "@/components/molecules/DebtRepaymentItem";
import type { DebtWithRepayments } from "@/lib/debt";

type DebtPartyCardProps = {
  debt: DebtWithRepayments;
  expanded?: boolean;
  onToggle?: () => void;
  onAddRepayment?: (debtId: string) => void;
};

export function DebtPartyCard({ debt, expanded, onToggle, onAddRepayment }: DebtPartyCardProps) {
  const isLend = debt.type === "lend";
  const isSettled = debt.status === "settled";

  return (
    <div style={{
      background: "var(--canvas-card)",
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 12,
      opacity: isSettled ? 0.6 : 1,
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              {debt.party}
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 2 }}>
              {isLend ? "Cho vay" : "Đi vay"}{debt.note ? ` · ${debt.note}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              fontWeight: 600,
              color: isSettled ? "#30d158" : isLend ? "var(--ink)" : "var(--destructive)",
            }}>
              {isSettled ? "Tất toán" : `${(debt.remaining / 1000).toLocaleString("vi-VN")}k`}
            </div>
            {!isSettled && (
              <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-muted-48)", marginTop: 1 }}>
                còn lại / {(debt.amount / 1000).toLocaleString("vi-VN")}k
              </div>
            )}
          </div>
        </div>
        <DebtProgressBar principal={debt.amount} repaid={debt.repaid} />
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {debt.repayments.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              {debt.repayments.map((r) => (
                <DebtRepaymentItem
                  key={r.id}
                  amount={r.amount}
                  date={r.date}
                  note={r.note}
                  direction={isLend ? "income" : "expense"}
                />
              ))}
            </div>
          )}
          {!isSettled && onAddRepayment && (
            <button
              onClick={() => onAddRepayment(debt.id)}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "9px 0",
                background: "var(--primary-tint)",
                border: "none",
                borderRadius: 10,
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--primary)",
                cursor: "pointer",
              }}
            >
              + Ghi nhận trả nợ
            </button>
          )}
        </div>
      )}
    </div>
  );
}
