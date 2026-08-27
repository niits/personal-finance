<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Rules — Personal Finance Tracker

## Outcome Driven Design

Design from the user's question and task, not from the repository's current UI.
The existing routes, templates, components, screenshots, and DOM are implementation
evidence: inspect them to understand behavior and constraints, but never treat their
current hierarchy or visual composition as the default answer.

This does not authorize a new aesthetic per task. `DESIGN.md` fixes the Calm Ledger
visual language. The user question determines hierarchy and composition; approved
Figma patterns, design tokens, and canonical components determine appearance and
interaction behavior.

Before writing or modifying UI, follow this order:

1. **User question** — write the concrete question the screen must answer.
2. **Decision or task** — identify what the user should understand, decide, or complete.
3. **Information hierarchy** — order content by user value, not API shape, database entity, or existing component boundaries.
4. **Truthful states** — design loading, empty, partial, error, unusual financial values, long content, narrow viewport, keyboard, and destructive consequences.
5. **Interaction model** — establish navigation level, contextual actions, reach, safe areas, and focus behavior.
6. **Component composition** — only now reuse, change, or create atoms → molecules → organisms → templates.
7. **Validate the outcome** — verify the screen answers its question at 375px before optimizing larger viewports.

Rules:

- Preserve required business behavior, data integrity, accessibility, and route contracts; visual precedent is not a contract.
- Use this UI precedence: approved Calm Ledger Figma pattern → canonical `DESIGN.md` pattern → compliant existing component → new pattern.
- Reuse a compliant pattern exactly. Do not restyle it merely to make a feature look distinct.
- A new pattern is allowed only when existing patterns cannot serve the task. Document its purpose, anatomy, variants, states, and responsive behavior before implementation.
- A new aesthetic, token family, radius grammar, navigation model, or chart grammar requires explicit user approval and a prior `DESIGN.md` update; it is never a local feature decision.
- Do not mirror the API response or database schema directly into equal-weight cards or tabs.
- Do not add a generic `+`, menu, card, chart, or KPI because an existing screen uses one. Every element needs a specific job.
- Prefer a plain-language total, narrative, or contextual CTA over extra dashboard chrome.
- When current UI conflicts with `DESIGN.md`, the user task, or a newer approved Figma design, document the conflict and implement the better hierarchy within scope.
- Figma references express design intent. Adapt them to real data and states; do not reduce them to a screenshot copy.
- For redesign work, inspect business specs and relevant `docs/intent/`, `docs/specs/`, or `docs/reviews/` sources before deciding the interface.

## Component Driven Development

`src/components/` is layered; build bottom-up (atoms → molecules → organisms → templates → pages):

- `atoms/` — primitives (Button, Input, Badge …)
- `molecules/` — composed units (TransactionListItem, BudgetProgressBar …)
- `organisms/` — full sections (TransactionForm, Navbar …)
- `templates/` — page-level layouts via slot props
- `src/app/` — thin App Router pages: fetch data, pass it down, no rendering logic

Rules:
- Atoms and molecules are pure: props in, JSX out, no side effects, no API calls.
- Keep data-fetching in pages. Templates/organisms receive data and callbacks via props; navigation hooks (e.g. `useRouter`) are acceptable in templates/organisms when a section genuinely owns an interaction.
- New component → create `src/components/<level>/<Name>/` with `<Name>.tsx`, `<Name>.stories.tsx`, `index.ts`. Never skip the story.
- Before writing UI: read `docs/COMPONENT_ARCHITECTURE.md`, `DESIGN.md`, and the relevant behavior/spec documents; use the `/frontend-design` skill within the fixed Calm Ledger direction. Component architecture is authoritative for implementation layering, while `DESIGN.md` is authoritative for product hierarchy and visual language. Do not let the skill invent a different aesthetic for an individual task.

## Storybook

Every component has a co-located `.stories.tsx` in **CSF3** format. Cover meaningful states (loading, disabled, error), keep `@storybook/addon-a11y` checks, and never import from `src/app/` inside a story — components stay isolated.

## Design tokens & styling

`DESIGN.md` is the source of truth. Tokens live as CSS custom properties in `src/app/globals.css` and are exposed as Tailwind utilities via the `@theme inline` block.

- Never hardcode colors, font sizes, or spacing — reference a token (`var(--ink)`) or its utility (`text-ink`, `p-md`, `rounded-lg`). Never inline a hex value.
- Prefer Tailwind utilities over inline `style`; arbitrary utilities (`text-[15px]`, `leading-[1.3]`) are fine for non-token one-offs. Reserve inline `style` for runtime-dynamic values (progress widths, chart colors).
- One interactive accent color only. Income, expense, and warning colors are semantic roles, not extra accents. Default UI is shadowless; reserve the single elevation treatment for temporary floating surfaces such as sheets above a scrim.

## Cloudflare Workers

All application code (including Next.js routes) runs inside a Worker:

- No Node built-ins outside the Cloudflare compatibility list (`fs`, `child_process`, …). No `eval` / `Function()` — use `vega-interpreter` for Vega expressions.
- DB access only through `getCloudflareContext()` → `env.DB` (Kysely D1 adapter); other bindings (`env.AI`) the same way.
- Scope the auth session per request — never cache it in module scope.
- Every `/api/*` route except `/api/auth/*` must verify the session and scope queries to `user_id`.
