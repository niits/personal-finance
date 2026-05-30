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
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 500 }}
      />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 501,
          background: "var(--canvas)", borderRadius: "16px 16px 0 0",
          padding: "20px 20px max(24px, env(safe-area-inset-bottom))",
          maxHeight: "70vh", display: "flex", flexDirection: "column",
        }}
      >
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
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 4px", background: "none", cursor: "pointer", textAlign: "left",
                  border: "none", borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                }}
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
