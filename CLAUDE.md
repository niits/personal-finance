@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal finance expense tracker — Next.js app deployed on Cloudflare Pages, optimized for iPhone and laptop.

## Design System

**Always read `DESIGN.md` before writing any UI code.** It is the single source of truth for all visual decisions.

`DESIGN.md` contains a complete Apple-inspired design system:
- Color tokens (e.g. `{colors.primary}` = #0066cc, `{colors.ink}` = #1d1d1f)
- Typography scale (SF Pro Display/Text, body at 17px not 16px, weight ladder: 300/400/600/700)
- Spacing tokens (`{spacing.section}` = 80px, `{spacing.lg}` = 24px, etc.)
- Component specs (buttons, tiles, cards, nav, footer)
- Responsive breakpoints and collapsing strategy

Never inline hex values — always reference tokens. Never add a second accent color. One drop-shadow in the entire system, reserved for product imagery only.

Use `/frontend-design` skill when building any UI component or page.

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Deployment**: Cloudflare Pages via Wrangler
- **Target**: Mobile-first (iPhone primary), responsive to laptop

Use `/wrangler` skill before running any `wrangler` commands. Use `/cloudflare` skill for platform decisions (storage, routing, etc.).

## Commands

```bash
# Dev
npm run dev        # http://localhost:3000

# Build
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy .next
```
