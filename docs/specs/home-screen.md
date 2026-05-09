# Home Screen

| Field | Value |
|-------|-------|
| Type | Feature Specification |
| Status | Implemented |
| Version | 1.0 |
| Author | niits |
| Created | 2026-05-02 |
| Last Updated | 2026-05-02 |
| Related | BRD.md §10.1–10.3, TECHNICAL_DESIGN.md §4.3 §4.7 |

## Summary

The Home tab (`/dashboard`) is the primary screen. It merges the monthly summary header with the full transaction feed, eliminating the separate "Giao dịch" (Transactions) tab.

The pattern follows Apple Wallet / Monzo / Revolut: a persistent summary header above a scrollable transaction list.

## Layout

```
height: calc(100svh - 44px - 72px)  /* 44px top bar, 72px bottom nav */
display: flex;
flex-direction: column;
overflow: hidden;
```

Only the transaction list container has `overflow-y: auto`. Nothing else on the screen scrolls. This avoids scroll conflicts between the header and the list.

---

## Header (black section)

### Month Navigation

```
‹  Tháng 5/2026  ›
```

- `›` renders with `color: transparent` on the current month — maintains layout without a visible disabled state
- Tapping `‹` / `›` changes the selected month and resets the category filter chip to "Tất cả"

### Period Dates

```
29/4 – 28/5
```

Derived from `monthly_budget.start_date` / `monthly_budget.end_date` (or calendar month boundaries when no budget exists).

### Hero Spend Number

Total expenses for the selected month. 38px SF Pro Display.

### Budget Bar

Three layers, all `position: absolute` inside a `position: relative` container:

| Layer | Color | Width | Meaning |
|-------|-------|-------|---------|
| Track | `rgba(255,255,255,0.08)` | 100% | Full budget period |
| Pace | `rgba(255,255,255,0.18)` | `days_elapsed / days_in_period` % | Ideal spend position today |
| Actual | blue or red | `total_expense / budget` % | Real spending to date |

**Color rule — applied consistently to both the actual bar layer and the "Còn/Vượt" label:**

| Condition | Color |
|-----------|-------|
| `remaining < 0` (budget actually exceeded) | Red `#ff453a` |
| Otherwise | Blue `var(--primary)` |

`pace_status === "over"` (spending faster than daily ideal) does NOT drive the bar color — only actual budget exhaustion triggers red. The pace signal is communicated by the relative position of the actual bar against the pace layer, with no additional label.

**Budget label row:**
- Left: `Ngân sách X₫`
- Right: `Còn Y₫` or `Vượt Y₫` (same color rule as bar)

### Income / Savings Row

Rendered only when `total_income > 0`:

```
Thu nhập  +X₫      Tiết kiệm  Y₫
```

When income is zero this row is hidden — it would show only `-total_expense` under "Tiết kiệm", which is a direct repeat of the hero number with a negative sign.

---

## Category Filter Chips

A horizontal row of four chips spanning the full screen width:

```
[Tất cả]   [Category 1]   [Category 2]   [Category 3]
```

- Each chip has `flex: 1` — distributed equally, no horizontal scroll
- "Tất cả" is always first
- The other three are the top level-1 categories by expense count for the selected month (expense transactions only)
- Filtering is **client-side** — no new API call when switching chips
- Resets to "Tất cả" on month navigation

### `root_category_name` field

The `GET /api/transactions` response includes a `root_category_name` field on each transaction, derived server-side in `src/app/api/transactions/route.ts`:

| Transaction category level | `root_category_name` value |
|-----------------------------|---------------------------|
| 1 | `cat_name` |
| 2 | `cat_p1_name` |
| 3 | `cat_p2_name` |

This avoids parsing the breadcrumb path string on the frontend.

---

## Transaction Feed

Transactions grouped by date, descending. Each date group shows:

- **Date header** with a relative label (`formatDateHeader`):
  - Today → `Hôm nay`
  - Yesterday → `Hôm qua`
  - Older → weekday + date (e.g., `Thứ Ba, 28/4`)
- **Daily net total** right-aligned in the group header
- **Transaction rows** for that date (see below)

Tapping a transaction row opens an action sheet with Edit and Delete options.

## Transaction Row

| Property | Value |
|----------|-------|
| Height | 52px (`10px padding × 2` + `32px icon`) |
| Minimum tap target | 44px (Apple HIG) |
| Icon | Colored circle (32 × 32px), first letter of category name |
| Primary text | Amount, right-aligned — red for expense, green for income |
| Secondary text | Category name |
| Note subtitle | Shown when `txn.note` is non-empty |

### `CategoryDrillDown` — Parent Indicator

When a parent category row has a selected descendant in the category picker:

| Element | State |
|---------|-------|
| Row background | `rgba(0,102,204,0.06)` |
| Radio circle | Blue border + half-opacity dot (distinct from direct selection = filled) |
| Category name | Blue + bold |
| Subtitle | Selected child's name at 70% opacity |
| Chevron | Blue at 60% opacity |

This indicates "a child of this category is selected" without requiring the user to drill in to confirm.

---

## What Was Removed

| Feature | Reason removed |
|---------|----------------|
| Pace line chart (SpendingChart SVG) | Budget bar pace layer communicates the same information more compactly. The chart was visually confusing early in the month when only a few days of data existed (tiny squiggle at far left against a full-width reference line). |
| Header collapse on scroll | React re-renders on every scroll event caused jank. The fixed-height layout (only the list scrolls) makes collapse unnecessary. |
| "Giao dịch" tab | Merged into Home. The most-visited screen now requires zero extra navigation. |
| Always-visible "Thu nhập / Tiết kiệm" grid | Only rendered when `total_income > 0`. When income is zero, the grid showed `-total_expense` as savings — a direct repeat of the hero number with a negative sign. |
