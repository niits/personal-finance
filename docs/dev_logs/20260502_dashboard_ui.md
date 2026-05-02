# 2026-05-02 — Dashboard UI: Budget display fix, spending chart, transaction list

## Environment

- Next.js (App Router) + TypeScript
- Cloudflare Workers via `@opennextjs/cloudflare`
- D1 (SQLite) via Kysely ORM
- Target: mobile-first (iPhone primary)

---

## 1. Bug: Budget bar showing "Vượt" (exceeded) incorrectly

### Problem

The dashboard header showed "Vượt 12.366.000đ" (exceeded by 12,366,000đ) even though the budget was not actually exceeded. The actual numbers were:

- Budget: 15,000,000đ
- Spent: 2,634,000đ
- Remaining: 12,366,000đ (should show "Còn" = remaining)

### Root Cause

`pace_status === "over"` was used to determine the "Vượt/Còn" label. But `pace_status` measures spending *velocity* relative to the ideal daily pace — not whether the total budget has been exceeded. Early in the month, spending 2.6M in 4 days exceeds the daily ideal (~500k/day) even though the total budget is nowhere near depleted.

- `pace_status = "over"` means: spending faster than the linear ideal pace
- It does NOT mean: total budget has been exceeded

### Fix

Changed the "Vượt/Còn" label and color to use `monthly_budget.remaining < 0` (actual budget exceeded) instead of `pace_status === "over"`.

**Files changed:** `src/app/dashboard/page.tsx`

---

## 2. Feature: Spending cumulative sum chart

### Requirements

- Line chart showing cumulative expense over the budget period
- Reference line: linear budget pace (budget ÷ days_in_period × day)
- Compact height (2–3 line heights)
- Apple-inspired style

### API change

Extended `GET /api/dashboard` to return `daily_expenses: { date: string; amount: number }[]` — daily expense totals grouped by date, ordered ascending, within the budget period.

**File:** `src/app/api/dashboard/route.ts`

### Chart implementation

Built as a pure SVG component (`SpendingChart`) — no chart library installed. Rationale: full control over Apple aesthetics, no additional dependency for a sparkline-scale chart.

**Algorithm:** Catmull-Rom spline converted to cubic bezier (`smoothPath` function) for smooth curves instead of sharp polyline joints. Tension = 0.3.

**Dimensions:**
- ViewBox: 400 × 52px total (6px padding top/bottom + 40px chart area)
- Approximately 2.5 line-heights at 17px body size

**Visual elements:**
- Actual spend: smooth bezier line + area gradient fill
- Budget pace reference: dashed white line, full period width
- Current position: filled dot with halo ring

**Color model (3-tier):**
- Red `#ff453a` — budget actually exceeded (`remaining < 0`)
- Amber `#ff9f0a` — spending pace is fast but budget not yet exceeded (`pace_status === "over"` && `remaining >= 0`)
- Blue `#0a84ff` — on track

**Files changed:** `src/app/dashboard/page.tsx`

### Production data sync for local dev testing

```bash
# Export prod D1
npx wrangler d1 export personal-finance-auth --env production --remote --output /tmp/prod-backup.sql

# Clear local D1 state and import
rm -rf .wrangler/state/v3/d1
npx wrangler d1 execute personal-finance-auth --local --file /tmp/prod-backup.sql
```

---

## 3. Color consistency audit: progress bar

### Problem

After fixing the "Vượt/Còn" label, the progress bar still turned red based on `pace_status === "over"`, creating a contradictory signal: red bar + green "Còn" text side by side.

### Fix

Progress bar color now uses `monthly_budget.remaining < 0` (same as label). Bar is blue (primary) when budget is not exceeded, red only when actually over budget.

The pace signal is still communicated through the chart (actual line vs. reference line position) — no need to duplicate it in the progress bar color.

**Files changed:** `src/app/dashboard/page.tsx`

---

## 4. Design review: dashboard information hierarchy

### UI assessment (iPhone screenshot review)

**Issues identified:**

1. **"Thu nhập +0đ" (Income +0đ)** — entirely useless when income is zero. Shows no actionable information.
2. **"Tiết kiệm -2.634.000đ" (Savings -2,634,000đ)** — when income = 0, this is just `-total_expense`, a direct repeat of the hero number with a negative sign. 100% redundant.
3. **Sparkline chart early in month** — with only 4 days of data, the actual spend line is a tiny squiggle at the far left while the reference line spans the full width. Looks like a rendering bug rather than a feature.

**Root causes:**
- "Income" and "Savings" blocks only carry meaning when the user records income. For expense-only usage, they add visual noise.
- `preserveAspectRatio="none"` on the SVG was distorting stroke width on narrow screens.

**Fixes applied:**
- Removed `preserveAspectRatio="none"` from chart SVG
- Increased area gradient opacity from 0.22 → 0.30 for visibility with sparse data
- Added halo ring around the current-position dot (filled circle at 20% opacity, r=5.5)

### Recommendation: merge dashboard with transaction list

The current "Tổng quan" (Overview) tab has a summary header but is empty below the quick-stats grid. The "Giao dịch" (Transactions) tab is the most-visited view but requires extra navigation.

Recommended layout (Apple Wallet / Monzo / Revolut pattern):
```
[Black header: hero spend + budget bar + sparkline chart]
[Recent transactions grouped by date — last 5–10]
[FAB +]
```

The "Giao dịch" tab remains for full history + filtering. The "Thu nhập / Tiết kiệm" grid should only render when `total_income > 0`.

---

## 5. Transaction list: row size and note display

### Problem

Transaction rows were 64px tall (13px × 2 padding + 38px icon). Apple's minimum tap target is 44pt; typical content rows are 44–52px.

Icon used `↑` / `↓` arrows instead of `category.path` (which contains the category emoji), losing visual context.

Note was already rendered as a subtitle in code but only when `txn.note != null`, causing inconsistent row heights between transactions with and without notes.

### Fix

**`src/app/dashboard/transactions/page.tsx`**

| Property | Before | After |
|---|---|---|
| Row padding | `13px 20px` | `10px 16px` |
| Icon size | 38 × 38px | 32 × 32px |
| Icon content | `↑` / `↓` | `category.path` (emoji), falls back to `↑` / `↓` |
| Note rendering | conditional (causes height jitter) | always rendered, empty string when null |
| Min row height | — | `44px` (Apple tap target minimum) |

Result: rows are ~52px, consistent height regardless of note presence.

---

## 6. Transaction filters and pagination design

### Filters (priority order)

**Essential:**
- **Category filter** — most important. Chip row (horizontal scroll) above list. Tap to toggle. Answers: "how much did I spend on food this month?"

**Already handled:**
- **Month navigation** `‹ Tháng 5/2026 ›` — planned, shared between header and list

**Not needed for a single-user personal app:**
- Type (expense/income) — income volume too low to warrant a filter
- Amount range — adds complexity, rarely needed
- Search — can be added later if transaction count grows significantly

### Pagination

**Current state:** API fetches all transactions for the month with no LIMIT. No pagination implemented.

**Decision: no pagination needed for the monthly view.**

Rationale:
- A budget period is naturally bounded (29–31 days)
- Realistic upper bound for a personal user: ~50–150 transactions/month
- D1 handles this comfortably in a single query
- Group-by-date already breaks the list into digestible chunks

**When pagination would be needed:**
- An "all-time history" view with no time bound
- Search results without date filtering

**If pagination is ever added:** use cursor-based pagination (`WHERE id < :cursor ORDER BY id DESC LIMIT 50`) rather than offset. D1/SQLite does not optimize large `OFFSET` queries well.

### Current transaction volume (prod data as of 2026-05-02)

```sql
SELECT COUNT(*) FROM "transaction";  -- 9 rows, all on 2026-04-30
```

Very early stage — volume not yet a concern.
