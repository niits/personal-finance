# Product Requirements

| Field | Value |
|---|---|
| Status | Active target |
| Product | Personal Finance Tracker |
| Updated | 2026-09-05 |

## Purpose

Personal Finance Tracker is a private, Vietnamese-first ledger for recording daily
money movement and understanding whether current spending remains safe. Each surface
should help the user answer: what changed, am I still okay, and what should I do next?

## Product Constraints

- The canonical experience is mobile-first and must work at 375px.
- Monetary amounts are positive integer VND values; transaction direction supplies
  the sign.
- Every user's data is isolated by their authenticated user ID.
- Google and GitHub are the supported target sign-in providers.
- The application runs on Cloudflare Workers with D1 storage.
- OpenAI supplies AI organization and narrative analysis through the configured
  gateway boundary.

## Required Capabilities

- Record, edit, and delete current or historical transactions.
- Organize transactions with a three-level income and expense category hierarchy.
- Track one working-day monthly budget and multiple open-ended custom budgets.
- Show monthly spending, remaining budget, unpaid card spending, and a pace-line chart
  on the Dashboard.
- Generate deterministic statistics and optional AI explanations.
- Track lending, borrowing, savings, card groups, and card statements without
  double-counting consumption.
- Preview and selectively apply AI organization proposals.
- Manage categories, budgets, authentication methods, and sign-out from Account.

Canonical domain rules are in [product behavior](./behavior/). AI Organize is defined
in [`features/ai-organize.md`](../features/ai-organize.md).

## Experience Requirements

- Recording a normal transaction should be possible in under ten seconds.
- Important amounts and consequences must never rely on color alone.
- Loading, empty, partial failure, error, long-content, unusual-value, keyboard, and
  destructive states are first-class requirements.
- Mobile uses reachable controls and safe-area-aware layouts; larger viewports retain
  the same reading order without becoming a wall of equal-weight cards.
- Visual and interaction rules follow [`design/calm-ledger.md`](../design/calm-ledger.md).

## Out of Scope

- Transaction filters or search.
- Account or transaction data export.
- Bank synchronization or automatic statement import.
- Multiple currencies.
- Recurring transactions and automatic bill payment.
- Shared household accounts or multi-user ledgers.
- Offline data mutation.
- Split card payments, partial statement payments, interest, fees, and installments.

## Glossary

| Term | Meaning |
|---|---|
| Consumption expense | An ordinary purchase that consumes monthly budget. |
| Finance movement | A debt or savings transaction excluded from consumption spending. |
| Monthly budget period | Stored working-day range associated with a month label. |
| Current effective limit | The current `monthly_budget.amount`, after adjustments. |
| Adjustment | Immutable audit entry explaining a change to a budget limit. |
| Card group | User-managed group whose purchases share a statement-close day. |
| Statement | Persisted card period with unpaid or paid status. |
| Pace line | Cumulative actual consumption compared with ideal budget pace. |
