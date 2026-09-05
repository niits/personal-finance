# ADR 005: Adopt The Calm Ledger Application Redesign

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-05 |
| Author | niits |
| Replaces | Legacy Apple Store-inspired application composition |
| Current contracts | [`design/calm-ledger.md`](../design/calm-ledger.md), [`design/surfaces/`](../design/surfaces/), [`architecture/components.md`](../architecture/components.md) |

## Context

The application had accumulated implementation-led screens, repeated KPI cards,
legacy dark navigation, generic actions, and component boundaries that dictated
information hierarchy. Existing routes and components encoded behavior but did not
consistently answer the user's financial question.

A comprehensive Calm Ledger redesign explored a mobile-first shell, outcome-driven
screen hierarchy, truthful finance states, and Component Driven implementation. That
proposal also contained detailed live contracts and unresolved options. Keeping it as
an active monolithic specification created overlap with product behavior, design,
architecture, and Storybook documentation.

## Decision

Adopt Calm Ledger as the product-wide design direction:

- Start each surface from the user's question and task.
- Preserve one visual language based on clear amounts, quiet dividers, contextual
  actions, restrained semantic color, and stable reading rhythm.
- Use four global destinations: Dashboard, Statistics, Finance, and Account.
- Treat existing UI as implementation evidence rather than visual authority.
- Design top-down and implement bottom-up through documented component layers.
- Make mobile canonical while retaining the same hierarchy on larger viewports.
- Move live contracts into focused current-state documents; retain this ADR only as
  the record of why the redesign was adopted.

Product and route questions discovered during extraction were resolved in their
current product, surface, and technical contracts. Those contracts are normative;
this ADR records only the decision to adopt and decompose the redesign direction.

## Alternatives Considered

### Preserve Existing Screen Composition

Rejected because implementation history would continue to determine hierarchy and
perpetuate conflicting patterns.

### Redesign Every Feature Independently

Rejected because feature-specific aesthetics would fragment navigation, tokens,
charts, and interaction behavior.

### Keep The Redesign Document As The Live Source

Rejected because it duplicated business behavior, visual foundations, component
architecture, and feature states. A monolith also made unresolved proposals appear
equally authoritative.

## Consequences

- Product behavior, design surfaces, architecture, and quality each have one focused
  current contract.
- This ADR may describe historical rationale but does not override those contracts.
- Existing implementation gaps are migrated deliberately rather than hidden by docs.
- New visual-language changes require an explicit design-system decision.
