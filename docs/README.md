# Documentation — Personal Finance Tracker

## Document Registry

### Core

Stable project-wide standards. Written once, updated only when requirements or architecture change.

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [BRD.md](./BRD.md) | Business Requirements | Draft | Requirements, data model, business rules, UI specs |
| [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) | Technical Design | Draft | DB schema, API contracts, edge cases, computed values |
| [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md) | Frontend Architecture | Active | CDD philosophy, component hierarchy, Storybook conventions, refactor roadmap |
| [CALM_LEDGER_APP_REDESIGN.md](./CALM_LEDGER_APP_REDESIGN.md) | Product UI Design | Active | Outcome-driven composition and CDD contracts for the authenticated app |
| [TESTING.md](./TESTING.md) | Testing Strategy | Draft | Unit and integration test setup, patterns, coverage targets |
| [SEMANTIC_LAYER.md](./SEMANTIC_LAYER.md) | Technical Design | Active | Server-side metric layer between D1 and the AI statistics agent (LLMs never do arithmetic) |

### Architecture Decision Records (`adr/`)

One file per decision. Accumulates as architectural choices are made. Never deleted — superseded ADRs are marked as such.

| Document | Status | Summary |
|----------|--------|---------|
| [001-api-caching-strategy.md](./adr/001-api-caching-strategy.md) | Accepted | HTTP `Cache-Control` + SWR in-memory cache for categories and per-month data |
| [002-platform-stay-cloudflare.md](./adr/002-platform-stay-cloudflare.md) | Accepted | Stay on Cloudflare Workers + D1; Firebase/Vercel migration not justified |
| [003-no-monthly-view-pagination.md](./adr/003-no-monthly-view-pagination.md) | Accepted | Monthly transaction list loads in full; cursor-based pagination if ever needed |
| [004-credit-card-statements-separate-from-budgets.md](./adr/004-credit-card-statements-separate-from-budgets.md) | Accepted | Card statements are independent from working-day budget periods |

### Behavior Intents (`intent/`)

Confirmed product behavior that takes precedence over older draft requirements.

| Document | Status | Description |
|----------|--------|-------------|
| [budget-behavior.md](./intent/budget-behavior.md) | Active | Working-day budget periods, consumption-only spending, and custom budgets |
| [transactions-behavior.md](./intent/transactions-behavior.md) | Active | CRUD transactions, debts, savings, and credit-card interaction |
| [credit-card-behavior.md](./intent/credit-card-behavior.md) | Active | Card groups, statements, payment status, and dashboard semantics |

### Feature Specifications (`specs/`)

One file per feature or topic. Accumulates as features are designed and built.

| Document | Status | Description |
|----------|--------|-------------|
| [ai-organize.md](./specs/ai-organize.md) | Active | CDD component design for the AI Organize button and review sheet (Epic 3 Part 2) |
| [personal-finance-iphone13-flows.drawio](./personal-finance-iphone13-flows.drawio) | Interaction Design | Active | Canonical iPhone flows and exceptional states for all product surfaces |

### Dev Logs (`dev_logs/`)

Chronological notes from debugging sessions, design decisions, and implementation work. Not authoritative — decision outcomes are extracted into ADRs and specs above.

| File | Summary |
|------|---------|
| [20260429_auth_debug.md](./dev_logs/20260429_auth_debug.md) | GitHub OAuth broken in local dev — 3 root causes and fixes |
| [20260516_staging_auth_redirect.md](./dev_logs/20260516_staging_auth_redirect.md) | HTTPS staging auth loop — secure Better Auth cookie not recognized by route guard |

---

## Quick Reference

### Requirement IDs

| Prefix | Domain |
|--------|--------|
| AUTH-xx | Authentication |
| TXN-xx | Transaction management |
| MBGT-xx | Monthly budget |
| CBGT-xx | Custom budget |
| BCFG-xx | Budget config |
| CAT-xx | Category management |
| CHART-xx | Pace line chart |
| RPT-xx | Reporting & dashboard |
| STAT-xx | Statistics & AI insights |
| DEBT-xx | Debt tracking |
| CARD-xx | Credit-card statements |
| BR-xx | Business rules |
| NFR-xx | Non-functional requirements |

### Flow Index

The editable source for authentication, Dashboard, transactions, Statistics, Finance,
Account, Budget, and Category flows is
[`personal-finance-iphone13-flows.drawio`](./personal-finance-iphone13-flows.drawio).
Confirmed behavior in `intent/` takes precedence when an older diagram label conflicts.
