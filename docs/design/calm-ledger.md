---
version: 2.0
name: Calm Ledger
status: active-target
updated: 2026-09-05
---

# Calm Ledger

## Product Idea

The application is a quiet personal ledger, not a bank terminal, trading dashboard,
or marketing site. Design starts from the user's question and task. Existing screens
are implementation evidence, not the design brief.

Calm Ledger determines visual and interaction language; feature surface documents
determine screen hierarchy. Use this precedence for visual decisions:

1. An approved Calm Ledger pattern for the same interaction.
2. A canonical pattern in this document.
3. A compliant existing component.
4. A new documented pattern when none of the above serves the task.

A feature must not introduce a new aesthetic, token family, radius grammar,
navigation model, or chart grammar. Such changes require explicit approval and an
update here before implementation.

## Principles

- Prefer one clear primary message per viewport section.
- Numbers carry more contrast than their labels.
- Use alignment, whitespace, and hairlines before containers.
- Cards are for bounded concepts, not every row or metric.
- AI reads like a helpful annotation, not promotional content.
- Loading and error states preserve useful geometry and stale data where possible.
- Motion confirms change and never delays access to financial information.

## Mobile And Layout

- Validate at 375px before larger viewports; the canonical artboard is 390x844.
- Minimum touch target is 44x44px.
- Phone page gutter is 20px, falling back to 16px only below 375px.
- Structural rhythm is 8px; 4px is reserved for optical correction.
- Respect safe areas, bottom navigation, reach, and the on-screen keyboard.
- Ledger flows cap near 720px and analytics/management flows near 1040px.
- Larger viewports preserve reading order and use columns only for independent topics.

## Color

| Role | Token | Value |
|---|---|---|
| Action | `--primary` | `#0066cc` |
| Focus | `--primary-focus` | `#0071e3` |
| Action on dark | `--primary-on-dark` | `#2997ff` |
| Primary ink | `--ink` | `#1d1d1f` |
| Supporting ink | `--ink-muted-80` | `#333333` |
| Muted ink | `--ink-muted-48` | `#7a7a7a` |
| Canvas | `--canvas` | `#ffffff` |
| Page surface | `--canvas-parchment` | `#f5f5f7` |
| Raised surface | `--surface-pearl` | `#fafafc` |
| Soft divider | `--divider-soft` | `#f0f0f0` |
| Hairline | `--hairline` | `#e0e0e0` |
| Income/success | `--success` | `#34c759` |
| Expense/danger | `--danger` | `#ff3b30` |
| Warning | `--warning` | `#c77800` |
| Scrim | `--surface-black` | `#000000` |
| On action/dark | `--on-primary`, `--on-dark` | `#ffffff` |

Action Blue is the only interactive accent. Green, red, and amber communicate
financial meaning and must not become decorative accents. Color is never the only cue.

## Typography

| Role | Specification | Use |
|---|---|---|
| Display | 34/38, weight 600 | One primary financial outcome per screen |
| Title | 28/33, weight 600 | Screen or major surface title |
| Heading | 21/26, weight 600 | Section heading or featured insight |
| Body strong | 17/23, weight 600 | Important label, row title, button |
| Body | 17/25, weight 400 | Explanation, value, form content |
| Compact | 15/21, weight 400 | Dense supporting text |
| Caption | 13/18, weight 400 | Date, path, helper text |
| Micro | 11/14, weight 600 | Non-essential annotation only |

Use tabular numerals for aligned balances. Keep sign, amount, and `₫` together. Scale
large amounts rather than truncating them. Inputs use at least 17px text on iOS.

## Spacing, Shape, And Elevation

| Value | Purpose |
|---|---|
| 4px | Optical correction |
| 8px | Tight relationship |
| 12px | Control/content gap |
| 16px | Compact card padding |
| 20px | Phone page gutter |
| 24px | Section separation |
| 32px | Major break |
| 48px | Empty-state breathing room |

Use 8px radius for compact controls, 12px for inputs and standard cards, 18px for
prominent bounded summaries, and 24px for sheets. The default UI is shadowless. One
soft elevation treatment is reserved for a temporary floating surface above a scrim.
Avoid gradients, glass effects, layered translucent cards, and permanent black bars.

## Interaction Patterns

- One dominant action per action region.
- Primary actions use blue fill; secondary actions are neutral; destructive red is
  reserved for final confirmation.
- Inputs retain visible labels, adjacent recovery text, and focus-visible indication.
- Dense lists use shared surfaces and dividers rather than one card per item.
- Bottom sheets suit short contextual phone decisions; they trap focus, restore it,
  and account for safe areas and keyboards.
- A surface may pin its period header and summary above a scrolling ledger using a
  solid surface and a hairline divider. Frosted glass remains prohibited.
- A surface's dominant action may be one floating circular action (44px, action blue
  fill) offset above bottom navigation and safe areas, labeled for assistive
  technology. More than one floating action per surface is prohibited.
- Never nest modal surfaces.
- Charts require a textual summary and accessible data representation.

Surface-specific exceptions and composition are defined in [`surfaces/`](./surfaces/).

## Content

Vietnamese is the default UI voice. Use direct, familiar financial language. State
the fact, consequence, and recoverable next action without judgment. Buttons are
verbs. Confirmations name the affected object and consequence.

## State Completeness

Applicable features cover initial loading, background refresh, empty and unused
entities, partial failure, validation, recoverable server error, long content, large
and reverse amounts, narrow screens, open keyboard, pending mutation, duplicate-submit
prevention, destructive confirmation, expired session, and unavailable network.

Never show an empty state before the first request completes. Keep stale but useful
data visible during background refresh.

## Implementation Contract

Tokens are implemented in `src/app/globals.css` and exposed through Tailwind. Prefer
token-backed utilities; inline styles are for runtime geometry. Add a new visual token
here before implementing it. Component boundaries are defined in
[`architecture/components.md`](../architecture/components.md).

## Deprecated Concepts

Do not use product photography, alternating marketing tiles, equal-weight dashboard
walls, permanent black navigation, decorative glass or gradients, more than one
floating action per surface, or authenticated-app marketing hero typography.
