@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow (GitLab Flow)

This project follows a simplified GitLab Flow. `main` is always stable and deployable; every change goes through a feature branch and a Pull Request.

### Branch rules

**Never commit directly to `main` or `staging`.** Always create a new branch for every change.

**Default PR target is `staging`**, not `main`. Releases are done by merging `staging` directly into `main` at the end of each epic, then tagging the release.

**Hotfix branches** (`hotfix/*`) target `main` directly, then `staging` is rebased on top of main:
```bash
gh pr merge <pr> --merge --delete-branch   # merge hotfix → main
git checkout staging && git rebase origin/main
git push --force origin staging
```

**Always merge PRs automatically** (`gh pr merge --merge --delete-branch`) after pushing, unless told otherwise.

- Reuse an existing branch only if the new work is clearly related to that branch's ongoing feature or fix.
- If it's unclear whether to create a new branch or reuse one, ask before proceeding.

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<name>` | `feature/expense-filter` |
| Bug fix | `fix/<name>` | `fix/currency-rounding` |
| Production hotfix | `hotfix/<name>` | `hotfix/auth-crash` |
| Refactor | `refactor/<name>` | `refactor/transaction-hook` |

### Epic & Release Workflow

Each epic maps to a **GitHub Milestone**. Features ship to `staging` throughout the epic. When the epic is done:

```bash
# Merge staging → main (release)
gh pr create --base main --head staging --title "release: <epic-name>"
gh pr merge --merge --delete-branch

# Tag the release on main
git checkout main && git pull
git tag release/<epic-name>
git push origin --tags
```

### Workflow

```bash
# 1. Always branch from an up-to-date main
git checkout main && git pull
git checkout -b feature/<name>

# 2. Commit often with Conventional Commits
git commit -m "feat(scope): short description"

# 3. Push and open a Pull Request → staging
git push -u origin feature/<name>

# 4. After PR is merged, delete the branch
git branch -d feature/<name>
```

### Commit message format (Conventional Commits)

```
<type>(<scope>): <short description>
```

Types: `feat` · `fix` · `refactor` · `docs` · `test` · `chore`

Examples:
```
feat(transactions): add recurring expense support
fix(auth): handle expired GitHub token
refactor(stats): extract useStatistics hook
```

---

## Project

Personal finance expense tracker — Next.js app deployed on Cloudflare Workers, optimized for iPhone and laptop. UI in Vietnamese, VND currency.

---

## Component Driven Development (CDD)

**This project follows Component Driven Development.** Before writing any UI code, read `docs/COMPONENT_ARCHITECTURE.md`. It is the authoritative guide for component hierarchy, file structure, naming, and Storybook conventions.

The short version:

- **Build bottom-up**: atoms → molecules → organisms → templates → pages
- **Every component lives in its own folder** with a co-located `.stories.tsx`
- **Components are isolated**: no direct API calls, no router dependencies, pure props
- **Pages are thin**: they fetch data and pass it down — no rendering logic

```
src/components/
  atoms/       # Primitive UI: Button, Input, CurrencyDisplay, Badge …
  molecules/   # Composed units: TransactionListItem, BudgetProgressBar …
  organisms/   # Full sections: TransactionForm, Navbar, InsightPanel …
  templates/   # Page-level layouts with slot props, no live data
src/app/       # Next.js App Router — pages fetch data, render templates
```

Use `/frontend-design` skill when building any UI component or page.

---

## Design System

**Always read `DESIGN.md` before writing any UI code.** It is the single source of truth for all visual decisions.

`DESIGN.md` contains a complete Apple-inspired design system:
- Color tokens (`colors.primary` = #0066cc, `colors.ink` = #1d1d1f, etc.)
- Typography scale (SF Pro Display/Text, body at 17px, weight ladder: 300/400/600/700)
- Spacing tokens (`spacing.section` = 80px, `spacing.lg` = 24px, etc.)
- Component specs (buttons, tiles, cards, nav, footer)
- Responsive breakpoints and collapsing strategy

**Rules:**
- Never inline hex values — always reference CSS custom properties from `globals.css`
- Never add a second accent color
- One drop-shadow in the entire system, reserved for product imagery only
- Apply tokens as Tailwind classes or inline `style` using `var(--token-name)`

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Deployment**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Database**: Cloudflare D1 (SQLite) via Kysely
- **Auth**: better-auth (GitHub OAuth)
- **AI**: Anthropic SDK + Workers AI
- **Charts**: Vega-Lite via react-vega
- **Component dev**: Storybook (CSF3 format)
- **Target**: Mobile-first (iPhone primary), responsive to laptop

Use `/wrangler` skill before running any `wrangler` commands.
Use `/cloudflare` skill for platform decisions (storage, routing, AI bindings).

---

## Commands

```bash
# Dev
npm run dev          # Next.js dev server → http://localhost:3000
npm run dev:cf       # Cloudflare Workers local preview → http://localhost:8787
npm run storybook    # Storybook component explorer → http://localhost:6006

# Build & deploy
npm run build:cf     # Build for Cloudflare Workers
npm run deploy:cf    # Build + deploy to production
npm run build-storybook  # Static Storybook build

# Test
npm run test:unit        # Vitest unit tests
npm run test:integration # Vitest integration tests (Cloudflare pool)
npm run test             # Both
```

## E2E Testing Principle

**Tests must run against identical production code.** Never add endpoints, secrets, feature flags, or modules that exist only during testing — doing so changes the behavior under test and defeats the purpose of E2E.

- ✅ Seed test data by writing directly to the local D1 SQLite file (bypasses the app, doesn't change production behavior)
- ✅ Authenticate via real HTTP auth endpoints (tests the actual auth path)
- ❌ Never add API routes like `/api/test/reset` that only exist during E2E
- ❌ Never add build-time secrets that alter code paths (e.g. `PLAYWRIGHT_TEST_SECRET`)
- ❌ Never create endpoints to make a failing test pass — if a test fails because a feature is broken, that's the test doing its job

If a test fails due to a missing/broken feature: fix the feature in production code, or remove the test. Do not add test scaffolding.

---

## Storybook Rules

Every component must have a `.stories.tsx` file co-located with the component:

```
src/components/atoms/Button/
  Button.tsx
  Button.stories.tsx   ← required
  index.ts
```

Stories use **CSF3** (Component Story Format v3):

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  component: Button,
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { label: "Lưu", variant: "primary" },
};
```

- Cover all meaningful prop variations and states (loading, disabled, error)
- Use `@storybook/addon-a11y` for accessibility checks
- Never import from `src/app/` inside stories — components must be isolated

---

## Documentation

All documentation must be written in English. UI strings in the app remain in Vietnamese.

Key documents:
- `DESIGN.md` — visual design system (source of truth for UI)
- `docs/COMPONENT_ARCHITECTURE.md` — CDD guide, component hierarchy, Storybook conventions
- `docs/BRD.md` — business requirements
- `docs/TECHNICAL_DESIGN.md` — DB schema, API contracts, computed values
- `docs/TESTING.md` — test strategy
- `docs/README.md` — document registry

---

## Database Migrations

Migrations run automatically before code deploy in CI (`deploy.yml`). Order is intentional: **migrations first, deploy second** — if a migration fails, the old code keeps running safely.

**Never write a migration that breaks backward compatibility.** D1/SQLite only supports `ADD COLUMN`:

```sql
-- ✅ Safe: add nullable column
ALTER TABLE "transaction" ADD COLUMN tags TEXT;

-- ✅ Safe: add column with DEFAULT
ALTER TABLE category ADD COLUMN icon TEXT NOT NULL DEFAULT '';

-- ✅ Safe: add new table
CREATE TABLE IF NOT EXISTS new_table (...);

-- ❌ Never: rename or drop a column in a single deploy
--    Use expand/contract across two deploys instead
```

**Expand/contract pattern** for renaming or removing a column:
1. **Deploy 1 — Expand**: add the new column; code reads both old and new
2. **Deploy 2 — Contract**: drop the old column; code only uses the new one

---

## Cloudflare Workers Constraints

These apply to all code running inside Workers (not just API routes — the entire Next.js app runs in the Worker):

- No `fs`, `child_process`, or Node.js built-ins not in the Cloudflare compatibility list
- No `eval` or dynamic `Function()` — use `vega-interpreter` for Vega expressions
- DB access only through `getCloudflareContext()` → `env.DB` (Kysely D1 adapter)
- Auth session always scoped per request — never cache session in module scope
- Every `/api/*` route (except `/api/auth/*`) must verify session and scope queries to `user_id`
