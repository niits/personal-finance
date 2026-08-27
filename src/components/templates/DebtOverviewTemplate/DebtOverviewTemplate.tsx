import { formatVND } from "@/components/atoms/CurrencyDisplay";

export type FinanceAccountOverview = {
  id: string;
  type: "debt" | "savings";
  name: string;
  debt_direction: "lend" | "borrow" | null;
  balance: number;
  transactions: { id: number; amount: number; type: "income" | "expense"; date: string; note: string | null }[];
};

type DebtOverviewTemplateProps = { accounts: FinanceAccountOverview[] };

export function DebtOverviewTemplate({ accounts }: DebtOverviewTemplateProps) {
  const debts = accounts.filter((account) => account.type === "debt");
  const savings = accounts.filter((account) => account.type === "savings");
  return <div className="min-h-dvh bg-canvas-parchment px-5 pt-5 pb-24">
    <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.5px] text-ink">Nợ & Tiết kiệm</h1>
    {([ ["Khoản nợ", debts], ["Tiết kiệm", savings] ] as const).map(([title, rows]) => <section key={title} className="mt-5">
      <h2 className="m-0 font-body text-xs font-semibold uppercase tracking-[0.5px] text-ink-muted-48">{title}</h2>
      {rows.length === 0 ? <p className="font-body text-sm text-ink-muted-48">Chưa có tài khoản.</p> : rows.map((account) => <article key={account.id} className="mt-sm rounded-lg border border-hairline bg-canvas p-md">
        <div className="flex items-center justify-between gap-sm"><div><p className="m-0 font-body text-[17px] font-semibold text-ink">{account.name}</p><p className="mt-1 font-body text-xs text-ink-muted-48">{account.type === "debt" ? account.debt_direction === "lend" ? "Cho vay" : "Đi vay" : "Tiền gửi"}</p></div><p className="m-0 font-display text-lg font-semibold text-ink">{formatVND(Math.abs(account.balance))}₫</p></div>
        <div className="mt-sm border-t border-hairline pt-xs">{account.transactions.length === 0 ? <p className="m-0 font-body text-xs text-ink-muted-48">Chưa có giao dịch.</p> : account.transactions.map((transaction) => <p key={transaction.id} className="mb-1 mt-0 font-body text-xs text-ink-muted-48">{transaction.date} · {transaction.note || "Giao dịch"} · {transaction.type === "expense" ? "−" : "+"}{formatVND(transaction.amount)}₫</p>)}</div>
      </article>)}</section>)}
  </div>;
}
