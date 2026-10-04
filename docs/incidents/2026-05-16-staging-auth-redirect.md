# 2026-05-16 - Staging Auth Redirect Regression

> Historical incident evidence. It may describe outdated implementation and is not a
> current contract. See [`architecture/technical.md`](../architecture/technical.md).

## Summary

On HTTPS staging, a user completed sign-in but was redirected back to `/sign-in` when
visiting `/`. Local behavior did not reproduce consistently.

## Symptom

- Unauthenticated `/` correctly redirected to `/sign-in?from=/`.
- After sign-in, `/` still redirected to `/sign-in`.
- The sign-in page already used `/` as the post-login destination.

## Investigation

The deployed route guard recognized only the plain Better Auth cookie name:

```ts
request.cookies.get("better-auth.session_token")
```

HTTPS deployments may use a secure-prefixed name such as
`__Secure-better-auth.session_token`. The guard therefore treated a valid secure
session as unauthenticated.

## Root Cause

Optimistic route guarding was coupled to one cookie name rather than Better Auth's
cookie normalization.

## Resolution

1. Use `getSessionCookie(request)` from `better-auth/cookies` for optimistic routing.
2. Keep authoritative authorization in protected server boundaries with
   `auth.api.getSession(...)`.
3. Test plain, secure-prefixed, and library-supported cookie variants.

## Rejected Workarounds

- Client-side redirect hacks.
- Reverting to legacy routes.
- Bypassing middleware on `/`.
- Staging-only authorization exceptions.

## Validation

- Unauthenticated `/` redirects to sign-in.
- Authenticated `/sign-in` redirects to `/`.
- Authenticated `/` remains on `/` over HTTPS.
