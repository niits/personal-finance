# 2026-05-16 — Staging auth redirect regression

> Sanitized debugging note. This document intentionally omits environment-specific URLs, account identifiers, tokens, and other sensitive deployment details.

## Summary

On the HTTPS staging environment, a user could complete sign-in successfully and still be redirected back to `/sign-in` when visiting `/`.

Local development did not show the same behavior consistently, which made the issue appear environment-specific at first.

## Symptom

- Unauthenticated request to `/` correctly redirects to `/sign-in?from=/`
- After sign-in, navigation to `/` still redirects back to `/sign-in`
- The sign-in page itself already points authenticated users to `/`

## What was checked

1. The deployed sign-in page was confirmed to use `/` as the post-login destination.
2. The deployed middleware was inspected.
3. Live HTTP behavior was compared using different session cookie name variants.

## Key observation

The deployed route guard only recognized the plain Better Auth session cookie name:

```ts
request.cookies.get("better-auth.session_token")
```

That is not sufficient for HTTPS deployments, where Better Auth may use secure-prefixed cookie names such as:

- `__Secure-better-auth.session_token`

As a result:

- the app treated a plain session cookie as authenticated
- the app treated secure-prefixed session cookies as unauthenticated

This explains why the authenticated browser could still be redirected to `/sign-in` in staging.

## Root cause

The route guard was coupled to a single cookie name and did not normalize Better Auth session cookie variants used in secure environments.

The regression was in middleware/session-cookie detection, not in the sign-in page redirect target.

## Correct fix

The proper fix is to stop manually parsing Better Auth cookie names in the route guard and use the library helper designed for this purpose:

1. Replace the hardcoded cookie lookup with `getSessionCookie(request)` from `better-auth/cookies`.
2. Keep middleware/proxy limited to optimistic redirect decisions only.
3. Continue doing real session validation in API routes and other protected server boundaries with `auth.api.getSession(...)`.
4. Add unit coverage that proves the route guard now accepts the plain, `__Secure-`, and hyphenated session cookie variants handled by the library helper.

## What not to do

These are not acceptable fixes:

- adding client-side redirect hacks to mask middleware failure
- changing the app back to legacy routes
- bypassing middleware on `/`
- adding staging-only auth exceptions

Those approaches hide the bug instead of fixing the auth boundary correctly.

## Validation after the fix

- Unit test the cookie matcher against all supported cookie-name variants
- Re-run auth redirect E2E coverage locally
- Verify on HTTPS staging that:
  - unauthenticated `/` redirects to `/sign-in`
  - authenticated `/sign-in` redirects to `/`
  - authenticated `/` stays on `/`
