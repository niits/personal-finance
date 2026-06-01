<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Rules — Personal Finance Tracker

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
- Before writing UI: read `docs/COMPONENT_ARCHITECTURE.md` (authoritative) and `DESIGN.md`, and use the `/frontend-design` skill.

## Storybook

Every component has a co-located `.stories.tsx` in **CSF3** format. Cover meaningful states (loading, disabled, error), keep `@storybook/addon-a11y` checks, and never import from `src/app/` inside a story — components stay isolated.

## Design tokens & styling

`DESIGN.md` is the source of truth. Tokens live as CSS custom properties in `src/app/globals.css` and are exposed as Tailwind utilities via the `@theme inline` block.

- Never hardcode colors, font sizes, or spacing — reference a token (`var(--ink)`) or its utility (`text-ink`, `p-md`, `rounded-lg`). Never inline a hex value.
- Prefer Tailwind utilities over inline `style`; arbitrary utilities (`text-[15px]`, `leading-[1.3]`) are fine for non-token one-offs. Reserve inline `style` for runtime-dynamic values (progress widths, chart colors).
- One accent color only. One drop-shadow in the entire system, reserved for product imagery.

## Cloudflare Workers

All application code (including Next.js routes) runs inside a Worker:

- No Node built-ins outside the Cloudflare compatibility list (`fs`, `child_process`, …). No `eval` / `Function()` — use `vega-interpreter` for Vega expressions.
- DB access only through `getCloudflareContext()` → `env.DB` (Kysely D1 adapter); other bindings (`env.AI`) the same way.
- Scope the auth session per request — never cache it in module scope.
- Every `/api/*` route except `/api/auth/*` must verify the session and scope queries to `user_id`.
