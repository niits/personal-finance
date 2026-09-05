# Dashboard Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

What direction is my money moving this month, am I still within plan, and what should
I do next?

## Reading Order

1. Selected budget period.
2. Consumption spending and remaining or exceeded amount.
3. Pace explanation and accessible pace-line chart.
4. Unpaid card spending as a labeled subset of consumption.
5. Primary `Ghi giao dịch` action.
6. Current-month AI Organize action.
7. Full reverse-chronological transaction ledger grouped by date.

The ledger has no filter or search control. A row opens edit/delete actions; it never
offers a separate finance-account link action.

The pace chart compares cumulative actual consumption with ideal pace and is paired
with a textual summary. Formulas come from
[`architecture/semantic-layer.md`](../../architecture/semantic-layer.md).

## States

Cover loading, no budget, no transactions, partial summary/ledger failure, background
refresh, exactly exhausted, over budget, reverse financial values, long labels, and
network failure. Independent regions fail independently. AI Organize does not replace
the primary transaction action.
