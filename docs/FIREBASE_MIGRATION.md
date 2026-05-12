# Firebase Migration Plan

**Status:** Draft
**Owner:** niits
**Last reviewed:** 2026-05-10
**Scope:** Replace the entire Cloudflare stack (Workers, D1, Workers AI, Better-auth, `@opennextjs/cloudflare`, `wrangler`) with Firebase-native equivalents (App Hosting, Firestore, Firebase Authentication, Gemini API) and add a PWA layer.

> Documentation source-of-truth links are listed at the bottom of this file. Treat any external snippet quoted here as a starting point — re-check the canonical docs at execution time, since Firebase products iterate quickly.

---

## 1. Goals & non-goals

### Goals
- 100% feature parity with the current app (dashboard, transactions, budgets, custom budgets, categories, AI suggestions, AI re-categorize, pace line). UI strings stay in Vietnamese.
- No Cloudflare runtime dependencies. No `wrangler`, `@opennextjs/cloudflare`, `kysely-d1`, `workers-ai-provider`, `better-auth`, D1, KV, R2 in `package.json` after the cutover.
- Auth via **Google Sign-In** (Firebase Authentication) instead of GitHub OAuth (Better-auth).
- AI via **Gemini API** (Vercel AI SDK + `@ai-sdk/google`).
- Add a real PWA layer: Web App Manifest + service worker (precache + network-first for `/api`).
- Single-user data is migrated end-to-end without loss; cutover is a one-shot, scheduled maintenance window.

### Non-goals
- No new product features in this migration.
- No real-time/offline sync of writes (read-side offline only).
- No multi-region failover; a single region is fine for a personal app.
- No Web Push notifications in the initial cutover (Next.js docs cover this; can be added post-migration if needed).

---

## 2. Target architecture

| Concern | Today (Cloudflare) | Target (Firebase) |
|---|---|---|
| Compute / SSR | Cloudflare Workers via `@opennextjs/cloudflare` | **Firebase App Hosting** (managed Cloud Run + CDN, native Next.js 13.5+ adapter) |
| Database | D1 (SQLite) + Kysely | **Cloud Firestore** (Native mode) via `firebase-admin` on the server |
| AI | Workers AI binding (`env.AI`) → `workers-ai-provider` → `@cf/moonshotai/kimi-k2.6` | **Gemini API** via `@ai-sdk/google` → `gemini-2.5-flash` (default) |
| Auth | Better-auth + GitHub OAuth + custom `user/session/account/verification` tables | **Firebase Authentication** (Google provider) + **session cookies** issued via Admin SDK |
| Static assets | Workers Assets | App Hosting CDN |
| Secrets | `wrangler secret put` | **Google Cloud Secret Manager**, referenced from `apphosting.yaml` |
| CI/CD | GitHub Actions → `wrangler-action` | **App Hosting** auto-rollouts on push to live branch (Developer Connect); GitHub Actions retained only for tests + Firestore migration script |
| Local dev | `next dev` and `opennextjs-cloudflare preview` | `next dev` + **Firebase Local Emulator Suite** (Auth + Firestore) |
| Deploy gating | `d1 migrations apply` before deploy | One-shot Firestore data migration script + idempotent seed; security rules deploy with `firebase deploy --only firestore:rules,firestore:indexes` |

**Architecture invariant:** All Firestore reads/writes happen on the server (Next.js Route Handlers and middleware) using **Admin SDK**. The browser only uses the client SDK for sign-in (Google popup) and to read its own auth state. This keeps security rules trivial as defense-in-depth, and lets us keep the existing API surface for the UI.

---

## 3. Data model design (D1 → Firestore)

### 3.1 Why subcollections under `users/{uid}`

- Security rules become trivial and recursive: `match /users/{uid}/{document=**}` with `request.auth.uid == uid`.
- All app queries are already user-scoped (`where user_id = ?`); subcollections remove that filter and the related composite index.
- Admin SDK bypasses rules anyway — rules act as defense-in-depth.

### 3.2 Layout

```
users/{uid}                               # mirrored profile (name, email, image, createdAt)
  ├── budgetConfig/default                # { defaultMonthlyAmount: number, updatedAt: Timestamp }
  ├── categories/{categoryId}             # { name, parentId|null, level, sortOrder, type, createdAt }
  ├── monthlyBudgets/{budgetId}           # { month: "2026-05", amount, startDate|null, endDate|null, createdAt }
  │     └── adjustments/{adjId}           # { delta, note, createdAt }
  ├── customBudgets/{budgetId}            # { name, amount, isActive: boolean, createdAt }
  ├── transactions/{txId}                 # { amount, type: "expense"|"income", categoryId,
  │                                       #   note|null, date: "YYYY-MM-DD",
  │                                       #   monthlyBudgetId|null, customBudgetIds: string[],
  │                                       #   createdAt: Timestamp, updatedAt: Timestamp }
  └── aiSuggestionRuns/{runId}            # { fromUpdatedAt|null, upToUpdatedAt, status, createdAt }
```

### 3.3 Field mapping

| SQL column | Firestore field | Notes |
|---|---|---|
| `id INTEGER AUTOINCREMENT` | `doc.id: string` | Frontend type changes from `number` → `string` for entity IDs. |
| `created_at INTEGER` (`unixepoch()`) | `createdAt: Timestamp` (`FieldValue.serverTimestamp()`) | Use `.toMillis()` if epoch ms is needed for response payloads. |
| `transaction.monthly_budget_id` FK | `monthlyBudgetId: string \| null` | No DB-level FK; validate at the route layer with Zod. |
| `transaction_custom_budget` join table | `customBudgetIds: string[]` (array on the transaction) | Query with `array-contains`. Denormalized; deletes of a custom budget must update all linked transactions. |
| CHECK constraints | Zod validators at route entry + Firestore Rules | We lose CHECK at the storage layer; the route is the new gate. |
| Indexes (`idx_transaction_user_date` etc.) | `firestore.indexes.json` (see §5) | Single-field indexes are auto-created; composites must be declared. |

### 3.4 Aggregation strategy

Firestore has **no `GROUP BY`** and no `SUM(CASE WHEN ...)`. Three patterns cover everything we need:

1. **Server-side aggregates** for simple totals: [`getAggregateFromServer`](https://firebase.google.com/docs/firestore/query-data/aggregation-queries) supports `count()`, `sum()`, `average()`. Use for `total_expense`, `total_income` per period when we don't also need the row data:
   ```ts
   const snap = await txCol(uid)
     .where("date", ">=", periodStart).where("date", "<=", periodEnd)
     .where("type", "==", "expense")
     .aggregate({ total: AggregateField.sum("amount") })
     .get();
   ```
2. **Read-and-aggregate-in-Node** for queries that need row-level data anyway (the `dashboard` daily-expense bucketing and the AI feed). Volume is tiny (≤ a few hundred docs/month for a personal account), so a single `.get()` and a `Map` reduce is the simplest correct path.
3. **Avoid write-time aggregation docs** for now. They add write-amplification and a Cloud Function trigger; not worth the complexity until the data set grows materially.

---

## 4. Auth migration (Better-auth → Firebase Authentication)

### 4.1 Sign-in flow

```
[Browser]                                       [Server (Next.js Route Handler)]
  | signInWithPopup(googleProvider)                |
  | -> firebase/auth issues idToken                |
  | POST /api/auth/session  { idToken }            |
  |----------------------------------------------->|
  |                                                | adminAuth.verifyIdToken(idToken)
  |                                                | adminAuth.createSessionCookie(idToken, { expiresIn: 14d })
  |                                                | Set-Cookie: __session=<jwt>; HttpOnly; Secure; SameSite=Lax
  |<-----------------------------------------------|
  | redirect /dashboard                            |
```

Reference pattern from the [Manage Session Cookies](https://firebase.google.com/docs/auth/admin/manage-cookies) doc:

```ts
const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
cookies().set("__session", sessionCookie, {
  maxAge: expiresIn / 1000,
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
});
```

> **Why `__session`?** Firebase Hosting and App Hosting reserve the cookie name `__session` for cookies that should pass through their CDN cache layer. Using any other name will be stripped at the edge for cached responses. App Hosting follows the same convention.

### 4.2 Verification on every protected route

```ts
// src/lib/session.ts
import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";

export async function requireSession(_request: Request) {
  const cookie = (await cookies()).get("__session")?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true /* checkRevoked */);
    return { user: { id: decoded.uid, email: decoded.email, name: decoded.name } };
  } catch {
    return null;
  }
}
```

Keep the **existing return shape** (`{ user: { id, email, name } }`) so the 63 call sites that read `session.user.id` need no refactor.

### 4.3 Middleware

Update `src/middleware.ts` to check the new cookie name (`__session`). The presence check stays edge-only and lightweight; full verification (with `checkRevoked`) still happens in `requireSession`.

### 4.4 Sign-out

```ts
export async function DELETE() {
  const cookie = (await cookies()).get("__session")?.value;
  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie);
      await adminAuth.revokeRefreshTokens(decoded.sub);
    } catch { /* ignore */ }
  }
  cookies().delete("__session");
  return new Response(null, { status: 204 });
}
```

### 4.5 New-user seeding

Today seeding runs in `betterAuth.databaseHooks.user.create.after`. Move it to the session-cookie POST handler:

```ts
const userRef = adminDB.collection("users").doc(decoded.uid);
const snap = await userRef.collection("budgetConfig").doc("default").get();
if (!snap.exists) await seedNewUser(adminDB, decoded.uid);
```

This is idempotent and avoids race conditions across tabs.

### 4.6 Files removed / changed

| File | Action |
|---|---|
| `src/lib/auth.ts` (Better-auth instance) | **Delete** |
| `src/app/api/auth/[...all]/route.ts` | **Delete** |
| `src/lib/auth-client.ts` | **Replace** with Firebase client SDK + Google provider |
| `src/lib/session.ts` | **Rewrite** (signature unchanged) |
| `src/middleware.ts` | **Edit** cookie name only |
| `src/app/page.tsx`, `src/components/Navbar.tsx` | **Edit** sign-in button label/icon (GitHub → Google), use new `useAuth()` hook |
| `src/lib/seed.ts` | Keep logic; swap Kysely calls for Admin SDK writes |
| `migrations/0001_auth_schema.sql`, `0002_account_tokens.sql` | **Delete** (no longer needed) |

---

## 5. Firestore setup

### 5.1 `firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Per Firebase docs, **server (Admin) SDK bypasses rules entirely** and authenticates via Application Default Credentials (ADC). Production traffic from our Route Handlers is authenticated through ADC; rules are defense-in-depth for the (unused) client SDK path.

### 5.2 `firestore.indexes.json`

```json
{
  "indexes": [
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "date", "order": "ASCENDING" }, { "fieldPath": "type", "order": "ASCENDING" } ] },
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "updatedAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "transactions", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "categoryId", "order": "ASCENDING" }, { "fieldPath": "date", "order": "DESCENDING" } ] },
    { "collectionGroup": "aiSuggestionRuns", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] }
  ],
  "fieldOverrides": []
}
```

Single-field indexes (`month`, `isActive`) are auto-managed.

### 5.3 Server access helpers

```ts
// src/lib/firebase-admin.ts
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
export const adminAuth = getAuth(app);
export const adminDB = getFirestore(app);
```

```ts
// src/lib/firestore.ts
import { adminDB } from "./firebase-admin";
export const userDoc = (uid: string) => adminDB.collection("users").doc(uid);
export const txCol = (uid: string) => userDoc(uid).collection("transactions");
export const categoryCol = (uid: string) => userDoc(uid).collection("categories");
export const monthlyBudgetCol = (uid: string) => userDoc(uid).collection("monthlyBudgets");
export const customBudgetCol = (uid: string) => userDoc(uid).collection("customBudgets");
export const aiRunCol = (uid: string) => userDoc(uid).collection("aiSuggestionRuns");
export const budgetConfigDoc = (uid: string) => userDoc(uid).collection("budgetConfig").doc("default");
```

---

## 6. AI: Workers AI → Firebase AI Logic (Gemini)

### 6.1 Provider

**Implementation:** Uses **Firebase AI Logic** (`firebase/ai`) — included in the existing `firebase` package, no additional install needed.

```bash
# Remove the old providers (already done):
npm rm workers-ai-provider @anthropic-ai/sdk @ai-sdk/google ai
```

```ts
// src/lib/llm.ts
import { getApp, initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import type { Schema } from "firebase/ai";

function getAIApp() {
  try { return getApp("ai"); }
  catch {
    return initializeApp(
      { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID! },
      "ai",
    );
  }
}

export function getModel(opts: { systemInstruction?: string; responseSchema?: Schema }) {
  const ai = getAI(getAIApp(), { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
    ...(opts.responseSchema
      ? { generationConfig: { responseMimeType: "application/json", responseSchema: opts.responseSchema } }
      : {}),
  });
}
```

**No separate API key needed.** `GoogleAIBackend` authenticates via the Firebase project's public API key (`NEXT_PUBLIC_FIREBASE_API_KEY`). No Secret Manager secret is required for AI.

**Named secondary app (`"ai"`):** The `firebase` client SDK has a global app registry. Using a named app avoids collision with the default app that might be initialised on the browser side, and allows the AI init to run safely in Next.js server route handlers without `"use client"`.

### 6.2 Route changes

Both AI routes (`categories/suggest`, `transactions/recategorize`) now:

1. Declare a `Schema.object({...})` response schema using Firebase AI Logic's typed schema builder.
2. Call `getModel({ systemInstruction, responseSchema })` to get a configured `GenerativeModel`.
3. Call `model.generateContent(prompt)` — returns a `GenerateContentResult`.
4. Parse `result.response.text()` as JSON and validate with Zod.

Example pattern:

```ts
import { Schema } from "firebase/ai";
import { getModel } from "@/lib/llm";

const MySchema = Schema.object({
  properties: {
    items: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string({ description: "..." }),
          type: Schema.enumString({ enum: ["income", "expense"] }),
        },
        required: ["name", "type"],
      }),
    }),
  },
  required: ["items"],
});

const model = getModel({ systemInstruction: SYSTEM_PROMPT, responseSchema: MySchema });
const result = await model.generateContent(userContent);
const data = MyZodSchema.parse(JSON.parse(result.response.text()));
```

`gemini-2.5-flash` with `responseMimeType: "application/json"` + `responseSchema` enforces structured output at the model level. Zod is used as a second validation gate after parsing.

### 6.3 Prompts

Vietnamese system prompts are unchanged. `Schema` descriptions (replacing Zod's `.describe()`) are passed inline in the schema builder and sent as part of the response schema to guide the model.

### 6.4 `apphosting.yaml` change

The `GOOGLE_GENERATIVE_AI_API_KEY` secret entry is removed. The `GEMINI_MODEL` env var is retained for model version pinning.

---

## 7. PWA layer

### 7.1 Manifest (App Router native)

Per [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), the manifest is a file convention.

```ts
// src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal Finance",
    short_name: "Finance",
    description: "Theo dõi chi tiêu cá nhân — đơn giản, đẹp, không phán xét.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0066cc",          // matches DESIGN.md primary
    orientation: "portrait",
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

Generate icons (192, 512, maskable-512, 180 for iOS) with `realfavicongenerator.net` and place in `public/icons/`. Wire `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />` in `src/app/layout.tsx`.

### 7.2 Service worker

We use a **hand-written `public/sw.js`** (no plugin) for the smallest blast radius. Caching strategy:

| Path pattern | Strategy | Rationale |
|---|---|---|
| Static assets (`/_next/static/*`, `/icons/*`) | Cache-first, immutable | Hashed URLs |
| HTML routes (`/`, `/dashboard/*`) | Network-first, fallback to cached `app shell` | SSR drives the truth, fall back when offline |
| `/api/*` | **Network-only** (no cache) | Mutations and live data |
| `/api/auth/*` | **Bypass SW entirely** | Avoid any session-cookie caching surprises |

```js
// public/sw.js — minimal sketch
const CACHE = "pf-shell-v1";
const SHELL = ["/", "/dashboard", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return; // network-only

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      }))
    );
    return;
  }

  // network-first for HTML
  event.respondWith(
    fetch(event.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); return res; })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match("/")))
  );
});
```

### 7.3 Registration

Client component mounted in the root layout:

```tsx
// src/components/ServiceWorkerRegistrar.tsx
"use client";
import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(console.error);
  }, []);
  return null;
}
```

### 7.4 Headers

`next.config.ts`:

```ts
async headers() {
  return [
    { source: "/sw.js", headers: [
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ]},
    { source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]},
  ];
}
```

The `sw.js` `no-cache` header is critical — App Hosting sits behind a CDN, and a stale service worker can silently break the entire app for installed users.

### 7.5 What we deliberately skip in v1

- **Web Push notifications** (VAPID, `web-push`) — defer until there's a notification use case.
- **Background Sync** — same.
- **Workbox / `next-pwa` / Serwist** — none are required; the hand-written SW is ~40 lines and easier to audit.

---

## 8. Hosting & deployment

### 8.1 `apphosting.yaml`

Per [App Hosting configuration reference](https://firebase.google.com/docs/app-hosting/configure):

```yaml
runConfig:
  cpu: 1
  memoryMiB: 512
  maxInstances: 3
  minInstances: 0
  concurrency: 80

env:
  - variable: NEXT_PUBLIC_APP_URL
    value: https://personal-finance.web.app
    availability: [BUILD, RUNTIME]
  - variable: GEMINI_MODEL
    value: gemini-2.5-flash
    availability: [RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: <public-web-api-key>
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: personal-finance.firebaseapp.com
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: personal-finance
    availability: [BUILD, RUNTIME]
  - variable: GOOGLE_GENERATIVE_AI_API_KEY
    secret: gemini-api-key
    availability: [RUNTIME]
```

Notes:
- App Hosting auto-injects `FIREBASE_CONFIG` and `FIREBASE_WEBAPP_CONFIG`, plus ADC for Admin SDK. **No service account JSON in the repo.**
- The Web API key is **public** by design (it identifies the project, not a user); committing it is fine.
- Secrets via Secret Manager are referenced by short name and resolved per-instance at runtime.

Provision the secret:
```bash
firebase apphosting:secrets:set gemini-api-key
firebase apphosting:secrets:grantaccess gemini-api-key --backend personal-finance
```

### 8.2 Staging

Per [multiple environments](https://firebase.google.com/docs/app-hosting/multiple-environments) docs: create a second backend (`personal-finance-staging`) bound to a `staging` branch, plus an `apphosting.staging.yaml` override:

```yaml
env:
  - variable: NEXT_PUBLIC_APP_URL
    value: https://personal-finance-staging.web.app
```

Same secret name, different version pin if you want isolation.

### 8.3 GitHub integration

App Hosting connects to GitHub via **Developer Connect**. After the initial console setup:
- Push to `main` → build → rollout to production backend.
- Push to `staging` → build → rollout to staging backend.

This **replaces** the existing `cloudflare/wrangler-action` deploy job.

### 8.4 What stays in GitHub Actions

| Workflow | Keep / drop | Reason |
|---|---|---|
| `test` job in `deploy.yml` | **Keep** (rename file `ci.yml`) | Vitest unit + integration |
| `deploy` job in `deploy.yml` | **Drop** | App Hosting handles it |
| `deploy-staging.yml` | **Drop** | App Hosting handles it |
| `sync-prod-to-staging.yml` | **Rewrite** | New script that copies Firestore docs prod → staging using Admin SDK |
| Firestore rules + indexes deploy | **New job** | `firebase deploy --only firestore:rules,firestore:indexes` on push to `main`, using Workload Identity Federation |

### 8.5 Workload Identity Federation

Replace the Cloudflare API token secret with WIF — no long-lived service account key in GitHub:
```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/.../providers/github
    service_account: gh-actions@personal-finance.iam.gserviceaccount.com
- uses: w9jds/firebase-action@master
  with:
    args: deploy --only firestore:rules,firestore:indexes
```

---

## 9. Local development

| Component | Local setup |
|---|---|
| Next.js | `npm run dev` (unchanged) |
| Auth + Firestore | `firebase emulators:start --only auth,firestore` |
| Gemini | Real Gemini API with a personal key in `.env.local` (no emulator); free tier covers dev volume |
| Service worker | `next dev --experimental-https` to test SW registration over HTTPS locally |

Wire Admin SDK to emulators via env vars:
```
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

The `firebase-admin` SDK auto-detects these and skips ADC.

---

## 10. Data migration script

`scripts/migrate-d1-to-firestore.ts` — run once during the cutover window.

### 10.1 Prerequisites
- A service-account JSON with Firestore Editor on the **production** project (used only by this script, not committed; deleted after cutover).
- Latest D1 export: `wrangler d1 export personal-finance-auth --remote --output=dump.sql --env=production`.

### 10.2 Steps

1. Parse `dump.sql` (or per-table `wrangler d1 execute --json` exports). Build in-memory tables.
2. **Map the user**: today's only user → look up the same email in Firebase Auth (after the user's first Google sign-in into the new project), grab the `uid`. The Better-auth user `id` (random string) becomes irrelevant; the new `uid` is canonical.
3. Build ID maps (old `INTEGER` → new Firestore `string` id) for `category`, `monthly_budget`, `custom_budget`, `transaction`.
4. Import order (respect FKs):
   1. `users/{uid}/budgetConfig/default`
   2. `users/{uid}/categories/*` — parents first (level 1), then children (level 2+), rewriting `parentId` via the ID map.
   3. `users/{uid}/monthlyBudgets/*`
   4. `users/{uid}/monthlyBudgets/{newId}/adjustments/*` (from `budget_adjustment`)
   5. `users/{uid}/customBudgets/*`
   6. `users/{uid}/transactions/*` — denormalize `transaction_custom_budget` into `customBudgetIds: string[]`; rewrite `categoryId` and `monthlyBudgetId` via the ID maps.
   7. `users/{uid}/aiSuggestionRuns/*`
5. Use `BulkWriter` (Admin SDK) for throughput; chunk to ≤500 ops/batch.
6. Verify counts: `db.collection('cities').count().get()` — old SQL counts should equal new Firestore counts per collection.

### 10.3 Rollback
- The script is idempotent (uses deterministic doc IDs derived from old PKs, e.g. `tx_${oldId}`) so a re-run overwrites cleanly.
- Cloudflare D1 is left untouched until a successful 24-hour observation window; deletion is the last step (§12).

---

## 11. API route migration

Migration order (low → high risk). Each route keeps **the same response shape** so the UI ships unchanged in the same PR.

| Route | Risk | Notes |
|---|---|---|
| `GET/PUT /api/budget-config` | Low | Single doc read/write |
| `GET/POST /api/categories` | Low | Subcollection list/create |
| `PUT/DELETE /api/categories/[id]` | Low | Reject delete if any child exists (`where('parentId','==',id).limit(1).get()`) |
| `POST /api/categories/seed` | Low | Reuse `seedNewUser()` |
| `GET/POST /api/monthly-budgets` + `[id]` | Med | Enforce uniqueness on `month` via pre-query |
| `GET/POST /api/custom-budgets` + `[id]` | Med | On delete, batch-update transactions to remove from `customBudgetIds` (`FieldValue.arrayRemove(id)`) |
| `GET/POST/PUT/DELETE /api/transactions` | Med | `updatedAt: serverTimestamp()` on every write |
| `GET /api/pace-line` | High | Read txs in period, group by `date` in JS |
| `GET /api/dashboard` | High | Largest test surface; verify all derived fields against the old D1 output |
| `POST /api/categories/suggest` | High | Gemini path |
| `POST /api/transactions/recategorize` | High | Gemini path + `runTransaction` to flip `aiSuggestionRuns/{id}.status` atomically |
| `POST /api/ai-suggestion-runs/[id]` (apply) | High | Batched category updates + run.status in `runTransaction` |

### Pattern (no refactor of validation or shape)

```ts
// Before (Kysely / D1)
const db = await getKysely();
const rows = await db.selectFrom("transaction").where("user_id","=",uid).where("date",">=",start).execute();

// After (Firestore)
const snap = await txCol(uid).where("date",">=",start).get();
const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
```

Zod schemas, error helpers, and HTTP status codes are unchanged.

---

## 12. Cutover plan

Single user, low-traffic — a 30-minute maintenance window is enough.

| Step | Action |
|---|---|
| T-7d | Stand up Firebase project, App Hosting backend connected to a `firebase-migration` branch. Verify SSR boots with the new auth + an empty Firestore. |
| T-3d | All API routes ported and green on staging Firestore. Run end-to-end smoke against staging via the actual UI. |
| T-1d | Deploy security rules + indexes to prod Firestore. Communicate the maintenance window. |
| T-0 | Freeze writes to prod Cloudflare (visible "Đang bảo trì" banner). Run final D1 export. Run migration script against **prod** Firestore. Verify counts. Update DNS/Custom domain to App Hosting. Sign in with Google to validate auth + dashboard. |
| T+1d | Monitor: App Hosting logs + Firestore usage + Gemini quota. |
| T+7d | Decommission Cloudflare: delete worker (`wrangler delete`), delete D1 databases (`wrangler d1 delete personal-finance-auth` and staging), revoke API tokens, remove `wrangler.jsonc`, `.dev.vars*`, `worker-configuration.d.ts`, and CF deps from `package.json`. |
| T+7d | Delete the migration service-account key. Rotate any GitHub secrets that referenced Cloudflare. |

---

## 13. Dependencies diff

```diff
# package.json — dependencies
- "@anthropic-ai/sdk": "^0.93.0",
- "@better-auth/cli": "^1.4.21",
- "better-auth": "^1.6.9",
- "kysely": "^0.28.16",
- "kysely-d1": "^0.4.0",
- "workers-ai-provider": "^3.1.13",
- "ai": "^6.x",
- "@ai-sdk/google": "^2.x",
+ "firebase": "^11.x",          # includes firebase/ai — no extra install
+ "firebase-admin": "^13.x",

# devDependencies
- "@cloudflare/vitest-pool-workers": "^0.8.71",
- "@opennextjs/cloudflare": "^1.19.4",
- "wrangler": "^4.86.0",
+ "firebase-tools": "^14.x",
```

`next`, `react`, `zod`, Tailwind, TypeScript, Vitest stay. `ai` (Vercel AI SDK) and `@ai-sdk/google` are fully removed — replaced by `firebase/ai`.

---

## 14. Files to delete

```
wrangler.jsonc
open-next.config.ts
worker-configuration.d.ts
.dev.vars
.dev.vars.example
.wrangler/
.open-next/
src/lib/auth.ts
src/lib/db.ts
src/app/api/auth/[...all]/route.ts
migrations/                 # SQLite, no longer needed (kept in git history)
.github/workflows/deploy-staging.yml
```

---

## 15. Files to create

```
firebase.json
.firebaserc
apphosting.yaml
apphosting.staging.yaml
firestore.rules
firestore.indexes.json
src/lib/firebase-admin.ts
src/lib/firebase-client.ts
src/lib/firestore.ts
src/app/api/auth/session/route.ts
src/app/manifest.ts
src/components/ServiceWorkerRegistrar.tsx
public/sw.js
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/icon-maskable-512.png
public/icons/apple-touch-icon.png
scripts/migrate-d1-to-firestore.ts
scripts/sync-prod-to-staging-firestore.ts
.github/workflows/ci.yml          # rename of deploy.yml; only tests + firestore deploy
```

---

## 16. Testing

| Layer | Today | After |
|---|---|---|
| Unit (`vitest.unit.config.ts`) | Pure logic (`pace-line`, `validators`, `fetcher`) | Unchanged |
| Integration | `@cloudflare/vitest-pool-workers` against miniflare + D1 | **Replace** with Firebase emulators (`firebase emulators:exec`); use a thin test setup that initializes `firebase-admin` against the emulator endpoints |

Drop `tests/integration/global-setup.ts` Cloudflare bits; new global setup boots the emulators (or asserts they're already running) and seeds a known fixture user.

---

## 17. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Firestore aggregation cost or latency surprises on dashboard | Personal-scale data is well within free tier; pre-measure with a representative export before cutover. |
| Gemini structured output drift on Vietnamese prompts | Keep Vercel AI SDK's repair on; add a post-validation Zod check; fall back to "no suggestions" rather than 5xx. |
| Service worker caches a broken build | `Cache-Control: no-cache` on `sw.js` + bumping `CACHE` constant on every release; document a "force reload" step. |
| Cookie name collision / CDN strip | Use `__session` exclusively; never store anything else under that name. |
| Lost CHECK constraints (e.g. `expense ⟺ monthly_budget_id NOT NULL`) | Codify as Zod refinements in route handlers; add an integration test per constraint. |
| `id: number` → `id: string` ripple through the UI | Single PR that ports routes + types together; TypeScript will surface every site. |
| ADC misconfiguration in App Hosting | Verify `applicationDefault()` works in the runtime by exposing a `/api/health` route that does a 1-doc Firestore read on first deploy. |

---

## 18. Sources

- [Firebase App Hosting — Get started](https://firebase.google.com/docs/app-hosting/get-started)
- [Firebase App Hosting — Configure (`apphosting.yaml`)](https://firebase.google.com/docs/app-hosting/configure)
- [Firebase App Hosting — Multiple environments](https://firebase.google.com/docs/app-hosting/multiple-environments)
- [Firebase App Hosting — Frameworks & tooling](https://firebase.google.com/docs/app-hosting/frameworks-tooling)
- [Firebase App Hosting GA announcement (April 2025)](https://firebase.blog/posts/2025/04/apphosting-general-availability/)
- [Firebase Auth — Manage Session Cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Firestore — Aggregation queries](https://firebase.google.com/docs/firestore/query-data/aggregation-queries)
- [Firestore — Security rules structure](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Firestore — Write-time aggregations](https://firebase.google.com/docs/firestore/solutions/aggregation)
- [Vercel AI SDK — Google Generative AI provider](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)
- [Gemini API — Vercel AI SDK example](https://ai.google.dev/gemini-api/docs/vercel-ai-sdk-example)
- [Next.js — PWA guide (App Router)](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js — `manifest.ts` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
- [Firebase — Use Firebase in a PWA](https://firebase.google.com/docs/web/pwa)
