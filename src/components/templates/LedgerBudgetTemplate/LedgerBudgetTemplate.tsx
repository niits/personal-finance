import { Spinner } from "@/components/atoms/Spinner";
import { LedgerBudgetManager } from "@/components/organisms/LedgerBudgetManager";
import type { PeriodDraft, PeriodMetadataDraft } from "@/components/organisms/LedgerBudgetManager";
import type { BudgetPeriodDto, CustomEnvelopeDto } from "@/lib/ledger/contracts";

type Result = Promise<{ error?: string }>;
type Props = {
  periods: BudgetPeriodDto[];
  selectedId: number | null;
  envelopes: CustomEnvelopeDto[];
  loading: boolean;
  envelopesLoading: boolean;
  submitting: boolean;
  error: string | null;
  onSelect: (id: number) => void;
  onCreatePeriod: (draft: PeriodDraft) => Result;
  onPatchPeriod: (id: number, draft: PeriodMetadataDraft) => Result;
  onAdjustPeriod: (id: number, target: "planned_income" | "savings_target" | "spending_limit", delta: number, note: string) => Result;
  onCreateEnvelope: (periodId: number, name: string, amount: number) => Result;
  onRenameEnvelope: (id: string, name: string) => Result;
  onAdjustEnvelope: (id: string, delta: number, note: string) => Result;
  onCloseEnvelope: (id: string) => Result;
};

export function LedgerBudgetTemplate(props: Props) {
  return <main className="min-h-[calc(100svh-116px)] bg-canvas-parchment px-lg py-xl"><div className="mx-auto max-w-5xl"><header className="mb-xl"><p className="font-body text-[14px] text-ink-muted-48">Kế hoạch append-only</p><h1 className="mt-xs font-display text-[34px] font-semibold text-ink">Ngân sách</h1></header>{props.loading ? <Spinner label="Đang tải kế hoạch…" /> : <LedgerBudgetManager {...props} />}</div></main>;
}
