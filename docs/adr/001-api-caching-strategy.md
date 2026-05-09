# ADR 001: API Caching Strategy

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-04-29 |
| Author | niits |
| Related | TECHNICAL_DESIGN.md §4, BRD NFR-P04, NFR-P05 |

## Context

The app makes per-user API calls for categories, transactions, and dashboard data. Two problems to solve:

1. Categories are fetched in at least two places simultaneously — `CategoriesPage` and `TransactionForm`. Without coordination, both components issue independent network requests for the same data.
2. Past-month transaction and dashboard data is immutable once the month ends. Fetching it repeatedly wastes round-trips to Cloudflare Workers + D1.

## Decision

Use two complementary cache layers:

### Layer 1 — HTTP `Cache-Control` headers (server → browser)

| Endpoint | Case | Header |
|----------|------|--------|
| `GET /api/categories` | Always | _(no header — see note below)_ |
| `GET /api/transactions` | Current month | `no-store` |
| `GET /api/transactions` | Past month | `private, max-age=86400` |
| `GET /api/dashboard` | Current month | `no-store` |
| `GET /api/dashboard` | Past month | `private, max-age=86400` |

`GET /api/categories` no longer sets a `Cache-Control` header (removed in commit `e37daf6` — disk caching caused stale category trees that were hard to invalidate reliably). SWR in-memory cache is the only caching layer for categories.

Current-month endpoints use `no-store` (was `stale-while-revalidate`). Transactions and dashboard data change on every write; serving stale data even briefly produced incorrect summaries and budget bars.

Past months use `private, max-age=86400` — data is immutable once the budget period ends.

### Layer 2 — SWR in-memory cache (component → component)

Used for `/api/categories` only — the one resource consumed by multiple components at the same time.

```ts
const CATS_KEY = "/api/categories"
```

Both `CategoriesPage` and `TransactionForm` share this key → share one cache entry → one network request regardless of how many components mount.

After any mutation (add, rename, seed):

```ts
mutate("/api/categories")
```

SWR broadcasts to all subscribers — both consumers receive fresh data without explicit coordination.

Conditional fetch in `TransactionForm`:

```ts
useSWR(open ? "/api/categories" : null, fetcher)
```

Passing `null` when the form is closed suspends fetching. When the form opens, if the cache is still fresh from a prior `CategoriesPage` visit, data is returned immediately with no network round-trip.

## Consequences

- `GET /api/categories` has no HTTP cache — only SWR in-memory. Cache lifetime is the page session; navigating away clears it.
- Current-month transactions and dashboard are never cached by the browser (`no-store`). Every navigation triggers a fresh fetch.
- Past-month transaction and dashboard data is cached for 24 hours in the browser. Never re-fetched after the first load.
- After any category mutation, callers **must** call `mutate("/api/categories")` explicitly to refresh the SWR in-memory cache.
- `Cache-Control` headers apply only to `GET` routes. `POST`, `PATCH`, and `DELETE` routes must not set them.
