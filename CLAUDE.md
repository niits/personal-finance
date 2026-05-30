@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Principles

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Language

- **Code, comments, docs, commit messages, PR/issue titles/descriptions, epic names, release notes**: English
- **Claude's responses to the user**: English
- **If the user writes in Vietnamese**: respond in English and include a tip showing how the request would read in English
- **UI strings in the app**: Vietnamese

## Git Workflow (GitLab Flow)

This project follows a simplified GitLab Flow. `main` is always stable and deployable; every change goes through a feature branch and a Pull Request.

### Branch rules

**Never commit directly to `main` or `staging`.** Always create a new branch for every change.

**Default PR target is `staging`**, not `main`. Releases are done by cutting a `release/<epic-name>` branch from `staging`, merging it into `main`, and tagging — so the release branch serves as a permanent named snapshot of exactly what shipped.

**Hotfix branches** (`hotfix/*`) target `main` directly, then `staging` is rebased on top of main:
```bash
# Creating a hotfix branch — always base on main, not staging
git checkout main && git pull
git checkout -b hotfix/<name>

# After PR is merged → main, sync staging
gh pr merge <pr> --merge --delete-branch   # merge hotfix → main
git checkout staging && git rebase origin/main
git push --force origin staging
```

**Always merge PRs automatically** (`gh pr merge --merge --delete-branch`) after pushing, unless told otherwise. **Exception: release branches** — never pass `--delete-branch` for `release/*` PRs; those branches are permanent snapshots.

**Before starting any task, ask:** "Is this a hotfix (targets `main` directly) or part of an epic (targets `staging`)?" — do not assume, always confirm. Use the answer to pick the correct base branch and PR target.

**PR body must close linked issues** using GitHub's closing syntax so issues are automatically closed on merge:

```
Closes #45
Closes #46
```

**After a PR is merged**, post a comment on each closed issue with any additional context collected during the fix — root cause details, edge cases found, implementation decisions, or gotchas for future reference.

**Every code change must include relevant tests.** For E2E-testable behaviour, add or update a Playwright spec. For pure logic, add a Vitest unit test. Never ship a code change without test coverage of the changed behaviour.

- Reuse an existing branch only if the new work is clearly related to that branch's ongoing feature or fix.
- If it's unclear whether to create a new branch or reuse one, ask before proceeding.

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<name>` | `feature/expense-filter` |
| Bug fix | `fix/<name>` | `fix/currency-rounding` |
| Production hotfix | `hotfix/<name>` | `hotfix/auth-crash` |
| Refactor | `refactor/<name>` | `refactor/transaction-hook` |
| Release | `release/<epic-name>` | `release/epic-1-auth` |

### Epic & Release Workflow

Each epic maps to a **GitHub Milestone**. Features ship to `staging` throughout the epic. When the epic is done:

```bash
# 1. Cut a release branch from staging — this becomes the permanent snapshot
git checkout staging && git pull
git checkout -b release/<epic-name>
git push -u origin release/<epic-name>

# 2. PR: release/<epic-name> → main  (do NOT delete the branch — keep it as a snapshot)
gh pr create --base main --head release/<epic-name> --title "release: <epic-name>"
gh pr merge --merge   # no --delete-branch

# 3. Tag the release on main
git checkout main && git pull
git tag release/<epic-name>
git push origin --tags

# 4. Rebase staging on top of main so they stay in sync
git checkout staging
git rebase origin/main
git push --force origin staging
```

The `release/<epic-name>` branch is **never deleted** — it marks exactly what was in production at that point, making it easy to diff any future state against a past release.

### Workflow

```bash
# 1. Always branch from an up-to-date staging
#    First ensure staging is in sync with main
git checkout main && git pull
git checkout staging && git pull
git rebase origin/main    # replay staging commits on top of main (handles diverged history)
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

### Skipping CI

Append `[skip ci]` to the commit message when the change cannot affect runtime behavior and running the full CI pipeline would be wasteful:

```
docs(workflow): update release steps [skip ci]
chore: update CLAUDE.md [skip ci]
```

**Use `[skip ci]` when ALL changed files are:**
- Documentation (`*.md`, `docs/**`)
- Claude Code config (`.claude/**`, `CLAUDE.md`, `AGENTS.md`)
- Storybook config (`.storybook/**`) — not story files themselves

**Do NOT use `[skip ci]` when changing:**
- Any file under `src/`
- `package.json`, `package-lock.json`
- Any workflow file (`.github/**`)
- Config files that affect the build (`tsconfig.json`, `wrangler.jsonc`, `tailwind.config.*`)

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
- **Prefer Tailwind utility classes over inline `style`.** Tokens are exposed as utilities via the
  `@theme inline` block in `globals.css` (`text-ink`, `bg-canvas`, `p-md`, `rounded-lg`, `font-body`, …).
  Use arbitrary-value utilities (`text-[15px]`, `leading-[1.3]`) for non-token one-offs. Reserve inline
  `style` for genuinely dynamic, runtime-computed values (progress widths, chart colors). See `DESIGN.md` → Styling Implementation.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Deployment**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Database**: Cloudflare D1 (SQLite) via Kysely
- **Auth**: better-auth (GitHub OAuth)
- **AI**: Anthropic SDK + Workers AI (Llama) + OpenAI gpt-4o-mini via Cloudflare AI Gateway
- **Charts**: Vega-Lite via react-vega
- **Component dev**: Storybook (CSF3 format)
- **Target**: Mobile-first (iPhone primary), responsive to laptop

Use `/wrangler` skill before running any `wrangler` commands.

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
npx playwright test      # Playwright E2E tests
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
