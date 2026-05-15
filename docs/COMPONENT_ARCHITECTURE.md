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
| `Input` | Text input with label slot, error state, disabled |
| `CurrencyDisplay` | Formatted VND amount (uses vi-VN locale, `₫` suffix) |
| `Badge` | Small label pill for status or categories |
| `Spinner` | Loading indicator, size variants |
| `Divider` | Horizontal rule, optional label |
| `EmojiIcon` | Single emoji with consistent sizing and fallback |

### 2.3 Molecules

Meaningful combinations of atoms. No side effects — pure props in, JSX out.

| Component | Atoms used | Description |
|-----------|-----------|-------------|
| `FormField` | Input | Label + Input + optional validation error |
| `AmountInput` | Input, CurrencyDisplay | Sign toggle (+ / −) + numeric currency input |
| `CategoryBadge` | EmojiIcon, Badge | Emoji + category name in a compact chip |
| `TransactionListItem` | CurrencyDisplay, EmojiIcon, Badge | Single transaction row: emoji, name, amount, date |
| `BudgetProgressBar` | — | Horizontal bar showing spent / budget with percentage |
| `PaceChip` | Badge | Under / over / no_budget status pill with color coding |
| `MonthStepper` | Button | Prev arrow + month label + next arrow (disabled when current month) |
| `StatCard` | CurrencyDisplay, Badge | Single KPI tile: label, value, optional change indicator |

### 2.4 Organisms

Complete, self-contained UI sections. May hold local UI state (open/closed, active tab). Must not call APIs directly.

| Component | Description |
|-----------|-------------|
| `Navbar` | Fixed top bar: logo, auth user info, sign-out |
| `TransactionForm` | Full transaction entry: amount, type, category, date, note, custom budgets |
| `TransactionGroup` | Date-headed list of `TransactionListItem`s for a single day |
| `DashboardSummary` | Month overview: budget bar, savings, income/expense tiles |
| `PaceLineChart` | Cumulative daily spending vs ideal pace — Vega-Lite chart |
| `InsightPanel` | AI-generated stats: list of `StatCard`s + `VegaChart`s |
| `BudgetAdjustmentForm` | Form to increase/decrease monthly budget with reason |
| `CategoryTree` | Hierarchical category list with add/edit/delete actions |
| `EmojiPicker` | Modal grid for selecting an emoji |
| `VegaChart` | Vega-Lite chart wrapper (handles CSP-safe interpreter, locale, theme) |

### 2.5 Templates

Page-level layout shells. Receive all data as props. No `useEffect`, no `fetch`, no router dependencies.

| Component | Description |
|-----------|-------------|
| `DashboardTemplate` | Home page layout: MonthStepper, DashboardSummary, TransactionGroup list, TransactionForm trigger |
| `BudgetTemplate` | Budget page: current budget display, BudgetAdjustmentForm, adjustment history |
| `CategoriesTemplate` | Category management: CategoryTree, add/edit modals |
| `StatisticsTemplate` | Statistics page: month selector, InsightPanel |

### 2.6 Pages (App Router)

Next.js `page.tsx` files. Only responsibility: fetch data for the current month/state, handle loading/error states, render the matching template.

```
src/app/dashboard/page.tsx          → DashboardTemplate
src/app/dashboard/budget/page.tsx   → BudgetTemplate
src/app/dashboard/categories/page.tsx → CategoriesTemplate
src/app/dashboard/statistics/page.tsx → StatisticsTemplate
```

---

## 3. Directory Structure

```
src/
  components/
    atoms/
      Button/
        Button.tsx
        Button.stories.tsx
        index.ts
      CurrencyDisplay/
      Input/
      Badge/
      Spinner/
      Divider/
      EmojiIcon/
    molecules/
      FormField/
      AmountInput/
      CategoryBadge/
      TransactionListItem/
      BudgetProgressBar/
      PaceChip/
      MonthStepper/
      StatCard/
    organisms/
      Navbar/
      TransactionForm/
      TransactionGroup/
      DashboardSummary/
      PaceLineChart/
      InsightPanel/
      BudgetAdjustmentForm/
      CategoryTree/
      EmojiPicker/
      VegaChart/
    templates/
      DashboardTemplate/
      BudgetTemplate/
      CategoriesTemplate/
      StatisticsTemplate/
  lib/
    auth.ts           # Server-side auth (better-auth)
    auth-client.ts    # Client-side auth hooks
    db.ts             # Kysely D1 adapter
    errors.ts         # Typed error helpers
    fetcher.ts        # SWR fetch wrapper
    holidays.ts       # VN public holidays
    llm.ts            # AI/LLM wrappers (Anthropic, Workers AI)
    pace-line.ts      # Pace line business logic
    schema.ts         # Shared TypeScript types (DB entities)
    session.ts        # Session utilities
    statistics.ts     # Statistics & insight types
    validators.ts     # Input validation
  workers/
    scheduler.ts      # Cloudflare scheduled worker
  app/
    api/              # Next.js API routes (server-side, thin controllers)
    dashboard/
      layout.tsx
      page.tsx
      budget/page.tsx
      categories/page.tsx
      statistics/page.tsx
    globals.css
    layout.tsx
    page.tsx          # Landing / auth gate
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
