# Category Management Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Task

Understand and maintain the income and expense hierarchy without breaking existing
transactions or protected financial behavior.

## Composition

Expense and income are explicit content modes. The hierarchy exposes at most three
levels and makes leaf assignability understandable. Add, rename, reorder, emoji, and
delete actions remain contextual to a node.

Protected system categories identify why they cannot be renamed or deleted. Used or
non-leaf categories explain why deletion is blocked and what recovery is available.
AI-applied categories appear in the same hierarchy without a separate visual grammar.

Domain rules are owned by
[`product/behavior/categories.md`](../../product/behavior/categories.md).

## States

Cover initial loading, seeded and unseeded empty states, partial failure, long names,
maximum depth, protected/used nodes, mutation pending/error, destructive confirmation,
and unavailable network. Tree semantics and control names must remain accessible.
