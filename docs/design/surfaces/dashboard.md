# Dashboard Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

What direction is my money moving this month, am I still within plan, and what should
I do next?

## Reading Order

1. Selected budget period through an outlined inline month picker with a calendar
   icon. The current-month AI action is labeled
   `AI gợi ý phân loại` in a compact pill beside it, wrapping when space is limited.
   Supporting text explains transaction classification, category organization, and
   emoji suggestions, and states that the user reviews proposals before applying them.
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

A “Lọc” button aligned to the right of “Giao dịch” expands an inline category panel.
Users may select multiple categories present in the selected month. The category list
has a fixed height, capped relative to the viewport, and scrolls independently. Its
footer remains outside the scrolling list and contains “Xóa bộ lọc”, “Chọn tất cả”,
and “OK”. Clear removes the draft selection, select all checks every available option,
and OK applies the selection, closes the panel, and returns focus to the trigger.
Closing the panel without OK discards draft changes; reopening starts from the applied
selection. An empty applied selection shows all transactions. Clear is disabled when
no draft options are checked; select all is disabled when no options exist or every
option is checked. OK remains available to complete the interaction in all states.

Category paths distinguish duplicate names, and uncategorized movements have a
separate option. The trigger shows the number of applied categories. Changing the
month clears both the applied and draft selections. Date subtotals reflect visible
rows, while the monthly summary continues to describe the entire period. A filtered
empty state allows clearing the applied selection directly. The panel supports
keyboard navigation and remains usable at 375px.

A row opens edit/delete actions; it never offers a separate finance-account link action.

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
