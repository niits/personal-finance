# Budget Management Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

How much can I still spend while staying within my plan, and how should I adjust it?

## Composition

Lead with the current period outcome: remaining or exceeded amount, consumed amount,
current effective limit, and pace. Creating a missing period is the dominant action.

Adjustment UI expresses increase or decrease, requires a reason, previews the resulting
positive limit, and presents adjustment rows as audit history. It never asks the user
to recalculate the base amount.

Custom budgets show amount before percentage, target history, active state, linked
spending, and clear blocked-deletion recovery. Default budget configuration is framed
as a value for future periods.

## States

Cover missing, unused, exactly exhausted, exceeded, inactive, historical, adjusted,
pending mutation, duplicate submission, blocked deletion, partial failure, and network
failure. Use semantic text or icons in addition to progress color.
