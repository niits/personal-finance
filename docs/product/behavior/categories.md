# Category Behavior

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Hierarchy

- Categories belong to one user and to either income or expense.
- The hierarchy has at most three levels. A child has the same type as its parent.
- Only leaf categories may be assigned to consumption transactions.
- Sibling order is explicit and stable.
- Emoji is optional and may be inherited for presentation; a transaction-level emoji
  may override it without changing classification.

## Protected Categories

System categories represent non-budget finance behavior. Their system kind, type, and
budget behavior are protected from user mutation. They are excluded from consumption
spending and may be used only by compatible finance movements.

## Mutation Rules

- A user may create and rename ordinary categories within the depth and type rules.
- A category with children or referenced transactions cannot be deleted.
- Deleting a category never cascades into transaction history.
- Seed operations are user-scoped and idempotent.
- AI-created categories pass the same hierarchy, ownership, uniqueness, and type
  validation as manually created categories.

## Cross-Domain Effects

Changing category classification or transaction category invalidates consumption,
budget, pace, and statistics projections. UI composition is defined in
[`design/surfaces/categories.md`](../../design/surfaces/categories.md); AI proposal
behavior is defined in [`features/ai-organize.md`](../../features/ai-organize.md).
