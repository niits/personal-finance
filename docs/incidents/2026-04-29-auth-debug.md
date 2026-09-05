# 2026-04-29 - Auth Debug: GitHub OAuth Login Not Working In Local Dev

> Historical incident evidence. It may describe outdated implementation and is not a
> current contract. See [`architecture/technical.md`](../architecture/technical.md).

## Environment

- Next.js 16 (App Router) + TypeScript
- Cloudflare Workers via `@opennextjs/cloudflare`
- Better Auth 1.6.9
- Local dev: `npm run dev:cf` using the OpenNext Cloudflare preview

## Issue 1: Explicit Edge Runtime Crashes The Route Module

**Symptom:** `POST /api/auth/sign-in/social` returned 500. The bundle failed while
loading the auth route module.

**Root cause:** `export const runtime = "edge"` selected an incompatible Next.js load
path in the OpenNext bundle. Workers was already the deployment runtime.

**Fix:** Remove the explicit runtime export.

## Issue 2: The Kysely D1 Adapter Prevents Account Creation

**Symptom:** OAuth created a user but no provider account, and the next attempt failed
to link the account.

**Root cause:** Better Auth attempted its transaction flow through `kysely-d1`, whose
driver did not support transactions. The user insert happened before account creation
failed.

**Fix:** Give Better Auth the raw D1 binding so it uses its D1 adapter behavior; keep
application queries on Kysely separately.

## Issue 3: Auth Schema Columns Were Missing

**Symptom:** Provider account insertion still failed after the adapter correction.

**Root cause:** The Better Auth version wrote `accessTokenExpiresAt`,
`refreshTokenExpiresAt`, and `scope`, but the existing `account` table lacked them.

**Fix:** Add the three columns through migration `0002_account_tokens.sql` and apply it
to every environment.

## Resolution Order

1. Remove the explicit edge runtime declaration.
2. Use raw D1 for Better Auth.
3. Apply the auth schema migration.
4. Clean orphaned test data after preserving any required evidence.

## Lessons Carried Forward

- Workers is the runtime by deployment contract; do not add a conflicting Next runtime
  declaration.
- Verify Better Auth schema changes during dependency upgrades.
- Test user and provider-account creation together at the Worker/D1 boundary.
