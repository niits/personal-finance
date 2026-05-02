# 2026-05-02 — Merge Transactions tab into Home; remove /dashboard/transactions

## Summary

The dedicated "Giao dịch" (Transactions) tab has been removed. Its functionality is now part of the Home (Tổng quan) tab, which serves as the primary surface for both the monthly summary and the transaction feed.

---

## Motivation

- The Transactions tab was the most-visited screen but required an extra navigation tap from Home.
- The Home tab had dead space below the quick-stats grid.
- The pattern used by Monzo, Revolut, and Apple Card — summary header + scrollable transaction list on one screen — better fits the usage pattern of a single-user personal finance app.
- The "Thu nhập +0đ / Tiết kiệm -X₫" quick-stats grid was redundant when income = 0 (savings = -expenses, a repeat of the hero number). Removing the grid when income = 0 reclaimed that space for transactions.

---

## Changes

### Deleted

- `src/app/dashboard/transactions/page.tsx` — entire file removed.

### `src/app/dashboard/layout.tsx`

Removed the "Giao dịch" tab entry from the bottom navigation. Bottom nav now has 3 tabs: Tổng quan, Danh mục, Ngân sách.

### `src/app/dashboard/page.tsx` (Home)

Full rewrite over several iterations. Final state:

**Layout:** `height: calc(100svh - 44px - 72px)` flex column with `overflow: hidden`. Only the transaction list div has `overflow-y: auto` — nothing else on the screen scrolls.

**Header (black section):**
- Month navigation `‹ Tháng X/YYYY ›` — `›` renders with `color: transparent` on current month (maintains layout, hides visually)
- Period dates `29/4 – 28/5`
- Hero spend number (38px, SF Pro Display)
- Budget bar with two layers (see below)
- Income/savings mini-grid — only rendered when `total_income > 0`

**Budget bar — two-layer design:**
```
[track: rgba(255,255,255,0.08)  — full width]
[pace:  rgba(255,255,255,0.18)  — days_elapsed / days_in_period %]
[actual: blue or red            — total_expense / budget %]
```
All three are `position: absolute` within a `position: relative` container. The pace layer communicates "you should have spent this much by now" without any label — position relative to the actual bar tells the story.

Color rules (consistent across bar and "Còn/Vượt" label):
- Red `#ff453a` — `remaining < 0` (budget actually exceeded)
- Blue `var(--primary)` — otherwise

**Category filter chips:** 4 chips total (Tất cả + top 3 level-1 categories by expense count), each with `flex: 1` — distributed equally across screen width. Top-3 derived from `root_category_name` field on transactions (expense type only). Filter is client-side. Resets on month navigation.

**Transaction feed:** Same date-grouped layout as the old transactions page. `formatDateHeader` gives relative labels (Hôm nay, Hôm qua, then weekday + date). Daily net total shown right-aligned on each date group header. Action sheet (tap row) for edit/delete.

**Transaction row:** 52px height (10px padding × 2 + 32px icon). Icon is a colored circle with first letter of category name — the old `category.path` (breadcrumb text) was mistakenly used as icon content causing overflow.

### `src/app/api/transactions/route.ts`

Added `root_category_name` field to `formatTransaction` output. Logic:
- `cat_level === 1` → `cat_name`
- `cat_level === 2` → `cat_p1_name`
- `cat_level === 3` → `cat_p2_name`

This avoids parsing the breadcrumb path string in the frontend.

### `src/components/TransactionForm.tsx` — `CategoryDrillDown`

Added `findSelectedChild(cat, selectedId)` recursive helper. When a parent category row has a selected descendant:
- Row background: `rgba(0,102,204,0.06)`
- Radio circle: blue border + half-opacity dot (distinct from direct selection = filled)
- Category name: blue + bold
- Subtitle line: selected child's name at 70% opacity
- Chevron: blue at 60% opacity

Previously, navigating back from a selected leaf gave no indication on the parent row.

---

## Removed features

- **Pace line chart (SpendingChart SVG)** — removed. The budget bar's pace layer communicates the same information more compactly. The chart was visually confusing early in the month when only a few days of data existed (tiny squiggle at far left).
- **Header collapse on scroll** — removed. Implementation caused React re-renders on every scroll event (jank). The fixed-height layout (only list scrolls) makes collapse unnecessary.
- **"Thu nhập / Tiết kiệm" always-visible grid** — now conditional on `total_income > 0`.
- **Transactions tab** — see above.

---

## Documentation updated

- `docs/BRD.md` §10.1 Navigation Structure — updated to 3-tab layout, documented Home screen sections
- `docs/BRD.md` §10.2 Log Transaction Form — added note about category parent indicator
- `docs/BRD.md` §10.3 Status Card — replaced with accurate description of current Home header
- `docs/BRD.md` RPT-03 — updated to reflect transaction feed on Home instead of separate screen
