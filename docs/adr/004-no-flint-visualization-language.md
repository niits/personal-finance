# ADR 004: Do Not Adopt Microsoft Flint for Statistics Charts

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-12 |
| Author | niits |
| Related | SEMANTIC_LAYER.md, src/lib/statistics.ts, src/components/organisms/VegaChart/VegaChart.tsx |

## Context

Microsoft Research released [Flint](https://github.com/microsoft/flint-chart) (2026-07-08), an intermediate visualization language that lets an AI agent emit a compact `{semantic_types, chart_spec}` object instead of raw Vega-Lite/ECharts/Chart.js JSON. A compiler then derives scales, axes, spacing, and layout automatically. It was evaluated as a potential upgrade to the statistics/analysis screen's chart generation.

Flint solves a specific failure mode: an LLM asked to emit raw Vega-Lite JSON directly produces invalid or unpolished specs.

This app does not have that failure mode. In `src/lib/statistics.ts`, the LLM never emits Vega-Lite. It fills a narrow, zod-validated schema — `chart_type` (one of 5 enum values) + `chart_data: {name, value, series, highlight}[]`. All actual spec construction happens in `VegaChart.tsx`'s hand-written `buildVegaLiteSpec` (~200 lines), which encodes app-specific logic unrelated to "can the LLM write valid Vega-Lite":

- VND formatting with vi-VN locale, compact `tr`/`k` axis labels
- Vietnamese chart titles/tooltips/legends
- exact brand colors/fonts from `DESIGN.md`
- the "highlight exactly one bar, grey out the rest" attention rule
- the budget-vs-actual reference-rule chart and dual-series forecast line
- suppressing single-bar/single-point charts (no comparison = no chart)

Flint's semantic-type system (`Rank`, `Temperature`, `Price`, `Country`, etc.) is generic. Its public docs do not expose locale/currency-format/theme/font override hooks — the exact customization surface this app depends on for every chart it renders.

## Decision

Do not migrate the statistics screen's chart pipeline to Flint.

## Rationale

- The problem Flint solves (LLM struggles to emit valid/attractive raw Vega-Lite) does not exist here — the LLM's output surface is already a tight, validated, non-visual schema.
- Migrating would replace the current small schema with Flint's `semantic_types` + `chart_spec`, a *larger* surface for the model to get wrong, for no reliability gain.
- All of this app's actual "chart quality" — Vietnamese locale, VND compact formatting, brand colors, one-bar-highlight rule, budget reference-line, forecast dual-line — is domain- and brand-specific business logic that Flint does not provide and would still need to be hand-written on top of (or after) it.
- Net effect of migrating: same amount of custom code to maintain, plus a new dependency and a less-constrained AI output contract.

## Consequences

- `src/lib/statistics.ts` and `src/components/organisms/VegaChart/VegaChart.tsx` are unchanged.
- No new dependency added.

## When to Revisit

| Trigger | Reason |
|---------|--------|
| Chart variety needs to expand well beyond the current 5 types (pie, bar, line, bar_grouped, forecast_line) | Flint's automatic layout could reduce the per-chart-type hand-written code in `buildVegaLiteSpec` |
| Flint ships first-class locale/currency-format/theme override hooks | Removes the main blocker to reusing it for this app's Vietnamese/VND/brand requirements |
| The LLM starts being asked to produce raw Vega-Lite directly (architecture change) | This is the actual problem Flint is built to solve |

Do not re-investigate Flint for this screen absent one of the triggers above.
