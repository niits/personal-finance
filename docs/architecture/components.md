# Component Architecture

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Contract

Design top-down from the user question, hierarchy, interaction context, and truthful
states. Implement bottom-up:

```text
pages/controllers -> templates -> organisms -> molecules -> atoms
```

The component tree is a reuse inventory, not a constraint on surface design.

## Layers

| Layer | Responsibility | Forbidden |
|---|---|---|
| Atom | Dependency-light visual primitive | Domain workflow, API access |
| Molecule | Pure composition of atoms for one small meaning | Side effects, API access |
| Organism | Coherent section or interaction with local presentation state | Owning server data or authentication |
| Template | Surface reading order assembled from slots/organisms | Fetching, mutation, route policy |
| Page/controller | Route data, mutations, navigation, and mapping to view models | Duplicating reusable presentation |

An organism may use local state for focus, open/closed state, and form interaction.
Server data and mutation functions enter through props. Navigation hooks belong in a
controller unless an organism genuinely owns a reusable navigation interaction.

## View-Model Boundary

Pages map API/domain data into presentation contracts before passing it to templates.
Templates receive explicit async-region states and intent callbacks such as
`onRetry`, `onCreateTransaction`, or `onConfirmDelete`, not raw transport functions.
Independent data regions preserve independent loading and error states.

## Files

Every reusable component lives at:

```text
src/components/<level>/<Name>/
  <Name>.tsx
  <Name>.stories.tsx
  index.ts
```

Use named exports, typed props, no `any`, and imports through the folder index. Before
creating a component, use Storybook documentation to verify that no suitable existing
component exists.

## Surface Mapping

Each file in [`design/surfaces/`](../design/surfaces/) maps to one page-level template.
Shared ledger rows, progress displays, selectors, fields, confirmations, and overlays
remain molecules or organisms. Finance details use dedicated surface templates rather
than expanding the overview into one monolith.

Transaction entry is one organism with responsive presentation: full-screen on mobile
and bounded dialog/sheet on larger viewports. Generic confirmation and sheet mechanics
are shared; feature-specific behavior remains in the owning organism.

`VegaChart` is the single CSP-safe Vega renderer. Templates provide data/specification
and accessible narrative rather than duplicating renderer setup.

## Storybook

- Every reusable component has a co-located CSF3 story.
- Stories use fixed inputs and no live auth, router, or network dependency.
- Cover meaningful default, loading, empty, partial, error, pending, disabled,
  destructive, selected, unusual-value, long-content, keyboard, and narrow states.
- Components changed visually are verified at 375px and at a representative wide
  viewport.
- `@storybook/addon-a11y` remains enabled; automated accessibility claims require an
  actual test command, not merely the panel.

## New Component Checklist

- The surface hierarchy is documented first.
- The correct layer and dependency direction are clear.
- A suitable Storybook component was not already available.
- Props express data and intent rather than transport details.
- The story is isolated and covers exceptional states.
- Styling uses tokens from [`design/calm-ledger.md`](../design/calm-ledger.md).
- Keyboard, focus, accessible names, and 375px behavior are verified.
