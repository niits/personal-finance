# Migration Analysis: Cloudflare → Firebase + Vercel

> Full brainstorm notes from a migration exploration session.
> Purpose: capture the full reasoning chain so the same ground doesn't need to be covered again.

---

## Starting point: what was proposed

Three changes bundled together under "migrate to Firebase":

1. **Google Auth** instead of GitHub OAuth
2. **Firebase / Firestore** as the backend database, replacing Cloudflare D1
3. **Gemini API** instead of Cloudflare Workers AI

The third clarification added: leaving Cloudflare Workers entirely, which makes Vercel the natural deployment target.

---

## Current stack (as of this writing)

```
Runtime:    Cloudflare Workers via @opennextjs/cloudflare
Framework:  Next.js 16 App Router + TypeScript
Database:   Cloudflare D1 (SQLite) — accessed via Kysely ORM
Auth:       better-auth v1.6 — GitHub OAuth, sessions stored in D1
AI:         Cloudflare Workers AI binding — workers-ai-provider + Vercel AI SDK
Deploy:     wrangler → Cloudflare Workers
```

Key files:
- `src/lib/auth.ts` — better-auth instance, lazy-initialized, reads Cloudflare env bindings
- `src/lib/db.ts` — wraps `getCloudflareContext()` to get D1 binding, returns Kysely instance
- `src/lib/llm.ts` — 8 lines, wraps Workers AI binding, returns a Vercel AI SDK-compatible model
- `src/lib/session.ts` — calls `auth.api.getSession()` from better-auth
- `src/app/api/auth/[...all]/route.ts` — delegates GET/POST to `auth.handler(request)`

The D1 schema has 11 tables: 4 owned by better-auth (`user`, `session`, `account`, `verification`) and 7 for app data (`transaction`, `category`, `monthly_budget`, `budget_adjustment`, `custom_budget`, `transaction_custom_budget`, `budget_config`, `ai_suggestion_run`).

---

## Change 1: Google Auth (instead of GitHub OAuth)

### What changes

`better-auth` supports Google OAuth natively with the same interface as GitHub. The change is in `src/lib/auth.ts:27`:

```ts
// Before
socialProviders: {
  github: {
    clientId: cfEnv.GITHUB_CLIENT_ID,
    clientSecret: cfEnv.GITHUB_CLIENT_SECRET,
  },
}

// After
socialProviders: {
  google: {
    clientId: cfEnv.GOOGLE_CLIENT_ID,
    clientSecret: cfEnv.GOOGLE_CLIENT_SECRET,
  },
}
```

D1 schema is unchanged. The `user`, `session`, `account`, `verification` tables are provider-agnostic — better-auth stores a `providerId` field in the `account` table, which changes from `"github"` to `"google"`, but the structure is identical.

Frontend: update `src/app/page.tsx` to call `signIn.social({ provider: "google" })` instead of `"github"`. Update the button label and icon.

### What doesn't change

Everything else. The session cookie mechanism, the `requireSession()` helper, all API routes, the database schema, the deployment config.

### Effort

~20–30 minutes. Create a Google OAuth app in Google Cloud Console, get client ID + secret, swap env vars in `.dev.vars` and `wrangler secret put`.

### Why this is worth doing independently of anything else

GitHub OAuth is a meaningful barrier for non-developer users. Anyone can log in with Google; not everyone has a GitHub account or wants to use it for a personal finance app. This is a pure UX improvement with near-zero engineering cost.

---

## Change 2: Gemini API (instead of Cloudflare Workers AI)

### Current AI setup

`src/lib/llm.ts` returns a Vercel AI SDK-compatible model from the Workers AI binding:

```ts
import { createWorkersAI } from "workers-ai-provider";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getModel() {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: (env as Cloudflare.Env & { AI: Ai }).AI });
  return workersai(process.env.CF_AI_MODEL ?? "@cf/moonshotai/kimi-k2.6");
}
```

The model has been changed several times in recent commits: `gemini-3-flash` → `glm-4.7-flash` → `kimi-k2.6`. This churn is a signal that Workers AI model quality for structured JSON output has been inconsistent.

### How AI is used in the app

Two routes use the AI:

- `POST /api/categories/suggest` — uses `generateText` with `Output.object({ schema: SuggestionSchema })`. Sends current categories + transaction notes, asks for new category suggestions.
- `POST /api/transactions/recategorize` — uses `generateObject` with `RecategorizeSchema`. Sends leaf categories + transactions, asks which transactions are miscategorized.

Both use Zod schemas and depend on the model producing valid structured JSON. This is exactly where model quality matters most.

### The swap

The Vercel AI SDK (`ai` package) abstracts the provider. Every caller uses `generateText` or `generateObject` — neither knows which model is underneath. Swapping the provider requires changing only `src/lib/llm.ts`:

```ts
// After
import { google } from "@ai-sdk/google";

export function getModel() {
  return google(process.env.GEMINI_MODEL ?? "gemini-2.0-flash");
}
```

Zero changes to the two AI routes. Add `GOOGLE_GENERATIVE_AI_API_KEY` to env. Remove `workers-ai-provider` and the `AI` binding from `wrangler.jsonc`.

### Why Gemini is better here

Gemini 2.0 Flash has significantly stronger structured output (JSON mode / function calling) than the Workers AI models that have been tried. The category suggestion and recategorization prompts are non-trivial — they require the model to reference valid IDs from a provided list and follow a schema strictly. This is a known strength of Gemini Flash.

Cost: Gemini 2.0 Flash is cheap (sub-cent per call at this data volume). Workers AI is billed per request too, so no meaningful cost difference.

### Effort

~30 minutes. Install `@ai-sdk/google`, update `llm.ts`, update `wrangler.jsonc` (remove `ai` binding), set the API key.

---

## Change 3: Firebase + Firestore as backend (instead of D1)

This is where the analysis got more complex and eventually reversed.

### Initial framing

The proposal was to replace D1 with Firestore as the primary data store. Since better-auth is tightly coupled to D1 (it manages `user`, `session`, `account`, `verification` tables in the same database), this would require replacing better-auth with Firebase Auth.

Since Firebase Admin SDK doesn't work cleanly in Cloudflare Workers edge runtime (relies on Node.js APIs not available there), this would also require moving off Cloudflare Workers — Vercel being the natural next host.

So "use Firestore" cascades into: Firestore + Firebase Auth + Vercel, a full platform migration.

### What would need to be rewritten

**Deleted entirely:**
- `wrangler.jsonc`
- `open-next.config.ts`
- `worker-configuration.d.ts`
- `migrations/` folder (6 SQL migration files)

**Packages removed:**
`@opennextjs/cloudflare`, `wrangler`, `@cloudflare/vitest-pool-workers`, `better-auth`, `@better-auth/cli`, `kysely`, `kysely-d1`, `workers-ai-provider`

**Packages added:**
`firebase-admin`, `firebase` (client), `@ai-sdk/google`, `zod` (explicit dep)

**Files rewritten from scratch:**

| File | Why it can't be ported |
|---|---|
| `src/lib/db.ts` | Firestore SDK replaces Kysely + D1Dialect |
| `src/lib/auth.ts` | Firebase ID token verification replaces better-auth |
| `src/lib/auth-client.ts` | Firebase `signInWithPopup` replaces better-auth client |
| `src/lib/session.ts` | Parse `Authorization: Bearer` header instead of cookie |
| `src/app/api/auth/[...all]/route.ts` | Deleted — Firebase Auth needs no server route |
| All 10 data API routes | Firestore queries replace all SQL/Kysely queries |
| `src/lib/schema.ts` | Firestore types replace Kysely table interfaces |

**Files that survive unchanged:**
`src/lib/validators.ts`, `src/lib/pace-line.ts`, `src/lib/holidays.ts`, `src/lib/errors.ts`, `src/lib/fetcher.ts`, all UI components, all dashboard pages.

### The Firestore data model

The relational schema can't be mapped 1:1. Key design decisions required:

**Denormalize category into transactions.** The current `transactions/route.ts` does a 3-way JOIN:
```
transaction → category → parent_category → grandparent_category
```
to produce `categoryPath` ("Ăn uống > Cà phê") and `rootCategoryName`. Firestore has no JOIN. Solution: embed `categoryName`, `categoryPath`, `rootCategoryName` in every transaction document at write time. Downside: if a category is renamed, all its transactions need a batch update.

**Replace junction table with embedded array.** `transaction_custom_budget` is a many-to-many table. In Firestore: embed `customBudgetIds: string[]` inside the transaction document. Downside: no referential integrity — deleting a custom budget doesn't automatically clean up references.

**Aggregations become in-memory.** `dashboard/route.ts` uses:
```sql
COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0)
```
Firestore has a native `sum()` aggregation (added 2023) but it requires careful composite indexing and can't split income vs expense in one query. Simpler to fetch all transactions in the period and aggregate in memory. Acceptable at personal-app scale (~100–500 transactions/month), but more code and one extra memory allocation per request.

**Proposed Firestore structure:**
```
users/{userId}/
  transactions/{txId}
    amount, type, note, date
    categoryId, categoryName
    categoryPath          ← denormalized "Parent > Child"
    rootCategoryName      ← denormalized
    monthlyBudgetId
    customBudgetIds[]     ← replaces junction table
    createdAt

  categories/{catId}
    name, type, level
    parentId, parentName  ← parentName denormalized
    sortOrder, createdAt

  monthlyBudgets/{budgetId}
    month, amount, startDate, endDate

  customBudgets/{budgetId}
    name, amount, isActive

  budgetConfig/default
    defaultMonthlyAmount

  aiSuggestionRuns/{runId}
    fromTxId, upToTxId, status
```

### New auth flow

```
Client                   Firebase Auth              Vercel API
  │                           │                         │
  ├─ signInWithPopup() ──→   │                         │
  │              ← ID token ─┤                         │
  │                           │                         │
  ├─ GET /api/transactions ──────────────────────────→ │
  │   Authorization: Bearer <id_token>                  │
  │                                         admin.auth().verifyIdToken()
  │                                         → uid → Firestore query
  │  ←──────────────────────────────────── response ──┤
```

No session table in the database. Firebase Auth manages token lifecycle client-side. The server becomes stateless with respect to auth.

**Seed user on first call.** Currently `databaseHooks.user.create.after` in better-auth seeds default categories when a new user is created. With Firebase Auth, there's no equivalent hook without Firebase Functions. Alternative: check if the user document exists in Firestore on the first authenticated API call, and seed if not. This adds ~1 Firestore read to every request until the user is seeded (only the very first call), then it's a cache miss once.

### Estimated effort

| Area | Estimate |
|---|---|
| Firebase project setup + Vercel project | 0.5 days |
| `db.ts`, `auth.ts`, `session.ts`, `llm.ts` | 0.5 days |
| Firestore data model design + seed logic | 1 day |
| Rewrite all 10 API routes | 4–5 days |
| Frontend auth update (Google login, token passing) | 0.5 days |
| Data migration script (D1 → Firestore) | 0.5 days |
| Integration tests (all D1-based tests need rewrite) | 3 days |
| **Total** | **~10–11 days** |

---

## The counter-argument: is this migration necessary?

After laying out the full scope, the question became: what problem is this migration actually solving?

### No stated pain point with the current stack

No production errors. No developer friction. No scaling issue. The recent commits show active development — the migration desire is forward-looking, not reactive to a real problem.

### The relational model is a feature, not a liability

Financial data has inherent structure: transactions belong to categories, categories have parents, transactions belong to budget periods, budgets have adjustments. Every query in the current codebase exploits these relationships — JOINs, FK lookups, aggregate math. SQL is the natural language for this.

Moving to Firestore means working *against* the data model: denormalizing relationships at write time, validating integrity in application code instead of the database, and reconstructing aggregates in memory that SQL provides in one pass.

### D1 free tier is more than sufficient

D1: 5 GB storage, 25M reads/day, 50K writes/day. A personal finance app with one active user will never approach these limits.

### Firebase's actual strengths don't apply here

| Firebase feature | Applies here? |
|---|---|
| Real-time listeners (auto-push updates to clients) | No — no multi-tab or multi-device sync requirement |
| Client-side offline cache + sync | No — not mentioned as a requirement |
| Horizontal auto-scaling | No — one user |
| Google ecosystem consolidation | Only if other apps already use Firebase |

### The two original desires are achievable without any migration

- Google Auth: 20 minutes, one line change in `src/lib/auth.ts`, better-auth supports it natively
- Gemini API: 30 minutes, 8-line file replacement in `src/lib/llm.ts`, Vercel AI SDK is already provider-agnostic

Total: ~1 hour. vs ~10–11 days for the full migration.

---

## Decision

**Do not migrate to Firebase/Firestore/Vercel.** The engineering cost is not justified by any concrete benefit for this use case.

**Do implement, as separate small changes:**
1. Google Auth via better-auth Google provider (20 min)
2. Gemini API via `@ai-sdk/google` (30 min)

---

## When to revisit

Revisit the Firebase migration if and only if one of these becomes true:

1. **Real-time sync is needed** — e.g., household finance shared between two people who both add transactions and want instant cross-device updates. Firestore's live listeners are the right tool for this; polling is not.

2. **Offline mode is needed** — e.g., adding transactions on the subway with no signal, syncing when back online. The Firestore client SDK has a mature offline persistence layer; replicating this with D1 would be substantial custom work.

3. **D1 hits a hard technical limit** — e.g., a feature requires full-text search, geospatial queries, or a data volume that exceeds D1 limits. At that point evaluate the specific need rather than a full platform swap.

4. **Project consolidates into a Firebase ecosystem** — e.g., the user already has Firebase projects for other apps and wants unified billing, monitoring, and auth management.

In none of these cases is Firestore the *only* option — Supabase (PostgreSQL + real-time) would be easier to migrate to from D1 because SQL queries can be largely ported, only the driver changes.
