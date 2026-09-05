# ADR 006: Use Private HTTP Revalidation For Editable Financial History

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-05 |
| Author | niits |
| Supersedes | [`ADR 001`](./001-api-caching-strategy.md) |
| Current contract | [`architecture/technical.md`](../architecture/technical.md) |

## Context

ADR 001 treated past months as immutable and allowed browsers to reuse them for 24
hours. The product permits direct creation, editing, recategorization, movement, and
deletion of historical transactions. Those operations can change Dashboard, budget,
pace, finance, card, and statistics projections on this or another device.

SWR invalidation in the mutating tab cannot guarantee correctness on another device.
Likewise, `must-revalidate` does not invalidate a response while its positive
`max-age` is still fresh. Financial data must not knowingly remain stale for that
freshness window.

## Decision

- Authenticated financial responses remain outside shared caches with
  `Cache-Control: private`.
- Mutable GET responses use `Cache-Control: private, no-cache` with a user- and
  query-specific `ETag`.
- `no-cache` allows private storage but requires successful origin revalidation before
  reuse. Matching validators return `304 Not Modified` without resending the payload.
- Validators change whenever representation-relevant data changes. The initial
  implementation may hash the final representation; a revision table is justified
  only if profiling shows response computation itself must be avoided.
- Successful mutations explicitly revalidate all affected SWR keys. Moving a
  transaction invalidates both its previous and new period projections.
- Responses that should not be retained or cannot provide safe validators use
  `no-store`. Streaming AI responses use `no-cache, no-transform`.
- No personalized response is cached at Cloudflare's shared edge by URL alone.

## Affected Projections

Transaction mutations may affect transactions, Dashboard, pace line, monthly and
custom budgets, finance accounts, card statements, categories, and statistics report
freshness. Mutation code owns a complete invalidation map rather than asking each
screen to infer dependencies.

## Alternatives Considered

### Keep Long `max-age` For Past Months

Rejected because historical data is editable and a fresh cached response is allowed
to remain stale.

### Invalidate SWR Only

Rejected as a correctness mechanism because SWR memory is local to one browsing
context.

### Version Every URL Through A Persisted Revision Table

Deferred. It can avoid expensive response recomputation, but adds persistence and
atomic version-management complexity before profiling demonstrates the need.

### Use `no-store` For Every Authenticated Response

Rejected as the default because it prevents conditional reuse and may impair browser
navigation behavior. It remains appropriate for especially sensitive or
non-revalidatable responses.

## Consequences

- Every reuse of mutable financial data checks the origin, ensuring cross-device
  correctness.
- Unchanged data avoids response-body transfer and parsing through `304`.
- D1 query work may still occur to construct the initial validator; optimization is a
  measured follow-up, not a correctness shortcut.
- Route and integration tests must cover validator changes and all affected periods.

## Sources

- [Cloudflare Origin Cache Control](https://developers.cloudflare.com/cache/concepts/cache-control/)
- [MDN: ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag)
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
