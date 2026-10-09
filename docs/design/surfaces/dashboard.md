# Dashboard Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

What direction is my money moving this month, am I still within plan, and what should
I do next?

## Reading Order

1. Selected budget period through an inline month picker, with the current-month AI
   Organize action as a compact pill beside it.
2. Consumption spending for the period, labeled against the monthly budget amount
   (`hạn mức`).
3. Segmented progress bar of consumption against the budget. The amber segment is the
   unpaid-card subset; a labeled `Dư nợ thẻ tín dụng` line states the amount. When
   consumption exceeds the limit, the bar turns danger red and a textual `Vượt hạn mức`
   cue accompanies it — color is never the only cue.
4. Primary floating add-transaction action at the bottom-right, above bottom navigation.
5. Full reverse-chronological transaction ledger grouped by date.

The pinned header and summary stay visible while the ledger scrolls, on a solid
surface with a hairline divider (no frosted glass).

The ledger has no filter or search control. A row opens edit/delete actions; it never
offers a separate finance-account link action.

## States

Cover loading, no budget, no transactions, partial summary/ledger failure, background
refresh, exactly exhausted, over budget, reverse financial values, long labels, and
network failure. Independent regions fail independently. AI Organize does not replace
the primary transaction action.

## AI Organize Review

The review uses the shared Calm Ledger sheet grammar. Proposed merges precede tree
changes, new categories, emoji, and transaction corrections. Each merge displays the
source, retained category, all affected transaction counts, deletion consequence, and
reason. Related parent and order changes are selected as one structural group; every
row exposes the category, current parent/order, proposed parent/order, and reason.
Select-all and select-none controls are available. Long names wrap at 375px.
The header vertically centers the title and close control; the title wraps when needed
and the close control retains its minimum touch target without shrinking.
The sheet has a named modal dialog, keyboard focus containment, focus restoration,
explicit close control, pending state, and preserved selection after failure. Apply
success announces exact merge, tree-change, creation, emoji, and transaction counts.
