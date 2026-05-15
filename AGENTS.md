<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Rules — Personal Finance Tracker

## Component Structure

This project uses **Component Driven Development**. The `src/components/` directory is organized as:

```
atoms/       Primitive UI building blocks (Button, Input, Badge …)
molecules/   Composed units (TransactionListItem, BudgetProgressBar …)
organisms/   Full UI sections (TransactionForm, Navbar, InsightPanel …)
templates/   Page-level layouts — accept slot props, no live data fetching
```

`src/app/` contains only Next.js App Router pages. Pages are **thin**: they call APIs/data hooks and pass results down to template/organism components. No rendering logic in page files.

**Before adding a new component:**
1. Decide its level: atom / molecule / organism / template
2. Create `src/components/<level>/<ComponentName>/`
3. Add `ComponentName.tsx`, `ComponentName.stories.tsx`, `index.ts`
4. Atoms and molecules must have no side effects — pure props in, JSX out

## Storybook

Every component requires a co-located `.stories.tsx` using CSF3. Never skip stories for a new component.

## Design Tokens

CSS custom properties are defined in `src/app/globals.css`. Reference them as `var(--token-name)` or via Tailwind utilities. Never hardcode colors, font sizes, or spacing — use the tokens from `DESIGN.md`.

## Cloudflare Workers

All application code (including Next.js routes) runs inside a Cloudflare Worker. No Node.js APIs unavailable in the Workers runtime. Bindings (`env.DB`, `env.AI`) are accessed via `getCloudflareContext()`.
