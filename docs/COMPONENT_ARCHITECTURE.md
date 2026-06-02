# Component Architecture

## Personal Finance Tracker

---

| Field | Value |
|-------|-------|
| Type | Component Architecture Guide |
| Version | 1.0 |
| Status | Active |
| Created | 2026-05-14 |
| Philosophy | Component Driven Development (componentdriven.org) |

---

## 1. Philosophy — Component Driven Development

Component Driven Development (CDD) is the practice of building UIs from the bottom up using modular, isolated components assembled progressively into pages.

**Core principles:**
- **Isolation**: each component is developed and tested independently with fixed, mocked inputs
- **Bottom-up assembly**: atoms → molecules → organisms → templates → pages
- **State separation**: components isolate presentation from business logic; pages own data-fetching
- **Story-first**: every component has documented states via Storybook before being integrated

**Why it matters here:**
- The UI is the product — expense tracking lives and dies by its UX
- Mobile-first means small, composable units that adapt independently
- AI-generated insights, charts, and live budget data all need isolated components that can be tested without a live backend

---

## 2. Component Hierarchy

### 2.1 Overview

```
Pages          Wire live data to templates. Thin shell — no rendering logic.
   │
Templates      Full-page layouts. Accept slot props. No API calls. No router.
   │
Organisms      Self-contained UI sections. May contain local state. No API calls.
   │
Molecules      Compositions of 2+ atoms. No side effects. Pure props.
   │
Atoms          Primitive UI units. No dependencies on other components.
```

### 2.2 Atoms

Primitive building blocks. Zero dependencies on other `src/components/`. One responsibility.

| Component | Description |
|-----------|-------------|
| `Button` | Primary, secondary, ghost, destructive variants; loading state |
| `Input` _(planned)_ | Text input with label slot, error state, disabled |
| `CurrencyDisplay` | Formatted VND amount (uses vi-VN locale, `₫` suffix) |
| `Badge` | Small label pill for status or categories |
| `Spinner` | Loading indicator, size variants |
| `Divider` _(planned)_ | Horizontal rule, optional label |
| `EmojiIcon` | Single emoji with consistent sizing and fallback |
| `DebtProgressBar` | Repaid / remaining bar for a debt (lend=blue, borrow=amber, settled=green) |

> The tables in §2 describe the target hierarchy (design intent). The shipped inventory is the `src/components/` tree in §3; rows marked _(planned)_ are not built yet.

### 2.3 Molecules

Meaningful combinations of atoms. No side effects — pure props in, JSX out.

| Component | Atoms used | Description |
|-----------|-----------|-------------|
| `FormField` _(planned)_ | Input | Label + Input + optional validation error |
| `AmountInput` _(planned)_ | Input, CurrencyDisplay | Sign toggle (+ / −) + numeric currency input |
| `CategoryBadge` _(planned)_ | EmojiIcon, Badge | Emoji + category name in a compact chip |
| `TransactionListItem` | CurrencyDisplay, EmojiIcon, Badge | Single transaction row: emoji, name, amount, date; shows debt context (cho vay / đi vay · party) |
| `BudgetProgressBar` | — | Horizontal bar showing spent / budget with percentage |
| `PaceChip` | Badge | Under / over / no_budget status pill with color coding |
| `MonthStepper` | Button | Prev arrow + month label + next arrow (disabled when current month) |
| `StatCard` | CurrencyDisplay, Badge | Single KPI tile: label, value, optional change indicator |
| `OrganizeSectionHeader` | Badge | Section title + count badge inside the AI Organize review sheet |
| `NewCategoryRow` | Badge, EmojiIcon | Checkable row for an AI-proposed new category |
| `RecategorizationRow` | Badge | Checkable row for an AI-proposed transaction reclassification |
| `DebtPartyCard` | DebtProgressBar, CurrencyDisplay | Debt summary card: party, remaining / opening, progress, overdue flag |
| `DebtRepaymentItem` | CurrencyDisplay | One repayment row in the debt detail timeline (income/expense direction) |

### 2.4 Organisms

Complete, self-contained UI sections. May hold local UI state (open/closed, active tab). Must not call APIs directly.

| Component | Description |
|-----------|-------------|
| `Navbar` | Fixed top bar: logo, auth user info, sign-out |
| `TransactionForm` | Full transaction entry: amount, type, category, date, note, custom budgets |
| `TransactionGroup` | Date-headed list of `TransactionListItem`s for a single day |
| `DashboardSummary` | Month overview: budget bar, savings, income/expense tiles |
| `PaceLineChart` _(planned)_ | Cumulative daily spending vs ideal pace — Vega-Lite chart (currently rendered via `VegaChart` inside the statistics flow) |
| `InsightPanel` _(planned)_ | AI-generated stats: list of `StatCard`s + `VegaChart`s (currently inlined in `StatisticsTemplate`) |
| `BudgetAdjustmentForm` _(planned)_ | Form to increase/decrease monthly budget with reason (currently inlined in `BudgetTemplate`) |
| `CategoryTree` _(planned)_ | Hierarchical category list with add/edit/delete actions (currently inlined in `CategoriesTemplate`) |
| `EmojiPicker` | Modal grid for selecting an emoji, with keyword-based suggestions |
| `VegaChart` | Vega-Lite chart wrapper (handles CSP-safe interpreter, locale, theme) |
| `OrganizeReviewSheet` | Bottom sheet: lists AI-proposed category/emoji/reclassification changes with checkboxes before applying |
| `LinkTransactionSheet` | Bottom sheet listing eligible transactions to link to a debt as a repayment |

### 2.5 Templates

Page-level layout shells. Receive all data as props. No `useEffect`, no `fetch`, no router dependencies.

| Component | Description |
|-----------|-------------|
| `DashboardTemplate` | Home page layout: month stepper, DashboardSummary, TransactionGroup list, TransactionForm trigger, transaction action sheet |
| `BudgetTemplate` | Budget page: monthly + custom budgets, inline create/adjust/edit forms, adjustment history |
| `CategoriesTemplate` | Category management: hierarchical tree, AI suggest/recategorize review sheets |
| `StatisticsTemplate` | Statistics page: month selector, AI insight cards + `VegaChart`s, regenerate flow |
| `DebtOverviewTemplate` | Debts page (`/debts`): lend/borrow summary tiles, `DebtPartyCard` lists, settled section |

### 2.6 Pages (App Router)

Next.js `page.tsx` files. Only responsibility: fetch data for the current month/state, handle loading/error states, render the matching template.

Routes are flat under the `(app)` route group (Epic 2 flattened them from the old `/dashboard/*` prefix; Epic 4 moved categories under `/account` and added `/debts`).

```
src/app/(app)/page.tsx                      → DashboardTemplate        (/)
src/app/(app)/statistics/page.tsx           → StatisticsTemplate       (/statistics)
src/app/(app)/debts/page.tsx                → DebtOverviewTemplate     (/debts)
src/app/(app)/debts/[id]/page.tsx           → debt detail (DebtRepaymentItem, LinkTransactionSheet)
src/app/(app)/budget/page.tsx               → BudgetTemplate           (/budget)
src/app/(app)/account/page.tsx              → account settings         (/account)
src/app/(app)/account/categories/page.tsx   → CategoriesTemplate       (/account/categories)
src/app/(app)/categories/page.tsx           → redirect → /account/categories
```

Bottom-nav tabs: Tổng quan (`/`) · Thống kê (`/statistics`) · Nợ (`/debts`) · Ngân sách (`/budget`) · Tài khoản (`/account`).

---

## 3. Directory Structure

This mirrors the actual `src/components/` tree (the source of truth for what is shipped).

```
src/
  components/
    atoms/
      Button/
        Button.tsx
        Button.stories.tsx
        index.ts
      Badge/
      CurrencyDisplay/
      DebtProgressBar/
      EmojiIcon/
      Spinner/
    molecules/
      BudgetProgressBar/
      DebtPartyCard/
      DebtRepaymentItem/
      MonthStepper/
      NewCategoryRow/
      OrganizeSectionHeader/
      PaceChip/
      RecategorizationRow/
      StatCard/
      TransactionListItem/
    organisms/
      DashboardSummary/
      EmojiPicker/
      LinkTransactionSheet/
      Navbar/
      OrganizeReviewSheet/
      TransactionForm/
      TransactionGroup/
      VegaChart/
    templates/
      BudgetTemplate/
      CategoriesTemplate/
      DashboardTemplate/
      DebtOverviewTemplate/
      StatisticsTemplate/
  lib/
    auth.ts           # Server-side auth (better-auth)
    db.ts             # Kysely D1 adapter
    debt.ts           # Debt computed values (remaining, overdue, repayment types)
    errors.ts         # Typed error helpers
    fetcher.ts        # SWR fetch wrapper
    holidays.ts       # VN public holidays
    llm.ts            # AI/LLM wrappers — OpenAI (gpt-4o, gpt-4.1-nano) via Cloudflare AI Gateway
    pace-line.ts      # Pace line business logic
    schema.ts         # Shared TypeScript types (DB entities)
    session.ts        # Session utilities
    statistics.ts     # Statistics & insight types
    validators.ts     # Input validation
  workers/
    scheduler.ts      # Cloudflare scheduled worker
  app/
    api/              # Next.js API routes (server-side, thin controllers)
    (app)/            # Authenticated app shell (route group)
      layout.tsx      # Bottom nav
      page.tsx        # / (dashboard)
      statistics/page.tsx
      debts/page.tsx
      debts/[id]/page.tsx
      budget/page.tsx
      account/page.tsx
      account/categories/page.tsx
      categories/page.tsx        # redirect → /account/categories
    globals.css
    layout.tsx
    page.tsx          # Landing / auth gate
    sign-in/ · forgot-password/ · reset-password/
```

---

## 4. Component File Conventions

### 4.1 Folder structure

Every component lives in its own folder. The `index.ts` re-exports for clean imports.

```
atoms/Button/
  Button.tsx           # Component implementation
  Button.stories.tsx   # Storybook stories (required)
  index.ts             # export { Button } from "./Button";
```

### 4.2 Component file

```tsx
// atoms/Button/Button.tsx

type ButtonProps = {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function Button({ label, variant = "primary", loading, disabled, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={/* Tailwind using design token classes */}
    >
      {loading ? <Spinner size="sm" /> : label}
    </button>
  );
}
```

Rules:
- Named export (no default export from component files)
- Props type defined inline (not `interface`, `type` only)
- No `React.FC` — plain function with typed props parameter
- No `any` in props
- Atoms: no `useEffect`, no `useState` unless purely cosmetic (hover, focus)

### 4.3 Story file (CSF3)

```tsx
// atoms/Button/Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  component: Button,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { label: "Lưu", variant: "primary" } };
export const Loading: Story = { args: { label: "Đang lưu", loading: true } };
export const Disabled: Story = { args: { label: "Lưu", disabled: true } };
```

Rules:
- Cover all meaningful states (default, loading, disabled, error)
- Stories must render in isolation — no router, no API, no auth context required
- Use `args` for configurable props; use `render` for complex layout
- Add `tags: ["autodocs"]` to generate the autodoc page

### 4.4 Index file

```ts
// atoms/Button/index.ts
export { Button } from "./Button";
```

Import paths in the app always use the index:
```ts
import { Button } from "@/components/atoms/Button";
```

---

## 5. Props Contract Rules

| Level | May use state? | May call hooks? | May use router? | May fetch data? |
|-------|---------------|-----------------|-----------------|-----------------|
| Atom | Cosmetic only | No | No | No |
| Molecule | No | No | No | No |
| Organism | Local UI state | `useCallback`, `useMemo` | No | No |
| Template | No | No | No | No |
| Page | Yes | All | Yes | Yes (`useSWR`, `fetch`) |

---

## 6. Design Token Usage

All design values come from `DESIGN.md` and are mapped to CSS custom properties in `src/app/globals.css`. Reference them as:

```tsx
// via Tailwind (preferred)
<div className="text-[var(--ink)] bg-[var(--canvas)]">

// via inline style
<div style={{ color: "var(--ink)", background: "var(--canvas)" }}>
```

Never hardcode hex values. Never add a new CSS custom property without a corresponding entry in `DESIGN.md`.

---

## 7. Storybook Setup

Storybook targets the `src/components/` tree. It uses:
- `@storybook/nextjs` adapter (handles Next.js Image, Link, Font)
- `@storybook/addon-essentials` (controls, actions, viewport, docs)
- `@storybook/addon-a11y` (accessibility panel)
- Viewport presets: iPhone SE (375px), iPhone 14 Pro (393px), iPad (768px), Desktop (1280px)

The Storybook theme mirrors the Apple design system (dark nav, SF Pro).

### Running Storybook

```bash
npm run storybook    # dev server at http://localhost:6006
npm run build-storybook  # static build → storybook-static/
```

---

## 8. Adding a New Component — Checklist

- [ ] Identified the correct level (atom / molecule / organism / template)
- [ ] Created the folder under `src/components/<level>/<ComponentName>/`
- [ ] Wrote `ComponentName.tsx` with named export and typed props
- [ ] Wrote `ComponentName.stories.tsx` covering all meaningful states
- [ ] Wrote `index.ts` with re-export
- [ ] Verified stories render in isolation (no auth/router/network needed)
- [ ] Used design tokens — no hardcoded colors or font sizes
- [ ] Ran `npm run storybook` and visually checked all stories

---

## 9. Refactor Roadmap

The migration from the current flat structure to CDD happens in phases:

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Documentation — CLAUDE.md, AGENTS.md, this doc | ✅ Done |
| 2 | Functional specs updated (BRD, TECHNICAL_DESIGN) | 🔄 In progress |
| 3 | Install Storybook, configure for Next.js + Tailwind | ⬜ Pending |
| 4 | Extract atoms (Button, Input, CurrencyDisplay, Badge, Spinner, EmojiIcon) | ⬜ Pending |
| 5 | Extract molecules (TransactionListItem, BudgetProgressBar, PaceChip, MonthStepper, StatCard) | ⬜ Pending |
| 6 | Extract organisms (Navbar, TransactionForm, TransactionGroup, DashboardSummary, PaceLineChart, InsightPanel, VegaChart, EmojiPicker) | ⬜ Pending |
| 7 | Extract templates (DashboardTemplate, BudgetTemplate, CategoriesTemplate, StatisticsTemplate) | ⬜ Pending |
| 8 | Thin out pages — pages become data-fetching shells only | ⬜ Pending |
| 9 | Write stories for all extracted components | ⬜ Pending |
