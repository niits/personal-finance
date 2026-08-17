"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/atoms/Spinner";
import { LedgerEntrySheet } from "@/components/organisms/LedgerEntrySheet";
import type { LedgerCategoryOption, LedgerEntryIntent } from "@/components/organisms/LedgerEntrySheet";
import { LedgerEventActionSheet } from "@/components/organisms/LedgerEventActionSheet";
import type { LedgerEventActionIntent } from "@/components/organisms/LedgerEventActionSheet";
import { LedgerOnboarding } from "@/components/organisms/LedgerOnboarding";
import type { LedgerInitializationIntent } from "@/components/organisms/LedgerOnboarding";
import { LedgerDashboardTemplate } from "@/components/templates/LedgerDashboardTemplate";
import type { CustomEnvelopeDto, FinancialEventDto, FinancialEventFeedDto, LedgerProfileResponse, LedgerSummaryDto } from "@/lib/ledger/contracts";
import { flattenLeafCategories, mergeEventPage } from "@/lib/ledger/frontend";
import type { LedgerCategoryNode } from "@/lib/ledger/frontend";
import type { PositionListResponse, PositionSummary } from "@/lib/ledger/positions";

type PendingIntent = { signature: string; key: string };
const today = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
async function errorMessage(response: Response) { const body = await response.json().catch(() => null) as { error?: string } | null; return body?.error ?? "Không thể hoàn tất yêu cầu."; }

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<LedgerProfileResponse | null>(null);
  const [summary, setSummary] = useState<LedgerSummaryDto | null>(null);
  const [events, setEvents] = useState<FinancialEventDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [categories, setCategories] = useState<LedgerCategoryOption[]>([]);
  const [cards, setCards] = useState<PositionSummary[]>([]);
  const [envelopes, setEnvelopes] = useState<CustomEnvelopeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entrySession, setEntrySession] = useState(0);
  const [eventAction, setEventAction] = useState<{ event: FinancialEventDto; mode: "reverse" | "refund" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const initializeIntent = useRef<PendingIntent | null>(null);
  const entryIntent = useRef<PendingIntent | null>(null);
  const eventIntent = useRef<PendingIntent | null>(null);
  const feedGeneration = useRef(0);

  const loadLedger = useCallback(async () => {
    const generation = ++feedGeneration.current;
    setLoading(true); setLoadingMore(false); setError(null);
    try {
      const asOf = today();
      const [summaryResponse, feedResponse, categoriesResponse, positionsResponse] = await Promise.all([
        fetch(`/api/ledger/summary?asOf=${asOf}`), fetch("/api/financial-events?limit=50"), fetch("/api/categories"), fetch("/api/positions"),
      ]);
      if ([summaryResponse, feedResponse, categoriesResponse, positionsResponse].some((response) => response.status === 401)) { router.replace("/sign-in"); return; }
      if (!summaryResponse.ok) throw new Error(await errorMessage(summaryResponse));
      if (!feedResponse.ok) throw new Error(await errorMessage(feedResponse));
      if (!categoriesResponse.ok) throw new Error(await errorMessage(categoriesResponse));
      if (!positionsResponse.ok) throw new Error(await errorMessage(positionsResponse));
      const [summaryData, feedData, categoryData, positionData] = await Promise.all([
        summaryResponse.json() as Promise<LedgerSummaryDto>,
        feedResponse.json() as Promise<FinancialEventFeedDto>,
        categoriesResponse.json() as Promise<{ categories: LedgerCategoryNode[] }>,
        positionsResponse.json() as Promise<PositionListResponse>,
      ]);
      let envelopeData: CustomEnvelopeDto[] = [];
      if (summaryData.activePeriod) {
        const response = await fetch(`/api/budget-periods/${summaryData.activePeriod.id}/custom-budgets`);
        if (response.status === 401) { router.replace("/sign-in"); return; }
        if (!response.ok) throw new Error(await errorMessage(response));
        envelopeData = ((await response.json()) as { customBudgets: CustomEnvelopeDto[] }).customBudgets.filter((item) => !item.locked);
      }
      if (generation !== feedGeneration.current) return;
      setSummary(summaryData); setEvents(feedData.events); setNextCursor(feedData.pagination.nextCursor); setFeedError(null); setCategories(flattenLeafCategories(categoryData.categories));
      setCards(positionData.groups.find((group) => group.code === "creditCards")?.positions.filter((card) => card.status !== "closed") ?? []);
      setEnvelopes(envelopeData);
    } catch (caught) { if (generation === feedGeneration.current) setError(caught instanceof Error ? caught.message : "Không tải được sổ tài chính."); }
    finally { if (generation === feedGeneration.current) setLoading(false); }
  }, [router]);

  async function loadMoreEvents() {
    if (!nextCursor || loadingMore) return;
    const cursor = nextCursor;
    const generation = feedGeneration.current;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const response = await fetch(`/api/financial-events?limit=50&cursor=${encodeURIComponent(cursor)}`);
      if (response.status === 401) { router.replace("/sign-in"); return; }
      if (!response.ok) throw new Error(await errorMessage(response));
      const page = await response.json() as FinancialEventFeedDto;
      if (generation !== feedGeneration.current || cursor !== nextCursor) return;
      setEvents((current) => mergeEventPage(current, page.events));
      setNextCursor(page.pagination.nextCursor);
    } catch (caught) {
      if (generation === feedGeneration.current) setFeedError(caught instanceof Error ? caught.message : "Không tải được sự kiện cũ hơn.");
    } finally {
      if (generation === feedGeneration.current) setLoadingMore(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger/profile").then(async (response) => {
      if (response.status === 401) { router.replace("/sign-in"); return null; }
      if (!response.ok) throw new Error(await errorMessage(response));
      return response.json() as Promise<LedgerProfileResponse>;
    }).then((data) => { if (!cancelled && data) { setProfile(data); if (data.mode === "ledger") void loadLedger(); else setLoading(false); } }).catch((caught: unknown) => { if (!cancelled) { setError(caught instanceof Error ? caught.message : "Không tải được trạng thái sổ."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [loadLedger, router]);

  async function initialize(intent: LedgerInitializationIntent) {
    const signature = JSON.stringify(intent); if (!initializeIntent.current || initializeIntent.current.signature !== signature) initializeIntent.current = { signature, key: crypto.randomUUID() };
    setSubmitting(true); setMutationError(null);
    try { const response = await fetch("/api/ledger/initialize", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": initializeIntent.current.key }, body: signature }); if (!response.ok) throw new Error(await errorMessage(response)); const profileResponse = await fetch("/api/ledger/profile"); if (!profileResponse.ok) throw new Error(await errorMessage(profileResponse)); const confirmedProfile = await profileResponse.json() as LedgerProfileResponse; if (confirmedProfile.mode !== "ledger") throw new Error("Sổ chưa được xác nhận. Hãy thử lại với cùng thông tin."); setProfile(confirmedProfile); initializeIntent.current = null; window.dispatchEvent(new Event("ledger:initialized")); await loadLedger(); }
    catch (caught) { setMutationError(caught instanceof Error ? caught.message : "Không thể khởi tạo sổ."); } finally { setSubmitting(false); }
  }

  async function submitEntry(intent: LedgerEntryIntent) {
    const signature = JSON.stringify(intent); if (!entryIntent.current || entryIntent.current.signature !== signature) entryIntent.current = { signature, key: crypto.randomUUID() };
    setSubmitting(true); setMutationError(null);
    try { const response = await fetch(`/api/financial-events/${intent.type}`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": entryIntent.current.key }, body: JSON.stringify({ amount: intent.amount, categoryId: intent.categoryId, date: intent.date, note: intent.note, ...(intent.type === "expense" ? { positionId: intent.positionId, allocations: intent.allocations } : {}) }) }); if (!response.ok) throw new Error(await errorMessage(response)); entryIntent.current = null; setEntryOpen(false); await loadLedger(); }
    catch (caught) { setMutationError(caught instanceof Error ? caught.message : "Không thể ghi nhận."); } finally { setSubmitting(false); }
  }

  async function mutateEvent(event: FinancialEventDto, intent: LedgerEventActionIntent) {
    const mode = intent.mode;
    const body: Record<string, unknown> = mode === "refund" ? { amount: intent.amount, date: intent.date, note: intent.note } : {};
    const signature = JSON.stringify({ eventId: event.id, mode, body }); if (!eventIntent.current || eventIntent.current.signature !== signature) eventIntent.current = { signature, key: crypto.randomUUID() };
    setSubmitting(true); setMutationError(null);
    try { const response = await fetch(`/api/financial-events/${event.id}/${mode === "reverse" ? "reverse" : "refunds"}`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": eventIntent.current.key }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(await errorMessage(response)); eventIntent.current = null; setEventAction(null); await loadLedger(); }
    catch (caught) { setMutationError(caught instanceof Error ? caught.message : "Không thể cập nhật sự kiện."); } finally { setSubmitting(false); }
  }

  if (!profile && loading) return <main className="min-h-[60svh] bg-canvas-parchment"><Spinner label="Đang mở sổ tài chính…" /></main>;
  if (profile && profile.mode !== "ledger") return <LedgerOnboarding profile={profile} submitting={submitting} error={mutationError} onSubmit={(intent) => void initialize(intent)} />;
  return <><LedgerDashboardTemplate summary={summary} events={events} nextCursor={nextCursor} loading={loading} loadingMore={loadingMore} error={error} feedError={feedError} onOpenEntry={() => { setMutationError(null); setEntrySession((value) => value + 1); setEntryOpen(true); }} onRetry={() => void loadLedger()} onLoadMore={() => void loadMoreEvents()} onRefund={(event) => { setMutationError(null); setEventAction({event,mode:"refund"}); }} onReverse={(event) => { setMutationError(null); setEventAction({event,mode:"reverse"}); }} /><LedgerEntrySheet key={entrySession} open={entryOpen} categories={categories} cards={cards} envelopes={envelopes} submitting={submitting} error={mutationError} onSubmit={(intent) => void submitEntry(intent)} onClose={() => { if (!submitting) setEntryOpen(false); }} /><LedgerEventActionSheet key={eventAction?`${eventAction.event.id}:${eventAction.mode}`:"none"} event={eventAction?.event??null} mode={eventAction?.mode??null} submitting={submitting} error={mutationError} onSubmit={(intent)=>{if(eventAction)void mutateEvent(eventAction.event,intent)}} onClose={()=>{if(!submitting)setEventAction(null)}}/></>;
}
