# Personal Finance Tracker

> Mobile-first expense tracker for daily spending, monthly budgets, and pace-line visualization — built for iPhone, deployed on Cloudflare.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1 (SQLite) · better-auth · AI SDK

---

## Features

- **Quick transaction entry** — record an expense or income in under 10 seconds; form auto-focuses the amount field on open
- **Budget pace** — plain-language comparison of spending against the working-day budget period
- **Monthly budgets** — one budget per period with mid-month adjustments and a full adjustment history
- **Custom budgets** — open-ended named budgets for trips or projects; one transaction can belong to multiple custom budgets
- **Hierarchical categories** — up to 3 levels; only leaf nodes are assignable to transactions
- **AI organization and insights** — reviewable categorization changes and narrative monthly analysis
- **Google and GitHub OAuth** — target authentication via better-auth with strict per-user data isolation

---

## Local Development

```bash
npm install

# Next.js dev server (fast refresh, no Workers runtime)
npm run dev          # → http://localhost:3000

# Cloudflare Workers preview (matches production runtime exactly)
npm run dev:cf       # → http://localhost:8787
```

Copy `.dev.vars.example` to `.dev.vars` and fill in the values:

```bash
cp .dev.vars.example .dev.vars
```

```ini
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Apply migrations to the local D1 database:

```bash
wrangler d1 migrations apply personal-finance-auth
```

---

## Build & Deploy

```bash
npm run build:cf     # Build for Cloudflare Workers via opennextjs
npm run deploy:cf    # Build + deploy to production
```

Production deploys automatically via GitHub Actions on push to `main` — migrations run first, deploy second, so a failed migration leaves the old code running safely.

---

## Tests

```bash
npm test                  # Unit tests
npm run test:unit         # Vitest / Node runtime
npm run test:integration  # Vitest / Cloudflare Workers runtime
```

---

## Database Migrations

```bash
# Local
wrangler d1 migrations apply personal-finance-auth

# Production
wrangler d1 migrations apply personal-finance-auth --remote --env production
```

Schema rules: only additive changes (`ADD COLUMN`, new tables). Use the expand/contract pattern across two deploys for renames or removals — see `CLAUDE.md` for details.

---

## Project Structure

```
src/
├── app/
│   ├── api/               # Authenticated API route families
│   └── (app)/             # Authenticated UI pages
├── components/            # Layered UI components and stories
├── lib/                   # Domain logic, auth, data, and AI boundaries
└── workers/               # Scheduled Worker entry points
migrations/                # D1 schema migrations (applied in order)
docs/                      # Canonical current contracts and ADR history
```

---

## Documentation

| File | Description |
|------|-------------|
| [docs/README.md](docs/README.md) | Documentation registry, authority rules, and task entry points |
| [docs/product/requirements.md](docs/product/requirements.md) | Latest product scope, capabilities, and exclusions |
| [docs/design/calm-ledger.md](docs/design/calm-ledger.md) | Visual and interaction system |
| [docs/architecture/technical.md](docs/architecture/technical.md) | Runtime, data, API, auth, provider, and cache contracts |
| [docs/quality/testing.md](docs/quality/testing.md) | Unit, integration, Storybook, and E2E strategy |
