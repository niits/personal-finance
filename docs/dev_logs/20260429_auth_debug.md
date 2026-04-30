# 2026-04-29 — Auth Debug: GitHub OAuth login not working in local dev

## Environment

- Next.js 16 (App Router) + TypeScript
- Cloudflare Workers via `@opennextjs/cloudflare`
- Better Auth 1.6.9
- Local dev: `npm run dev:cf` → `opennextjs-cloudflare preview -- --port 8787`

---

## Issue 1: `export const runtime = "edge"` crashes the route module

**Symptom:** `POST /api/auth/sign-in/social` → 500. Wrangler log shows no error details. Next.js bundle log: `TypeError: Cannot read properties of undefined (reading 'default')` at `interopDefault` → `loadComponentsImpl`.

**Root cause:** `export const runtime = "edge"` in `src/app/api/auth/[...all]/route.ts` causes Next.js to load the module through a different code path (edge runtime). In the OpenNext/Cloudflare bundle, that code path fails and the module returns `undefined`. `interopDefault(undefined)` → throws.

**Fix:** Remove `export const runtime = "edge"`. In the Workers environment all routes run on the Workers runtime by default — no explicit declaration is needed.

---

## Issue 2: `kysely-d1` does not support transactions → account never created

**Symptom:** After a successful GitHub callback, the DB has a `user` row but the `account` table is empty. The next login attempt returns `error=unable_to_link_account`.

**Root cause:**
- Better Auth wraps `createOAuthUser` (creates user + account) inside `runWithTransaction()`
- `runWithTransaction` calls `adapter.transaction()` → Kysely calls `driver.beginTransaction()` → `kysely-d1` throws `'Transactions are not supported yet.'`
- Because there is no real transaction, the user was already INSERTed before the error occurred → orphaned user
- `account` is never created

**Fix:** Drop `kysely-d1` and pass the raw D1 object directly to `database`:
```ts
// BEFORE (broken):
database: { dialect: new D1Dialect({ database: cfEnv.DB }), type: "sqlite" }

// AFTER (correct):
database: cfEnv.DB
```
Better Auth auto-detects D1 (`"batch" in db && "exec" in db && "prepare" in db`) and uses its internal `D1SqliteDialect` with `transaction: void 0` → adapter-base patches `transaction = async (cb) => cb(adapter)` (no-op fallback, safe).

---

## Issue 3: Schema migration missing columns → SQLite error on account INSERT

**Symptom:** Even after fix #2, account still not created. DB still orphaned.

**Root cause:** Migration `0001_auth_schema.sql` was generated from an older version of Better Auth. Better Auth 1.6.9 inserts 3 new columns into the `account` table when storing OAuth tokens:
- `accessTokenExpiresAt`
- `refreshTokenExpiresAt`
- `scope`

The old schema did not have these 3 columns → SQLite throws "table account has no column named accessTokenExpiresAt" → INSERT fails → account never created.

**Fix:** Create migration `0002_account_tokens.sql`:
```sql
ALTER TABLE `account` ADD COLUMN `accessTokenExpiresAt` integer;
ALTER TABLE `account` ADD COLUMN `refreshTokenExpiresAt` integer;
ALTER TABLE `account` ADD COLUMN `scope` text;
```
Apply to both local (`--local`) and remote (`--remote`).

---

## Fix Order Summary

1. Remove `export const runtime = "edge"` from the auth route
2. Use raw `cfEnv.DB` instead of the `kysely-d1` D1Dialect
3. Run migration `0002_account_tokens.sql` on both local and remote DB
4. Clean up orphaned data: `DELETE FROM user; DELETE FROM session; DELETE FROM account;`

---

## Lessons Learned

- Do not use `export const runtime = "edge"` with Cloudflare Workers + OpenNext — Workers runtime is the default.
- `kysely-d1` is incompatible with Better Auth because it does not support transactions. Use the raw D1 object so Better Auth manages it internally.
- When upgrading Better Auth, always verify the schema migration includes all required columns — run `npx @better-auth/cli generate` to compare.
