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
- **Deployment**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Target**: Mobile-first (iPhone primary), responsive to laptop

Use `/wrangler` skill before running any `wrangler` commands. Use `/cloudflare` skill for platform decisions (storage, routing, etc.).

## Commands

```bash
# Dev
npm run dev          # Next.js dev server → http://localhost:3000
npm run dev:cf       # Cloudflare Workers local preview → http://localhost:8787

# Build & deploy
npm run build:cf     # Build for Cloudflare Workers
npm run deploy:cf    # Build + deploy to production
```

## Documentation

All documentation must be written in English. UI strings in the app remain in Vietnamese.

## Database Migrations

Migrations run automatically before code deploy in CI (`deploy.yml`). The order is intentional: **migrations first, deploy second** — if a migration fails, the old code keeps running safely.

**Never write a migration that breaks backward compatibility.** D1/SQLite only supports `ADD COLUMN` — use that constraint as a guide:

```sql
-- ✅ Safe: add nullable column
ALTER TABLE "transaction" ADD COLUMN tags TEXT;

-- ✅ Safe: add column with DEFAULT
ALTER TABLE category ADD COLUMN icon TEXT NOT NULL DEFAULT '';

-- ✅ Safe: add new table
CREATE TABLE IF NOT EXISTS new_table (...);

-- ❌ Never: rename or drop a column in a single deploy
--    Use expand/contract across two deploys instead
```

**Expand/contract pattern** for renaming or removing a column:
1. **Deploy 1 — Expand**: add the new column; code reads both old and new
2. **Deploy 2 — Contract**: drop the old column; code only uses the new one

This ensures any rollback to an older code version still works against the current schema.
