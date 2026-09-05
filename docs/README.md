# Documentation

## Contract

Every non-ADR, non-incident document describes the latest approved target, including
behavior not yet implemented. Do not preserve outdated alternatives in product, design,
architecture, feature, or quality documents.

ADRs in [`decisions/`](./decisions/) preserve why decisions were made and may describe
superseded behavior. Incidents in [`incidents/`](./incidents/) preserve historical
evidence but are non-normative. All other documents contain only the latest target.

## Authority

| Question | Authority |
|---|---|
| What is the product trying to achieve? | [`product/requirements.md`](./product/requirements.md) |
| How must transactions, budgets, or cards behave? | [`product/behavior/`](./product/behavior/) |
| How must the product look and interact globally? | [`design/calm-ledger.md`](./design/calm-ledger.md) |
| What is the hierarchy and state model of a screen? | [`design/surfaces/`](./design/surfaces/) |
| How is the target system implemented? | [`architecture/`](./architecture/) |
| How does AI Organize behave? | [`features/ai-organize.md`](./features/ai-organize.md) |
| Why was an architectural or product-system choice made? | [`decisions/`](./decisions/) |
| How is behavior verified? | [`quality/testing.md`](./quality/testing.md) |
| What happened during an operational failure? | [`incidents/`](./incidents/) |

When documents appear to conflict, current product behavior constrains surface design;
design constrains presentation; architecture implements both. ADRs explain history but
do not override a current contract. Stop and obtain a product decision when this order
does not resolve a real semantic conflict.

## Registry

### Product

| Document | Purpose |
|---|---|
| [`product/requirements.md`](./product/requirements.md) | Product purpose, scope, capabilities, constraints, and exclusions |
| [`product/behavior/transactions.md`](./product/behavior/transactions.md) | Transaction lifecycle, consumption, debt, savings, and account association |
| [`product/behavior/budgets.md`](./product/behavior/budgets.md) | Working-day periods, effective limits, adjustments, pace, and custom budgets |
| [`product/behavior/credit-cards.md`](./product/behavior/credit-cards.md) | Card groups, statements, payments, and unpaid-spend semantics |
| [`product/behavior/categories.md`](./product/behavior/categories.md) | Hierarchy, assignability, protected categories, and deletion rules |

### Design

| Document | Purpose |
|---|---|
| [`design/calm-ledger.md`](./design/calm-ledger.md) | Visual language, tokens, global interaction, content, and accessibility |
| [`design/surfaces/app-shell.md`](./design/surfaces/app-shell.md) | Global navigation and shell states |
| [`design/surfaces/dashboard.md`](./design/surfaces/dashboard.md) | Monthly outcome, pace line, actions, and ledger hierarchy |
| [`design/surfaces/transactions.md`](./design/surfaces/transactions.md) | Responsive transaction form and edit/delete interactions |
| [`design/surfaces/statistics.md`](./design/surfaces/statistics.md) | Narrative reports, charts, generation, and freshness states |
| [`design/surfaces/finance.md`](./design/surfaces/finance.md) | Debt, savings, cards, and finance-account details |
| [`design/surfaces/account.md`](./design/surfaces/account.md) | Management links, providers, and sign-out |
| [`design/surfaces/budgets.md`](./design/surfaces/budgets.md) | Monthly/custom budget management hierarchy |
| [`design/surfaces/categories.md`](./design/surfaces/categories.md) | Category tree management and protected states |

### Architecture And Features

| Document | Purpose |
|---|---|
| [`architecture/technical.md`](./architecture/technical.md) | Runtime, security, routes, persistence, APIs, providers, and caching |
| [`architecture/components.md`](./architecture/components.md) | Component layers, view models, files, and Storybook contracts |
| [`architecture/semantic-layer.md`](./architecture/semantic-layer.md) | Deterministic financial metrics and AI arithmetic boundary |
| [`features/ai-organize.md`](./features/ai-organize.md) | AI Organize flow, selection, apply, and recovery behavior |
| [`quality/testing.md`](./quality/testing.md) | Unit, Worker integration, Storybook, E2E, and release gates |

### Decisions

| ADR | Status | Decision |
|---|---|---|
| [`001-api-caching-strategy.md`](./decisions/001-api-caching-strategy.md) | Superseded by ADR 006 | Original browser and SWR caching policy |
| [`002-platform-stay-cloudflare.md`](./decisions/002-platform-stay-cloudflare.md) | Partially superseded by ADR 007 | Stay on Cloudflare Workers and D1 |
| [`003-no-monthly-view-pagination.md`](./decisions/003-no-monthly-view-pagination.md) | Accepted | Load the full selected month |
| [`004-credit-card-statements-separate-from-budgets.md`](./decisions/004-credit-card-statements-separate-from-budgets.md) | Accepted | Keep statement payment separate from consumption |
| [`005-adopt-calm-ledger-redesign.md`](./decisions/005-adopt-calm-ledger-redesign.md) | Accepted | Adopt outcome-driven Calm Ledger composition |
| [`006-http-revalidation-for-editable-history.md`](./decisions/006-http-revalidation-for-editable-history.md) | Accepted | Use private validator-based revalidation for mutable history |
| [`007-authentication-and-ai-providers.md`](./decisions/007-authentication-and-ai-providers.md) | Accepted | Support Google and GitHub with OpenAI |

### Incidents

| Document | Purpose |
|---|---|
| [`2026-04-29-auth-debug.md`](./incidents/2026-04-29-auth-debug.md) | Local OAuth, D1 adapter, and auth schema failure investigation |
| [`2026-05-16-staging-auth-redirect.md`](./incidents/2026-05-16-staging-auth-redirect.md) | Secure-cookie route-guard regression investigation |

## Entry Points

- UI work: design foundation, owning surface, component architecture, and relevant
  product behavior.
- API/data/auth/runtime work: technical architecture, relevant behavior, and ADRs.
- AI/statistics work: semantic layer, AI Organize when applicable, and Statistics
  surface.
- Test work: testing strategy plus the contract being verified.

The retired monolithic BRD, redesign, technical design, component inventory, intent,
spec, and Draw.io sources were consolidated into current contracts or ADRs.
They are not retained as compatibility copies because that would recreate conflicting
authorities.
