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
