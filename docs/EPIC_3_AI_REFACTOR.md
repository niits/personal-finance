# Epic 3: AI Refactor

> **As-built note (kept for history).** This is the original Epic 3 plan. The final implementation diverged from the model choices below: **all** AI now runs on OpenAI via the Cloudflare AI Gateway (`@ai-sdk/openai-compatible`) — **no Workers AI / Llama is used anywhere**. The statistics agent uses `gpt-4o`; the structured short-context tasks (organize, suggest categories, fill-emoji, recategorize) use `gpt-4.1-nano`. See `src/lib/llm.ts` and CLAUDE.md → Project for the current state. The "Model Configuration" table below reflects the plan, not the shipped result.

## Problem

Current AI implementation has three pain points:

1. **Per-transaction suggest button is low-value.** User must tap each transaction individually — one AI call per item. There is no batch capability and no discoverability for users who don't know the button exists.

2. **Category AI is on the wrong screen.** Suggest categories, fill emoji, and recategorize transactions are all buried in the Categories screen, even though their primary output is changes to the transaction list. Users who want to "organize their spending" have to navigate away from transactions to trigger AI.

3. **Statistics agent is unreliable.** Llama 4 Scout frequently ignores tool-calling instructions and responds in free text. The `generateObject` fallback fires more often than the intended agent path. Switching to a model with reliable structured output and tool-calling eliminates the need for a fallback code path.

## Solution

### Part 1 — Remove per-transaction AI

Strip the per-transaction suggest button from `TransactionListItem`, `TransactionGroup`, and `DashboardTemplate`. Delete the `/api/transactions/[id]/suggest` endpoint. No replacement for this specific interaction — it is superseded by Part 2.

### Part 2 — AI Organize button on transactions screen

Add a single "Tổ chức ✦" button above the transaction list on the home screen. One tap triggers a single backend call that analyzes all transactions and returns a combined preview:

- New categories to create (with parent and example notes)
- Emoji to assign to categories currently missing one
- Transactions to recategorize (with current → suggested category and reason)

The user reviews the preview in a bottom sheet and confirms once. Everything is applied in a single `apply` call.

**Flow:**

```
Tap "Tổ chức ✦"
  → POST /api/ai/organize         — analyze, return preview (no DB writes)
  → Review sheet                  — user selects/deselects items
  → Tap "Áp dụng"
  → POST /api/ai/organize/apply   — write all selected changes
  → Reload transaction list + categories
```

**Why one LLM call for everything:** The three tasks (new categories, emoji, recategorize) share the same input data (current categories + transaction notes). Running them in one call is cheaper, faster, and avoids the multi-step state machine (`ai_suggestion_run` pending → available → done) that the current flow requires.

### Part 3 — Statistics agent: gpt-4o-mini via Cloudflare AI Gateway

Replace Llama 4 Scout with `gpt-4o-mini` routed through Cloudflare AI Gateway with Unified Billing. No separate OpenAI API key — auth is a Cloudflare API token, billing goes through the Cloudflare account.

Remove the `generateObject` fallback in `statistics.ts` — it is only there to compensate for Llama's unreliable tool-calling. `gpt-4o-mini` calls tools reliably, so the fallback becomes dead code.

## API Changes

### New endpoints

#### `POST /api/ai/organize`

Analyzes all user data and returns a combined preview. **No writes to DB.**

Request: no body (reads user's categories + transactions from DB).

Response:
```typescript
{
  new_categories: {
    temp_id: string;          // e.g. "new:0" — used to reference in recategorizations
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    parent_category_name: string | null;
    example_notes: string[];  // up to 3 real transaction notes
  }[];
  emoji_assignments: {
    category_id: number;
    category_name: string;
    emoji: string;
  }[];
  recategorizations: {
    transaction_id: number;
    note: string;
    current_category_id: number;
    current_category_name: string;
    suggested_category_id: number | string;  // string = temp_id from new_categories
    suggested_category_name: string;
    reason: string;
  }[];
}
```

#### `POST /api/ai/organize/apply`

Applies user-selected changes from the preview. All writes happen in this call.

Request:
```typescript
{
  new_categories: {
    temp_id: string;
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    emoji: string | null;
  }[];
  emoji_assignments: {
    category_id: number;
    emoji: string;
  }[];
  recategorizations: {
    transaction_id: number;
    category_id: number | string;  // string = temp_id, resolved after category creation
  }[];
}
```

Apply order:
1. Insert `new_categories` → collect `{ temp_id, real_id }` map
2. Update emoji on `emoji_assignments`
3. Resolve temp_ids in `recategorizations` → update `transaction.category_id`

Response: `{ created_categories: number, emoji_updated: number, transactions_moved: number }`

### Removed endpoints

| Endpoint | Reason |
|----------|--------|
| `DELETE /api/transactions/[id]/suggest` | Replaced by `/api/ai/organize` batch flow |

### Retained but no longer user-facing

The following routes are kept because `/api/ai/organize` delegates to their logic internally, but they are no longer called directly from the UI:

- `POST /api/categories/suggest`
- `POST /api/categories/fill-emoji`
- `POST /api/transactions/recategorize`
- `PATCH /api/ai-suggestion-runs/:id`

## Model Configuration

| Component | Before | After (planned) | As shipped |
|-----------|--------|-----------------|------------|
| Statistics agent | Llama 4 Scout (Workers AI) | gpt-4o-mini (Cloudflare AI Gateway) | **`gpt-4o`** via Cloudflare AI Gateway |
| Organize / category AI | Llama 4 Scout (Workers AI) | Llama 4 Scout (Workers AI) — unchanged | **`gpt-4.1-nano`** via Cloudflare AI Gateway |
| Max output tokens (statistics) | 16,000 | 4,096 | 4,096 |
| Fallback path in statistics.ts | Yes (generateObject) | Removed | Removed |

**Why everything moved to the AI Gateway (as shipped):** rather than keeping Workers AI for the organize endpoint, all AI was consolidated onto OpenAI models behind the Cloudflare AI Gateway (`createOpenAICompatible`, auth via `CF_AIG_TOKEN`). The short-context structured calls use the cheap `gpt-4.1-nano`; the statistics agent uses `gpt-4o` for long context and streaming. This gives one provider path, unified billing, and reliable structured output everywhere.

## Files Changed

### Deleted
- `src/app/api/transactions/[id]/suggest/route.ts`

### New
- `src/app/api/ai/organize/route.ts`
- `src/app/api/ai/organize/apply/route.ts`
- `src/components/organisms/OrganizeReviewSheet/OrganizeReviewSheet.tsx`
- `src/components/organisms/OrganizeReviewSheet/OrganizeReviewSheet.stories.tsx`
- `src/components/organisms/OrganizeReviewSheet/index.ts`

### Modified
- `src/lib/llm.ts` — add `getOpenAIModel()` factory
- `src/lib/statistics.ts` — switch model, remove fallback, fix maxOutputTokens
- `src/app/(app)/page.tsx` — remove suggest state/handler, add organize state/handler
- `src/components/templates/DashboardTemplate/DashboardTemplate.tsx` — remove suggest props, add organize button + sheet
- `src/components/organisms/TransactionGroup/TransactionGroup.tsx` — remove suggest props
- `src/components/molecules/TransactionListItem/TransactionListItem.tsx` — remove suggest button + props
- `src/app/(app)/categories/page.tsx` — remove AI handlers + state
- `src/components/templates/CategoriesTemplate/CategoriesTemplate.tsx` — remove AI section
- `wrangler.jsonc` — add `CLOUDFLARE_ACCOUNT_ID` var
- `worker-configuration.d.ts` — add `CF_AIG_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` to Env type

## Infrastructure Setup (Part 3)

Before shipping Part 3, the following manual steps are required:

1. Create AI Gateway in Cloudflare dashboard → name: `personal-finance`
2. Enable Unified Billing on the gateway (no OpenAI key needed)
3. `wrangler secret put CF_AIG_TOKEN` — Cloudflare API token (not OpenAI)
4. Add `CF_AIG_TOKEN=<token>` to `.dev.vars` for local dev

Gateway URL used in code:
```
https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/personal-finance/openai
```

## GitHub Issues

| # | Title | Part |
|---|-------|------|
| TBD | feat(ai): remove per-transaction suggest button | 1 |
| TBD | feat(ai): add AI Organize button and review flow on transactions screen | 2 |
| TBD | feat(ai): migrate statistics agent to gpt-4o-mini via Cloudflare AI Gateway | 3 |
