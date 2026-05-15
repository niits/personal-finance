# Documentation — Personal Finance Tracker

## Document Registry

### Core

Stable project-wide standards. Written once, updated only when requirements or architecture change.

| Document | Type | Status | Description |
|----------|------|--------|-------------|
| [BRD.md](./BRD.md) | Business Requirements | Draft | Requirements, data model, business rules, UI specs |
| [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) | Technical Design | Draft | DB schema, API contracts, edge cases, computed values |
| [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md) | Frontend Architecture | Active | CDD philosophy, component hierarchy, Storybook conventions, refactor roadmap |
| [TESTING.md](./TESTING.md) | Testing Strategy | Draft | Unit and integration test setup, patterns, coverage targets |

### Architecture Decision Records (`adr/`)

One file per decision. Accumulates as architectural choices are made. Never deleted — superseded ADRs are marked as such.

| Document | Status | Summary |
|----------|--------|---------|
| [001-api-caching-strategy.md](./adr/001-api-caching-strategy.md) | Accepted | HTTP `Cache-Control` + SWR in-memory cache for categories and per-month data |
| [002-platform-stay-cloudflare.md](./adr/002-platform-stay-cloudflare.md) | Accepted | Stay on Cloudflare Workers + D1; Firebase/Vercel migration not justified |
| [003-no-monthly-view-pagination.md](./adr/003-no-monthly-view-pagination.md) | Accepted | Monthly transaction list loads in full; cursor-based pagination if ever needed |

### Feature Specifications (`specs/`)

One file per feature or topic. Accumulates as features are designed and built.

| Document | Status | Description |
|----------|--------|-------------|
| [flows.md](./specs/flows.md) | Draft | Sequence diagrams for all user-facing and system flows |
| [home-screen.md](./specs/home-screen.md) | Implemented | Home tab: budget bar, category filter chips, transaction feed |
| [ai-category-suggestions.md](./specs/ai-category-suggestions.md) | Implemented | AI-powered new category suggestions from transaction history |
| [transaction-recategorize.md](./specs/transaction-recategorize.md) | Stub | AI-powered transaction recategorization — needs full spec |

### Dev Logs (`dev_logs/`)

Chronological notes from debugging sessions, design decisions, and implementation work. Not authoritative — decision outcomes are extracted into ADRs and specs above.

| File | Summary |
|------|---------|
| [20260429_auth_debug.md](./dev_logs/20260429_auth_debug.md) | GitHub OAuth broken in local dev — 3 root causes and fixes |
| [20260502_dashboard_ui.md](./dev_logs/20260502_dashboard_ui.md) | Budget bar bug, spending chart, transaction list design, filter decisions |
| [20260502_merge_transactions_into_home.md](./dev_logs/20260502_merge_transactions_into_home.md) | Merged Transactions tab into Home; full layout rewrite |
| [20260506_migrate_to_firebase.md](./dev_logs/20260506_migrate_to_firebase.md) | Firebase migration analysis — full scope, rationale for staying on Cloudflare |

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
| BR-xx | Business rules |
| NFR-xx | Non-functional requirements |

### Flow Index

| # | Flow | Spec |
|---|------|------|
| 1 | GitHub OAuth login | specs/flows.md §1 |
| 2 | Log expense transaction | specs/flows.md §2 |
| 3 | Log income transaction | specs/flows.md §3 |
| 4 | Create monthly budget | specs/flows.md §4 |
| 5 | Adjust monthly budget | specs/flows.md §5 |
| 6 | Create custom budget | specs/flows.md §6 |
| 7 | Toggle custom budget active/inactive | specs/flows.md §7 |
| 8 | Add category | specs/flows.md §8 |
| 9 | Delete category | specs/flows.md §9 |
| 10 | Update budget config | specs/flows.md §10 |
| 11 | Seed categories on demand | specs/flows.md §11 |
