# AI Organize

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Purpose

AI Organize helps the user improve category structure, category emoji, transaction
classification, and transaction emoji without making unreviewed financial changes.

## Entry And Scope

- The labeled action appears on the current-month Dashboard.
- Analysis uses the authenticated user's recently updated noted transactions; the
  window boundary is defined in
  [`architecture/technical.md`](../architecture/technical.md).
- Preview never writes data.
- The feature is not a replacement for single-transaction editing.

## Flow

1. The user starts analysis and receives plain-language progress.
2. The server returns proposed new categories, emoji changes, and recategorizations.
3. A review surface groups proposals and allows independent selection.
4. Dependencies remain valid: selecting a move to a proposed category also selects
   that category; deselecting the category deselects dependent moves.
5. Apply revalidates the complete selection and commits it atomically.
6. The client shows returned counts and revalidates affected categories, transactions,
   Dashboard, budgets, and statistics state.

## Review Contract

Every proposal explains the current value, proposed value, and affected object. Full
category, transaction, and reason text remains available; ellipsis cannot be the only
way to access meaning. The user may select all, select none, or change individual
items before applying.

## Apply Result

The API wire schema is owned by
[`architecture/technical.md`](../architecture/technical.md). Success reports:

- `created_categories`
- `emoji_updated`
- `transactions_moved`

An empty selection is a valid no-op only when the review surface clearly states that
nothing will change.

## Failure Recovery

Preview failure appears near the initiating Dashboard action with a retry. Apply
failure keeps the review open, preserves the selection, explains that no partial
change was committed, and offers retry. Expired session and unavailable network are
distinct from a model or validation failure.

## Accessibility

The review has a named dialog/sheet, predictable focus order, explicit checkbox
labels, non-color selection cues, and focus restoration. Count summaries are announced
after successful apply.

## Acceptance Scenarios

- Preview returns no useful proposals.
- One or several proposal groups are selected.
- A proposed category has dependent transaction moves.
- Long Vietnamese category and transaction names remain accessible.
- Apply returns exact counts and refreshes affected data.
- Preview and apply failures can be retried without losing context.
- The server rejects stale, cross-user, invalid-depth, non-leaf, or type-incompatible
  references without partial writes.

## Non-Goals

- Automatic writes without review.
- A separate AI category-management page.
- AI arithmetic or financial recommendations inside this workflow.
