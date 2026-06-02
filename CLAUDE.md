@AGENTS.md

# CLAUDE.md

Conventions for Claude Code in this repo. `AGENTS.md` (imported above) is the canonical source for component architecture, Storybook, design tokens, and Cloudflare Workers constraints — this file covers working principles, language, the git workflow, and ops.

## Working principles

- **Think first.** State assumptions. If a request has multiple readings or a simpler approach exists, surface it before coding. When something is genuinely unclear, stop and ask.
- **Simplicity.** Minimum code that solves the problem — no speculative features, abstractions for single-use code, configurability, or error handling for impossible cases. If 200 lines could be 50, rewrite it.
- **Surgical changes.** Touch only what the task needs; match existing style; don't refactor or reformat unrelated code. Remove only the orphans your own change creates — flag pre-existing dead code instead of deleting it. Every changed line should trace to the request.
- **Verify.** Turn tasks into checks ("fix the bug" → write a failing test, then make it pass; "refactor X" → tests green before and after) and confirm before and after.

## Language

- **English** for code, comments, docs, commit/PR/issue text, epic names, and release notes.
- **Reply to the user in English** — the user is practicing English. If the user writes in Vietnamese, answer in English and add a one-line tip showing how the request reads in English.
- **App UI strings: Vietnamese** (VND currency).

## Git workflow (GitLab Flow)

`main` is always stable and deployable. **Never commit directly to `main` or `staging`** — branch for every change. Both branches are protected and require passing status checks.

```bash
git checkout staging && git pull            # branch from up-to-date staging
git checkout -b <type>/<name>               # feature | fix | refactor | hotfix | release
git commit -m "<type>(<scope>): <desc>"     # Conventional Commits: feat·fix·refactor·docs·test·chore
git push -u origin <type>/<name>
gh pr create --base staging ...
```

- **Default PR target is `staging`.** Only `hotfix/*` targets `main` directly (base it on `main`, not staging). Ask "hotfix or epic?" only for a production hotfix or when it's genuinely ambiguous — otherwise assume staging.
- **PR body must close its issues** (`Closes #45`). After merge, comment on each closed issue with root cause / edge cases / gotchas worth keeping.
- **Every code change ships with tests** — Playwright for E2E-testable behavior, Vitest for pure logic.
- **Merging.** Protection requires checks, so you can't merge instantly after push. Enable auto-merge if the repo allows it; otherwise merge once checks pass:
  `gh pr merge <pr> --merge --delete-branch`. Exception: `release/*` PRs are **never** deleted (permanent snapshots).

### Releases (one epic = one GitHub Milestone)

Cut `release/<epic-name>` from `staging`, open a PR into `main` (do **not** delete the branch), then tag `release/<epic-name>` on `main` and publish a GitHub Release with notes. Keep `staging` in sync with `main` afterward via a normal merge/PR — avoid force-pushing the protected `staging` branch.

### Skipping CI

Use `[skip ci]` only when **all** changed files are docs (`*.md`, `docs/**`) or agent config (`.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.storybook/**`). **Never** for `src/**`, `package*.json`, `.github/**`, or build config (`tsconfig.json`, `wrangler.jsonc`, `tailwind.config.*`).

> ⚠️ Do not put `[skip ci]` on the **head commit** of a PR into a protected branch — required checks won't run, so the PR can never merge. Put it only on intermediate commits, or skip it entirely.

## Project

Personal-finance expense tracker — Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, deployed on Cloudflare Workers via `@opennextjs/cloudflare`. Mobile-first (iPhone primary), responsive to laptop.

- **DB**: Cloudflare D1 (SQLite) via Kysely
- **Auth**: better-auth (GitHub OAuth)
- **AI**: OpenAI `gpt-4o` + `gpt-4.1-nano` via the Cloudflare AI Gateway, using the Vercel AI SDK (`@ai-sdk/openai-compatible`)
- **Charts**: Vega-Lite via react-vega
- **Components**: Storybook (CSF3)

Run the `/wrangler` skill before any `wrangler` command.

## Commands

```bash
npm run dev          # Next.js dev → http://localhost:3000
npm run dev:cf       # Workers local preview → http://localhost:8787
npm run storybook    # Storybook → http://localhost:6006
npm run build:cf     # build for Cloudflare Workers
npm run deploy:cf    # build + deploy to production
npm run test:unit          # Vitest unit tests
npm run test:integration   # Vitest integration tests (Cloudflare pool)
npx playwright test        # Playwright E2E
```

## E2E testing principle

Tests must run against identical production code. Never add endpoints, secrets, feature flags, or modules that exist only during testing — they change the behavior under test.

- ✅ Seed data by writing directly to the local D1 SQLite file; authenticate via the real HTTP auth endpoints.
- ❌ No `/api/test/*` routes, no build-time test secrets, no scaffolding to make a failing test pass.

If a test fails on a missing/broken feature, fix the feature or remove the test.

## Database migrations

Run automatically before deploy in CI (`deploy.yml`): **migrations first, deploy second** — if a migration fails, old code keeps running. D1/SQLite is `ADD COLUMN`-only; never break backward compatibility in one deploy.

- ✅ Add a nullable column, a column with `DEFAULT`, or a new table.
- ❌ Rename or drop a column in a single deploy — use expand/contract over two deploys (add new + read both → drop old).

## Documentation

All docs in English; app UI strings stay Vietnamese. See `docs/README.md` for the document registry — including `DESIGN.md`, `docs/COMPONENT_ARCHITECTURE.md`, `docs/BRD.md`, `docs/TECHNICAL_DESIGN.md`, and `docs/TESTING.md`.
