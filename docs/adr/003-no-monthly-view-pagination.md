# ADR 003: No Pagination for Monthly Transaction View

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-05-02 |
| Author | niits |
| Related | TECHNICAL_DESIGN.md §4.3, BRD TXN-06 |

## Context

`GET /api/transactions` fetches all transactions for the selected month with no `LIMIT`. The question arose whether to add pagination preemptively. As of 2026-05-02, production had 9 transactions total.

## Decision

No pagination for the monthly transaction view. The API returns all transactions for the month in a single query.

## Rationale

A calendar month is a natural upper bound — 28 to 31 days. A personal finance user's realistic transaction volume is 50–150 per month. D1/SQLite handles this in a single query with no performance concern.

Date-group headers already break the list into digestible visual chunks. Pagination controls (infinite scroll or page buttons) would add UI complexity with no user benefit at this data volume.

## Consequences

- `GET /api/transactions` returns the full month in one response
- No `cursor`, `page`, or `limit` parameters on the monthly view
- No client-side list virtualization needed

## When Pagination Would Be Needed

- An all-time history view with no time bound
- Search results without a date filter

## If Pagination Is Ever Added

Use **cursor-based pagination**, not offset:

```sql
WHERE id < :cursor ORDER BY id DESC LIMIT 50
```

D1/SQLite does not optimize large `OFFSET` queries. Offset-based pagination degrades linearly as the dataset grows. Cursor-based pagination remains constant-time regardless of position.
