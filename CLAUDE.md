@AGENTS.md

# CLAUDE.md

Conventions for Claude Code in this repo. `AGENTS.md` (imported above) provides the documentation entry points and non-negotiable constraints. This file covers only what is unique to it: working principles, language, the git workflow, and ops pointers.

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

`main` is always stable and deployable; every merge into `main` deploys to production. **Never commit directly to `main`** — branch for every change. `main` is protected and requires passing status checks. There is no staging branch or staging environment.

```bash
git checkout main && git pull               # branch from up-to-date main
git checkout -b <type>/<name>               # feature | fix | refactor | hotfix
git commit -m "<type>(<scope>): <desc>"     # Conventional Commits: feat·fix·refactor·docs·test·chore
git push -u origin <type>/<name>
gh pr create --base main ...
```

- **All PRs target `main`.**
- **PR body must close its issues** (`Closes #45`). After merge, comment on each closed issue with root cause / edge cases / gotchas worth keeping.
- **Every code change ships with tests** — Playwright for E2E-testable behavior, Vitest for pure logic.
- **Merging.** Protection requires checks, so you can't merge instantly after push. Enable auto-merge if the repo allows it; otherwise merge once checks pass:
  `gh pr merge <pr> --merge --delete-branch`.

### Releases (one epic = one GitHub Milestone)

When an epic's milestone is complete, tag `release/<epic-name>` on `main` and publish a GitHub Release with notes. The tag is the permanent snapshot of what shipped. Existing `release/*` branches from the former staging flow are kept as historical snapshots.

### Skipping CI

Use `[skip ci]` only when **all** changed files are docs (`*.md`, `docs/**`) or agent config (`.claude/**`, `CLAUDE.md`, `AGENTS.md`, `.storybook/**`). **Never** for `src/**`, `package*.json`, `.github/**`, or build config (`tsconfig.json`, `wrangler.jsonc`, `tailwind.config.*`).

> ⚠️ Do not put `[skip ci]` on the **head commit** of a PR into a protected branch — required checks won't run, so the PR can never merge. Put it only on intermediate commits, or skip it entirely.

## Ops pointers

Authoritative sources are linked; do not restate them here.

- **Stack, runtime, providers, migrations**: [`docs/architecture/technical.md`](docs/architecture/technical.md). Migrations are additive-only (expand/contract over two deploys); CI runs migrations before deploy.
- **Commands**: [README.md](README.md) for dev/deploy/test; [`docs/quality/testing.md`](docs/quality/testing.md) for the full test strategy.
- **E2E policy**: test against production code — no test-only routes, flags, or secrets. Details in [`docs/quality/testing.md`](docs/quality/testing.md).
- Run the `/wrangler` skill before any `wrangler` command.

## Documentation

All docs are in English; app UI strings stay Vietnamese. `docs/README.md` is the documentation registry and authority map. Non-ADR, non-incident docs describe the latest approved target; only ADRs retain superseded decisions, and incidents retain non-normative history.
