# API Caching Strategy

## Overview

The app uses two complementary cache layers:

1. **HTTP `Cache-Control` headers** — the browser caches responses automatically, avoiding repeat server calls
2. **SWR (stale-while-revalidate)** — in-memory client cache that deduplicates requests and invalidates on mutation

---

## HTTP Cache-Control Headers

### Categories

```
Cache-Control: private, max-age=3600, stale-while-revalidate=300
```

- `private` — browser-local cache only; Cloudflare CDN does not cache (data is per-user)
- `max-age=3600` — serve from cache for up to 1 hour
- `stale-while-revalidate=300` — after 1 hour, serve stale data immediately while fetching fresh data in the background (within 5 minutes)

### Transactions

Past and current months are treated differently:

| Case | Cache-Control |
|------|---------------|
| Current month | `private, max-age=30, stale-while-revalidate=120` |
| Past month (immutable) | `private, max-age=86400` |

Past months are treated as **immutable** — transactions cannot be modified retroactively, so a 24-hour cache is safe.

### Dashboard

Same strategy as transactions:

| Case | Cache-Control |
|------|---------------|
| Current month | `private, max-age=60, stale-while-revalidate=300` |
| Past month | `private, max-age=86400` |

---

## SWR Client-Side Cache

Used for `/api/categories` because it is fetched in multiple places:
- `CategoriesPage` — displays and manages the category tree
- `TransactionForm` — category picker when logging a transaction

### Cache key

```ts
const CATS_KEY = "/api/categories"
```

Both components share the same key → share one cache entry → only one network request.

### Invalidation

After any mutation (add category, seed), call:

```ts
mutate("/api/categories")
```

SWR broadcasts to all components subscribed to that key — both consumers receive fresh data without any explicit coordination between them.

### Conditional fetching in TransactionForm

```ts
useSWR(open ? "/api/categories" : null, fetcher)
```

Passing `null` as the key when the form is closed suspends fetching. When the form opens, if the cache is still fresh from a prior `CategoriesPage` visit, data is returned immediately with no network request.

---

## Seed Categories

`POST /api/categories/seed` calls `seedNewUser()` for the current user.
The function uses `INSERT OR IGNORE`, making it idempotent — safe to call multiple times.

The "Create sample categories" button is shown only when `cats.length === 0`. After seeding, `mutate(CATS_KEY)` invalidates the cache so the new categories appear immediately.
