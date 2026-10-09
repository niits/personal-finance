# AI Organize

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-10-08 |

## Purpose

AI Organize helps the user improve category structure, category emoji, transaction
classification, and transaction emoji without making unreviewed financial changes.

## Entry And Scope

- The labeled action appears on the current-month Dashboard.
- Analysis uses the authenticated user's recently updated noted transactions; the
  window boundary is defined in
  [`architecture/technical.md`](../architecture/technical.md).
- Preview never writes data.
- Category emoji suggestions cover every user category without an emoji retained
  by the complete proposal, including when there are no noted transactions. Sources
  proposed for deletion are omitted from emoji assignments.
- Newly suggested categories include an emoji in the preview and are created with
  that emoji.
- The feature is not a replacement for single-transaction editing.

## Proposal Policy

- Preserve reasonable classifications, category structure, names, and emoji. An empty
  proposal is valid when no clear correction is supported by the supplied data.
- Prefer existing categories, including an appropriate broader category. At least
  three similar noted transactions are necessary but insufficient for a new category;
  there must also be a distinct unmet classification need and at least three proposed
  moves to that new category.
- Consolidate duplicate meaning through an explicit merge into one existing leaf category.
  Duplicate categories must share type, parent, budget behavior, and usage meaning.
  Similar names in different branches and parent-child relationships do not establish
  duplication.
- Retain the eligible category with the most transactions; break ties by the smallest
  category ID. Do not rename or recreate the retained category.
- A merge transfers every transaction referencing the source, including historical
  transactions and transactions without notes, then deletes the source atomically.
  Amounts, dates, budgets, and finance associations are preserved. Only ordinary leaf
  categories may be merged; sources and targets cannot also be moved within the tree.
- Tree proposals change parent and sibling order for ordinary categories. Descendant
  levels are recalculated; the resulting tree must be acyclic, have at most three
  levels, preserve type, and keep categories with transactions as leaves.
- Structural proposals carry a complete category snapshot. Preview and Apply reject
  changed hierarchy, names, ordering, protection, emoji, or transaction counts.
- Emoji suggestions may use any Unicode emoji, including composed sequences and emoji
  outside the application's picker or existing data.
- Preserve ambiguous classifications and reasonable inherited emoji. Suggest a
  transaction emoji only when it is missing or clearly incorrect.

## Flow

1. The user starts analysis and receives plain-language progress.
2. Preview omits unchanged parent/order suggestions and rejects recategorization of
   protected finance movements. The complete patch must pass the Apply validator
   against the original analysis data before the server reads current data again.
   An invalid model proposal returns `AI_INVALID_PATCH` (`502`); only a proposal that
   was valid for the original data but no longer matches current data returns
   `STALE_PROPOSAL` (`409`). Preview never writes data.
3. A review surface groups proposals and allows independent selection, including
   emoji assignments for existing categories. Merges name the retained and deleted
   categories, affected transaction counts, and reasons. Tree changes show current and
   proposed parent and order; related tree changes are selected as one group.
4. Dependencies remain valid: selecting a move to a proposed category also selects
   that category; deselecting the category deselects dependent moves.
5. Apply revalidates the complete selection and commits it atomically.
   Database assertions guard changes between validation and commit. If relevant data
   changed since preview, Apply rejects the selection without partial writes and the
   user generates a new proposal.
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

- `merged_categories`
- `reorganized_categories`
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
