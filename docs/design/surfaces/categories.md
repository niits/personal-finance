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

A secondary “Sắp xếp lại cây danh mục” action requests an AI proposal for both income
and expense trees. An inline review lists the full current and proposed paths, sibling
positions, and reasons. The user applies the complete tree or cancels; preview does
not write data. Pending, no-change, retryable error, stale proposal, and successful
count states are explicit. The apply action is disabled after a stale conflict until
a new proposal is generated. The review wraps at 375px and announces progress and results.

Domain rules are owned by
[`product/behavior/categories.md`](../../product/behavior/categories.md).

## States

Cover initial loading, seeded and unseeded empty states, partial failure, long names,
maximum depth, protected/used nodes, mutation pending/error, destructive confirmation,
and unavailable network. Tree semantics and control names must remain accessible.
