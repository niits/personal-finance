# Technical Architecture

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## System Context

The Next.js 16 App Router application is compiled with `@opennextjs/cloudflare` and
runs inside a Cloudflare Worker. Cloudflare D1 stores application and Better Auth
data. Kysely with the D1 adapter is the query layer. OpenAI models are called through
the configured AI gateway boundary.

## Runtime Boundaries

- Access bindings per request through `getCloudflareContext({ async: true })`.
- Access D1 through `env.DB`; client components never access Worker bindings.
- Use only APIs supported by the configured Cloudflare compatibility layer.
- Do not use `eval` or `Function`; Vega expressions use `vega-interpreter`.
- Never cache a request, session, or Cloudflare context in module scope.
- Secrets stay in Worker environment bindings and never enter client bundles or docs.

## Authentication And Authorization

Better Auth is the authentication framework. Google and GitHub are both target social
providers and may link to one user according to Better Auth's verified-account rules.

Every `/api/*` route except `/api/auth/*` must resolve a session for the request and
scope every read and mutation to `session.user.id`. Scheduler-only entry points require
their explicit bearer secret. Cookie-based route guarding is only an optimistic UX
boundary; API authorization remains authoritative.

See [`ADR 007`](../decisions/007-authentication-and-ai-providers.md).

## Canonical Application Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard and transaction ledger |
| `/statistics` | Narrative statistics and AI insights |
| `/finance` | Debt, savings, and card overview |
| `/finance/accounts/:id` | Finance-account detail and movement history |
| `/account` | Management, providers, and session actions |
| `/account/budget` | Monthly and custom budget management |
| `/account/categories` | Category management |

Legacy `/cards`, `/debts`, `/budget`, and `/categories` paths redirect permanently to
their canonical destination. Account export is not part of the route or API contract.

## Data Model

| Entity | Target responsibility and invariant |
|---|---|
| Better Auth tables | Users, sessions, provider accounts, and verification records. |
| `category` | User-owned three-level income/expense hierarchy with protected system kinds and consumption behavior. |
| `transaction` | Positive VND movement associated with category, budget, custom budgets, finance account, or card group as required by its kind. |
| `monthly_budget` | One row per user/month label; stored period boundaries; `amount` is the current effective limit. |
| `budget_adjustment` | Immutable audit row; never added again when reading the effective limit. |
| `budget_config` | Default amount for newly created monthly periods. |
| `custom_budget` | Open-ended target with active state. |
| `custom_budget_adjustment` | Audit history for target changes. |
| `finance_account` | Debt or savings metadata; balance is derived from transactions. |
| `credit_card_group` | User-managed group and statement-close day. |
| `credit_card_statement` | Immutable period boundaries plus unpaid/paid metadata. |
| AI suggestion/report tables | Review windows and generated statistics state. |

Legacy `debt` storage may remain during migration but is not part of the target domain
contract. Migration changes use expand/contract deployment and preserve user data.

## API Conventions

- Dates use `YYYY-MM-DD`; month labels use `YYYY-MM`.
- Monetary values are positive integer VND amounts.
- Validation failures use `422`; missing sessions use `401`; ownership-safe missing
  resources use `404`; uniqueness or state conflicts use `409`.
- Error bodies use a stable machine-readable code and Vietnamese recovery message.
- Multi-row mutations that express one user action are atomic.

## API Families

| Family | Target operations |
|---|---|
| `/api/auth/*` | Better Auth handlers for Google and GitHub. |
| `/api/categories` | Read, seed, create, update, and guarded delete. |
| `/api/transactions` | Full selected-period read and direct create/edit/delete. No filter/search contract. |
| `/api/monthly-budgets` | Read/create period, update effective limit/objective, and append adjustment audit. |
| `/api/custom-budgets` | Read/create/update and guarded delete with adjustment history. |
| `/api/budget-config` | Read/update future-period default. |
| `/api/dashboard` | Monthly outcome, card subset, pace summary, and daily cumulative inputs. |
| `/api/pace-line` | Ideal and actual cumulative consumption for Dashboard. |
| `/api/statistics` | Read and generate deterministic-metric-backed reports. |
| `/api/finance-accounts` | Account metadata and derived movement history. |
| `/api/credit-card-groups` | Group metadata, statements, and purchase summaries. |
| `/api/credit-card-statements/:id/pay` | Mark one owned statement paid in full. |
| `/api/ai/organize` | Produce a reviewable proposal without writes. |
| `/api/ai/organize/apply` | Atomically apply selected changes and return counts. |

There are no target `/api/debts`, transaction link/unlink, or account-export APIs.
Finance-account association is part of transaction create/edit.

## AI Organize Apply Contract

`POST /api/ai/organize` has no request body. Analysis covers the user's most recently
updated transactions that carry a non-empty note, up to a documented cap. The preview
response shape is:

```ts
type OrganizePreview = {
  new_categories: Array<{
    temp_id: `new:${number}`;
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    example_notes: string[];
  }>;
  emoji_assignments: Array<{
    category_id: number;
    current_emoji: string | null;
    emoji: string;
  }>;
  recategorizations: Array<{
    transaction_id: number;
    note: string;
    current_category_id: number;
    current_category_name: string;
    suggested_category_id: number | `new:${number}`;
    suggested_category_name: string;
    reason: string;
  }>;
  emoji_reassignments: Array<{
    transaction_id: number;
    note: string;
    current_emoji: string | null;
    emoji: string;
    reason: string;
  }>;
};
```

`POST /api/ai/organize/apply` receives selected subsets of those four arrays. Every
temporary category reference must resolve to a selected `new_categories` item. The
server compares current ownership, transaction category, current emoji, hierarchy,
type, and leaf state with the submitted preview; a stale or incompatible selection
returns `409` without writes.

A successful apply returns counts rather than a bare success flag:

```json
{
  "created_categories": 2,
  "emoji_updated": 5,
  "transactions_moved": 8
}
```

The server revalidates ownership, hierarchy depth, category type, leaf eligibility,
and proposal references inside one atomic operation. Detailed interaction semantics
are in [`features/ai-organize.md`](../features/ai-organize.md).

## Cache And Revalidation

Authenticated financial responses are personalized and must never enter shared CDN
caches. Mutable GET responses use `Cache-Control: private, no-cache` and a user- and
query-specific `ETag`. A stored response may be reused only after successful
revalidation; unchanged representations return `304 Not Modified`.

Mutations revalidate all affected SWR keys immediately and invalidate both old and new
period projections when dates or classification change. Streaming AI responses use
`no-cache, no-transform`; responses that cannot be safely retained use `no-store`.

This policy follows [`ADR 006`](../decisions/006-http-revalidation-for-editable-history.md).

## OpenAI Boundary

OpenAI is the target model provider. Model IDs and gateway routing are deployment
configuration rather than product behavior. The semantic layer computes all financial
arithmetic before model invocation. Optional telemetry must flush with the Worker
execution context and must not expose secrets or cross-user data.
