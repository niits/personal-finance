# Personal Finance Tracker

> Mobile-first expense tracker for daily spending, monthly budgets, and pace-line visualization — built for iPhone, deployed on Cloudflare.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Cloudflare Workers · D1 (SQLite) · better-auth · Workers AI

---

## Features

- **Quick transaction entry** — record an expense or income in under 10 seconds; form auto-focuses the amount field on open
- **Pace line chart** — live comparison of cumulative spending vs. the ideal linear budget line; fill turns red when over pace
- **Monthly budgets** — one budget per period with mid-month adjustments and a full adjustment history
- **Custom budgets** — open-ended named budgets for trips or projects; one transaction can belong to multiple custom budgets
- **Hierarchical categories** — up to 3 levels; only leaf nodes are assignable to transactions
- **AI suggestions** — Cloudflare Workers AI integration for category and note suggestions
- **GitHub OAuth** — authentication via better-auth; each GitHub account is an isolated data silo

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
npm test                  # Unit + integration
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
│   ├── api/               # API routes
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── monthly-budgets/
│   │   ├── custom-budgets/
│   │   ├── dashboard/
│   │   ├── pace-line/
│   │   ├── budget-config/
│   │   └── ai-suggestion-runs/
│   └── dashboard/         # UI pages (home, categories, budgets)
├── components/            # Shared UI components
└── lib/                   # Business logic (validators, pace-line calc, auth, db, seed)
migrations/                # D1 schema migrations (applied in order)
docs/                      # Project documentation
```

---

## Documentation

| File | Description |
|------|-------------|
| [docs/BRD.md](docs/BRD.md) | Business requirements — data model, business rules, UI specs |
| [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) | Schema, API contracts, edge cases |
| [docs/TESTING.md](docs/TESTING.md) | Testing strategy — unit and integration setup |
| [DESIGN.md](DESIGN.md) | Design system — color tokens, typography, spacing (read before writing any UI) |
