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
