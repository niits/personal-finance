# CDD Refactor Progress

> **Historical snapshot.** This logs the original CDD refactor (branch `feature/cdd-refactor`) and reflects the codebase *at that time* — including the old `/dashboard/*` routes (flattened later in Epic 2) and the component set before Epics 3–4. It is kept for history and is **not** maintained. For the current component hierarchy, routes, and inventory see `docs/COMPONENT_ARCHITECTURE.md`.

Branch: `feature/cdd-refactor`

## Overview

Converting the codebase to Component Driven Development (bottom-up: atoms → molecules →
organisms → templates → pages). Every component lives in its own folder with a co-located
`.stories.tsx`. Pages become thin data-fetching shells.

---

## Phase 1 — Documentation ✅ DONE

- [x] `CLAUDE.md` — full rewrite with CDD section, Storybook rules, Cloudflare constraints
- [x] `AGENTS.md` — updated with component hierarchy context
- [x] `docs/COMPONENT_ARCHITECTURE.md` — authoritative CDD guide (hierarchy, file conventions,
      props contracts, 9-phase roadmap)
- [x] `docs/BRD.md` v1.2 — added §6.9 Statistics feature (STAT-01…STAT-08)
- [x] `docs/TECHNICAL_DESIGN.md` v1.2 — added §4.9 Statistics API, §9 Frontend Architecture
- [x] `docs/README.md` — added COMPONENT_ARCHITECTURE.md entry

## Phase 2 — Storybook ✅ DONE

- [x] `npm install storybook@10 @storybook/nextjs@10 @storybook/addon-a11y@10`
- [x] `.storybook/main.ts` — stories glob, a11y addon, nextjs framework, staticDirs
- [x] `.storybook/preview.ts` — imports globals.css, viewport presets (375/393/768/1280px),
      defaultViewport: iphone14Pro

## Phase 3 — Atoms ✅ DONE

| Component | Files | Status |
|-----------|-------|--------|
| `CurrencyDisplay` | tsx + stories + index | ✅ |
| `Button` | tsx + stories + index | ✅ |
| `Badge` | tsx + stories + index | ✅ |
| `Spinner` | tsx + stories + index | ✅ |
| `EmojiIcon` | tsx + stories + index | ✅ |

## Phase 4 — Molecules ✅ DONE

| Component | Files | Status |
|-----------|-------|--------|
| `PaceChip` | tsx + stories + index | ✅ |
| `BudgetProgressBar` | tsx + stories + index | ✅ |
| `MonthStepper` | tsx + stories + index | ✅ |
| `TransactionListItem` | tsx + stories + index | ✅ |
| `StatCard` | tsx + stories + index | ✅ |

## Phase 5 — Organisms ✅ DONE

| Component | Source | Files | Status |
|-----------|--------|-------|--------|
| `Navbar` | `src/components/Navbar.tsx` | tsx + stories + index | ✅ |
| `EmojiPicker` | `src/components/EmojiPicker.tsx` | tsx + stories + index | ✅ |
| `DashboardSummary` | `src/app/dashboard/page.tsx` (inline) | tsx + stories + index | ✅ |
| `TransactionGroup` | `src/app/dashboard/page.tsx` (inline) | tsx + stories + index | ✅ |
| `TransactionForm` | `src/components/TransactionForm.tsx` | tsx + stories + index | ✅ |
| `VegaChart` | `src/app/dashboard/statistics/page.tsx` | tsx + stories + index | ✅ |

## Phase 6 — Templates ✅ DONE

| Template | Status |
|----------|--------|
| `DashboardTemplate` | ✅ |
| `StatisticsTemplate` | ✅ |
| `BudgetTemplate` | ✅ |
| `CategoriesTemplate` | ✅ |

## Phase 7 — Thin Pages ✅ DONE

- [x] `src/app/dashboard/page.tsx`
- [x] `src/app/dashboard/statistics/page.tsx`
- [x] `src/app/dashboard/budget/page.tsx`
- [x] `src/app/dashboard/categories/page.tsx`

## Phase 8 — Shim old flat files ✅ DONE

- [x] `src/components/Navbar.tsx` → re-exports from organisms/Navbar
- [x] `src/components/EmojiPicker.tsx` → re-exports from organisms/EmojiPicker
- [x] `src/components/TransactionForm.tsx` → re-exports from organisms/TransactionForm

## Phase 9 — Verify ✅ DONE

```
npx tsc --noEmit  → zero new errors (pre-existing: @storybook/nextjs, vega-* types)
```

---

## File Inventory

### Already created in `src/components/`

```
atoms/
  Badge/          Badge.tsx  Badge.stories.tsx  index.ts
  Button/         Button.tsx  Button.stories.tsx  index.ts
  CurrencyDisplay/ CurrencyDisplay.tsx  CurrencyDisplay.stories.tsx  index.ts
  EmojiIcon/      EmojiIcon.tsx  EmojiIcon.stories.tsx  index.ts
  Spinner/        Spinner.tsx  Spinner.stories.tsx  index.ts

molecules/
  BudgetProgressBar/  BudgetProgressBar.tsx  BudgetProgressBar.stories.tsx  index.ts
  MonthStepper/       MonthStepper.tsx  MonthStepper.stories.tsx  index.ts
  PaceChip/           PaceChip.tsx  PaceChip.stories.tsx  index.ts
  StatCard/           StatCard.tsx  StatCard.stories.tsx  index.ts
  TransactionListItem/ TransactionListItem.tsx  TransactionListItem.stories.tsx  index.ts

organisms/
  DashboardSummary/   DashboardSummary.tsx  DashboardSummary.stories.tsx  index.ts
  EmojiPicker/        EmojiPicker.tsx  EmojiPicker.stories.tsx  index.ts
  Navbar/             Navbar.tsx  Navbar.stories.tsx  index.ts
  TransactionForm/    (empty — Phase 5 TODO)
  TransactionGroup/   TransactionGroup.tsx  TransactionGroup.stories.tsx  index.ts
  VegaChart/          (empty — Phase 5 TODO)
```

### Storybook config

```
.storybook/
  main.ts
  preview.ts
```

### Old flat files (still used, need shims in Phase 8)

```
src/components/Navbar.tsx          — default export, imports auth-client
src/components/EmojiPicker.tsx     — default export
src/components/TransactionForm.tsx — default export, ~780 lines
```
