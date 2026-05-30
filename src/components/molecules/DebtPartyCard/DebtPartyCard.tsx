import { DebtProgressBar } from "@/components/atoms/DebtProgressBar";
import { formatVND } from "@/components/atoms/CurrencyDisplay";
import type { DebtWithRepayments } from "@/lib/debt";

type DebtPartyCardProps = {
  debt: DebtWithRepayments;
  onTap?: (id: string) => void;
};

export function DebtPartyCard({ debt, onTap }: DebtPartyCardProps) {
  const isLend = debt.type === "lend";
  const isSettled = debt.status === "settled";

  return (
    <button type="button"
      onClick={() => onTap?.(debt.id)}
      style={{
        width: "100%",
        background: "var(--canvas)",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 10,
        border: "none",
        cursor: onTap ? "pointer" : "default",
        textAlign: "left",
        opacity: isSettled ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {debt.party}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
              {isLend ? "Cho vay" : "Đi vay"}{debt.note ? ` · ${debt.note}` : ""}
            </span>
            {debt.is_overdue && (
              <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, color: "var(--destructive)" }}>
                ⚠ Quá hạn
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {isSettled ? (
            <div style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "#30d158" }}>Tất toán ✓</div>
          ) : (
            <>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                {formatVND(debt.remaining)}₫
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-muted-48)", marginTop: 1 }}>
                còn lại / {formatVND(debt.opening_amount)}₫
              </div>
            </>
          )}
        </div>
      </div>

      {!isSettled && (
        <DebtProgressBar
          openingAmount={debt.opening_amount}
          totalRepaid={debt.total_repaid}
          variant={isLend ? "lend" : "borrow"}
        />
      )}

      {debt.due_date && !isSettled && !debt.is_overdue && (
        <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 8 }}>
          Hạn: {debt.due_date.split("-").reverse().join("/")}
        </div>
      )}
    </button>
  );
}
