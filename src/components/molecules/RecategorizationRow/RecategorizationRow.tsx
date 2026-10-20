type RecategorizationRowProps = {
  transactionId: number;
  note: string;
  currentCategory: string;
  suggestedCategory: string;
  isNewCategory?: boolean;
  reason: string;
  checked: boolean;
  onChange: (transactionId: number, checked: boolean) => void;
};

export function RecategorizationRow({ transactionId, note, currentCategory, suggestedCategory, isNewCategory, reason, checked, onChange }: RecategorizationRowProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 px-4 py-3 font-body">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(transactionId, event.target.checked)} className="mt-1 shrink-0 accent-primary" />
      <div className="min-w-0 flex-1 break-words">
        <p className="text-base text-ink">{note}</p>
        <p className="mt-1 text-sm text-ink-muted-80">
          {currentCategory} → <span className={isNewCategory ? "font-semibold text-primary" : "text-ink"}>{isNewCategory ? "Danh mục mới: " : ""}{suggestedCategory}</span>
        </p>
        <p className="mt-1 text-sm text-ink-muted-48">{reason}</p>
      </div>
    </label>
  );
}
