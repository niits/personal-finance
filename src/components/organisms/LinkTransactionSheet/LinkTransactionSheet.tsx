"use client";

const fmt = new Intl.NumberFormat("vi-VN").format;

export type EligibleTransaction = {
  id: number;
  amount: number;
  date: string;
  note: string | null;
};

/**
 * Bottom sheet that lists transactions eligible to link to a debt as a repayment
 * (already filtered to the correct type and `debt_id = null` by the caller). It is
 * presentational: the page owns the fetch and the link request.
 */
export function LinkTransactionSheet({
  transactions,
  loading,
  onSelect,
  onClose,
}: {
  transactions: EligibleTransaction[];
  loading: boolean;
  onSelect: (txId: number) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, border: "none", padding: 0, cursor: "pointer", background: "rgba(0,0,0,0.4)", zIndex: 500 }}
      />
      <div className="fixed bottom-0 left-0 right-0 z-[501] bg-canvas rounded-t-2xl px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[70vh] flex flex-col">
        <p style={{ fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>
          Liên kết giao dịch
        </p>

        {loading ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)", textAlign: "center", padding: "24px 0" }}>
            Đang tải…
          </p>
        ) : transactions.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)", textAlign: "center", padding: "24px 0" }}>
            Không có giao dịch phù hợp
          </p>
        ) : (
          <div style={{ overflowY: "auto" }}>
            {transactions.map((tx, i) => (
              <button type="button"
                key={tx.id}
                onClick={() => onSelect(tx.id)}
                className={`w-full flex items-center gap-3 px-1 py-3 bg-transparent cursor-pointer text-left ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tx.note ?? "Giao dịch"}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)" }}>
                    {tx.date.split("-").slice(1).reverse().join("/")}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)", flexShrink: 0 }}>
                  {fmt(tx.amount)}₫
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
