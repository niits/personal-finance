# ADR 002: Stay on Cloudflare Workers + D1

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-05-06 |
| Author | niits |
| Related | TECHNICAL_DESIGN.md §1 |

## Context

A full platform migration was proposed: Cloudflare Workers + D1 + better-auth + Workers AI → Firebase Auth + Firestore + Vercel + Gemini API.

The two motivating desires were:
- **Google Auth** instead of GitHub OAuth — lower barrier for non-developer users
- **Better structured JSON output** — Workers AI models (`kimi-k2.6`, `glm-4.7-flash`, `gemini-3-flash`) had been swapped repeatedly due to inconsistent structured output quality; Gemini was proposed as a stable replacement

Since `better-auth` manages its own tables in D1, replacing Firestore would require replacing `better-auth` with Firebase Auth. Since Firebase Admin SDK does not run on Cloudflare Workers edge runtime (requires Node.js APIs unavailable there), this would also require leaving Cloudflare Workers for Vercel — making it a full platform migration.

Estimated scope: ~10–11 engineering days, touching 10 API routes, the auth layer, the ORM, the entire DB schema, the deployment config, and all integration tests.

## Decision

Do not migrate to Firebase/Firestore/Vercel.

Implement the two motivating changes independently, without touching the platform:

1. **Google Auth** — change `better-auth` social provider from `github` to `google` in `src/lib/auth.ts`. ~20 minutes. Schema unchanged.
2. **Gemini API** — replace `workers-ai-provider` with `@ai-sdk/google` in `src/lib/llm.ts`. ~30 minutes. All AI route callers use the Vercel AI SDK abstraction (`generateText`, `generateObject`) and are unaffected.

## Rationale

The relational data model is a feature, not a liability. Every API query exploits SQL relationships — 3-way JOINs for category paths, FK constraints for referential integrity, `SUM`/`COALESCE` aggregates for dashboard math. Moving to Firestore would require denormalizing `categoryPath` and `rootCategoryName` into every transaction document at write time, validating referential integrity in application code, and reconstructing aggregates in memory that a single SQL query handles today.

Firebase's actual strengths — real-time listeners, client-side offline persistence, horizontal auto-scaling — do not apply to a single-user personal finance app. D1 free tier (5 GB storage, 25M reads/day, 50K writes/day) will not be reached at personal-app scale.

## Consequences

- Current stack is unchanged: Cloudflare Workers, D1, Kysely ORM, better-auth, `@opennextjs/cloudflare`
- All SQL migrations, integration tests, and wrangler config remain valid
- Google Auth and Gemini API changes are tracked as separate small tasks

## When to Revisit

| Trigger | Reason |
|---------|--------|
| Real-time sync required (e.g., shared household budget) | Firestore live listeners; polling is not a viable substitute |
| Offline mode required | Firestore client SDK has mature offline persistence; replicating with D1 would be significant custom work |
| D1 hits a hard technical limit | Full-text search, geospatial queries, or data volume beyond D1 capacity |
| Firebase ecosystem consolidation | Unified billing, monitoring, and auth across multiple existing projects |

If migrating away from D1, evaluate **Supabase (PostgreSQL + real-time)** first — SQL queries can be largely ported, only the driver changes. Firestore requires a data model rewrite.
