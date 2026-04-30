# Personal Finance Tracker

A mobile-first web app for tracking daily income and expenses, managing monthly budgets, and visualizing spending progress via a pace line chart.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Cloudflare Workers · D1 (SQLite) · better-auth

---

## Features

- Record income/expense transactions with hierarchical categories (up to 3 levels)
- Monthly budget with pace line chart (actual spending vs. planned)
- Custom budgets for specific goals (trips, projects, etc.)
- GitHub OAuth authentication
- Mobile-first UI optimized for iPhone

---

## Local Development

```bash
npm install
npm run dev          # Next.js dev server → http://localhost:3000
npm run dev:cf       # Cloudflare Workers local preview → http://localhost:8787
```

Create a `.dev.vars` file with the required environment variables:

```
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## Build & Deploy

```bash
npm run build:cf     # Build for Cloudflare Workers (via opennextjs)
npm run deploy:cf    # Build + deploy to production
```

Production deploys automatically via GitHub Actions on push to `main`.

---

## Database

```bash
# Apply migrations locally (D1 local)
wrangler d1 migrations apply personal-finance-auth

# Apply migrations on production
wrangler d1 migrations apply personal-finance-auth --remote --env production
```

---

## Tests

```bash
npm test                  # Unit + integration
npm run test:unit         # Unit tests (Vitest / Node)
npm run test:integration  # Integration tests (Vitest / Cloudflare Workers runtime)
```

---

## Documentation

| File | Description |
|------|-------------|
| [docs/BRD.md](docs/BRD.md) | Business requirements — data model, business rules, UI specs |
| [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) | Technical design — schema, API contracts, edge cases |
| [docs/FLOWS.md](docs/FLOWS.md) | Sequence diagrams for all major user flows |
| [docs/TESTING.md](docs/TESTING.md) | Testing strategy — unit and integration setup |
| [docs/API_CACHE.md](docs/API_CACHE.md) | Caching strategy — HTTP Cache-Control headers and SWR |
| [DESIGN.md](DESIGN.md) | Design system — color tokens, typography, spacing |

---

## Project Structure

```
src/
├── app/
│   ├── api/          # API routes (categories, transactions, dashboard, ...)
│   └── dashboard/    # UI pages (home, transactions, budget, categories)
├── components/       # Shared components (TransactionForm, Navbar)
└── lib/              # Business logic (validators, pace-line, auth, db, seed)
migrations/           # D1 schema migrations
docs/                 # Project documentation
```
