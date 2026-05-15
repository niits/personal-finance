# CDD Refactor Progress

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

## Phase 5 — Organisms (partial) 🔄 IN PROGRESS

| Component | Source | Files | Status |
|-----------|--------|-------|--------|
| `Navbar` | `src/components/Navbar.tsx` | tsx + stories + index | ✅ |
| `EmojiPicker` | `src/components/EmojiPicker.tsx` | tsx + stories + index | ✅ |
| `DashboardSummary` | `src/app/dashboard/page.tsx` (inline) | tsx + stories + index | ✅ |
| `TransactionGroup` | `src/app/dashboard/page.tsx` (inline) | tsx + stories + index | ✅ |
| `TransactionForm` | `src/components/TransactionForm.tsx` | **EMPTY — TODO** | ❌ |
| `VegaChart` | `src/app/dashboard/statistics/page.tsx` | **EMPTY — TODO** | ❌ |

### TransactionForm TODO

- Named export `TransactionForm` (not default)
- Update `import EmojiPicker` → from `@/components/organisms/EmojiPicker`
- Keep internal sub-components: `CategoryDrillDown`, `DatePicker` (they are implementation
  details, not exported)
- Export the `EditTransaction` type
- Stories: `CreateMode`, `EditMode`, `WithError` — static render with mock categories/budgets
  via args (no SWR in stories)
- After extracting, update `src/components/TransactionForm.tsx` to re-export shim:
  `export { TransactionForm } from "@/components/organisms/TransactionForm"`

### VegaChart TODO

- Extract from `src/app/dashboard/statistics/page.tsx`:
  - Constants: `PRIMARY`, `CHART_PALETTE`, `INK`, `INK_MUTED`, `HAIRLINE`, `FONT_BODY`
  - Locale configs: `VEGA_FORMAT_LOCALE`, `VEGA_TIME_FORMAT_LOCALE`
  - Helpers: `vegaFormat()`, `vegaUnitSuffix()`, `buildVegaLiteSpec()`
  - Dynamic import: `VegaEmbed` (ssr: false)
  - Component: `VegaChart({ insight: Insight })` — renders chart or null if no chart_data
- Stories: `BarChart`, `LineChart`, `PieChart`, `GroupedBar`, `NoChart`
- After extracting, update `statistics/page.tsx`:
  - Remove extracted constants/functions
  - Import `{ VegaChart }` from `@/components/organisms/VegaChart`
  - Replace `InsightCard` inline chart rendering with `<VegaChart insight={insight} />`

## Phase 6 — Templates 📋 TODO

Create page-layout components in `src/components/templates/`. Each accepts all data as props
and emits callbacks — no data fetching, no router calls.

| Template | Slot props in | Callbacks out | Source page |
|----------|---------------|---------------|-------------|
| `DashboardTemplate` | `dashboardData`, `transactions[]`, `loading`, `selectedMonth`, `isCurrentMonth` | `onPrevMonth`, `onNextMonth`, `onDeleteTransaction`, `onSaveTransaction` | `src/app/dashboard/page.tsx` |
| `StatisticsTemplate` | `insights[]`, `status`, `agentSteps[]`, `refreshing`, `month`, `isAtUpperBound`, `error`, `regenError` | `onRegenerate`, `onNavigateMonth` | `src/app/dashboard/statistics/page.tsx` |
| `BudgetTemplate` | `monthlyBudget`, `customBudgets[]`, `selectedMonth`, `isCurrentMonth` | `onSaveMonthly`, `onSaveCustom`, `onDeleteCustom` | `src/app/dashboard/budget/page.tsx` |
| `CategoriesTemplate` | `categories[]`, `loading` | `onAddCategory`, `onEditCategory`, `onDeleteCategory`, `onAiSuggest` | `src/app/dashboard/categories/page.tsx` |

## Phase 7 — Thin Pages 📋 TODO

Each `page.tsx` becomes a data-fetching shell: fetch data → render template.
All rendering logic moves into the template.

- [ ] `src/app/dashboard/page.tsx`
- [ ] `src/app/dashboard/statistics/page.tsx`
- [ ] `src/app/dashboard/budget/page.tsx`
- [ ] `src/app/dashboard/categories/page.tsx`

## Phase 8 — Shim old flat files 📋 TODO

Update old flat component files to re-export from the organism, so existing imports keep
working without a big-bang rename pass:

- [ ] `src/components/Navbar.tsx` → `export { Navbar } from "@/components/organisms/Navbar"`
- [ ] `src/components/EmojiPicker.tsx` → `export { EmojiPicker } from "@/components/organisms/EmojiPicker"` + keep default export
- [ ] `src/components/TransactionForm.tsx` → `export { TransactionForm } from "@/components/organisms/TransactionForm"` + keep default export

## Phase 9 — Verify ✅ TODO

```bash
npm run storybook      # all stories load, no TS errors
npm run dev            # app works end-to-end
npx tsc --noEmit       # zero type errors
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
