# Statistics Surface

| Field | Value |
|---|---|
| Status | Active target |

## User Question

What is notable, why did it happen, and what should I do next?

## Composition

Present one specific headline, a concise explanation, and a chart only when comparison
adds meaning. Separate observation from recommendation. Highlight the datum discussed
by the narrative rather than automatically emphasizing the largest value.

Every chart has a textual summary and accessible data representation. Action Blue is
the focal series; neutral values provide context and semantic colors retain their
financial meanings.

## Report States

Distinguish no report, generating, progressively available results, fresh report,
dirty report after relevant historical mutation, generation failure, chart failure,
and unavailable network. A dirty or regenerating report remains visible with an
explicit refresh cue. Never expose raw model internals.

All arithmetic comes from
[`architecture/semantic-layer.md`](../../architecture/semantic-layer.md); OpenAI may
interpret metrics but must not invent them.

## Processing And Charts

Show the actual processing phases during initial generation and background refresh:
period selection, spending aggregation, card-payment reconciliation, prior-period
comparison, narrative synthesis, validation, and persistence. Completed phases remain
visible with text status; no percentage is invented. A failure preserves completed
phases and the previous report. Changing periods cancels the client reader so an old
response cannot replace the selected report.

Display the report's source dates and comparison basis before the narrative. Card
insights distinguish period purchases from their currently unpaid subset. Models may
select a server-generated chart, but cannot construct its numerical dataset.

Chart colors resolve Calm Ledger tokens. Current or focal data use Action Blue;
comparison data use neutral colors. Separate line series use color and line pattern.
Bar charts show exact values, category labels, and a readable comparison legend.
Full hierarchy paths and full values remain available in tooltips and the data table.
A single category may be charted when two explicit periods provide a comparison.

Progress indicators may pulse and updated sections may fade in over 180 milliseconds.
The content remains immediately available, and reduced-motion preferences disable
these effects. Data tables retain keyboard access and a subtle row hover state.
