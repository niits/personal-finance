# Testing Strategy

| Field | Value |
|---|---|
| Status | Active target |
| Updated | 2026-09-05 |

## Principles

Tests prove behavior at the cheapest reliable layer. Domain and transformation logic
uses unit tests, Worker/D1 boundaries use integration tests, complete user journeys use
Playwright, and component states use isolated Storybook stories. Visual inspection or
an a11y panel is not described as an automated gate unless CI runs it.

## Commands

```bash
npm run test:unit
npm run build:cf && npm run test:integration
npm run test:e2e
npm run build-storybook
```

`npm test` currently aliases unit tests. There is no numerical coverage threshold;
coverage means required scenario coverage unless a coverage command is added.

## Unit Tests

Vitest in Node covers pure validators and calculations, including:

- working-day periods and current effective budget limit;
- consumption classification and budget metrics;
- pace-line series;
- debt, savings, and card calculations;
- AI Organize transformations and count summaries;
- cache validator construction and client invalidation maps;
- middleware, session helpers, and presentation transformations.

Unit tests do not claim to prove Worker bindings, D1 SQL, or rendered React behavior.

## Worker Integration Tests

Vitest's Workers pool runs route handlers against in-memory D1 with migrations. Cover:

- authentication and strict user isolation for every protected API family;
- transaction CRUD across current and historical periods;
- monthly `amount` updates plus audit-only adjustments;
- consumption-only budget calculations;
- finance-account association through transaction create/edit only;
- card statement and unpaid-subset integrity;
- AI Organize atomic apply and returned counts;
- private conditional GET, changed `ETag`, and `304 Not Modified` behavior;
- invalidation of old and new periods after historical moves;
- OpenAI gateway boundaries with network calls mocked.

## Storybook And Components

Every reusable component has an isolated CSF3 story with fixed data and no live auth,
router, or network requirement. Meaningful loading, empty, partial, error, pending,
disabled, destructive, selected, long-content, unusual-value, keyboard, 375px, and
wide-viewport states are included as applicable.

The a11y addon supports inspection. Automated accessibility requires a dedicated test
runner before it is considered a release gate.

## End-To-End

Playwright runs against the Cloudflare preview at a 390x844 touch viewport with one
worker because local tests share D1 state. Required journeys include:

- Dashboard month navigation, pace line, and no transaction-filter affordance;
- create/edit/delete with the full-screen mobile transaction form;
- wide-viewport bounded transaction form;
- `/finance` navigation and `/finance/accounts/:id` detail;
- account association only through transaction editing;
- budget creation and adjustment audit;
- card statement payment without a duplicate expense;
- AI Organize retry, long names, atomic apply, and count result;
- Google and GitHub entry/link states without real third-party completion in CI;
- absence of account export and legacy link/unlink UI;
- unauthenticated route and API protection.

## Fixtures

Fixtures are deterministic, user-scoped, and reset directly in local D1. Seed levels
must match the implementation rather than documentation-only names. Tests creating
historical data explicitly identify the budget and statement periods they affect.

## Release Gates

- Unit and Worker integration suites pass.
- Required E2E journeys pass against the Worker build.
- Storybook builds without network-dependent stories.
- Changed UI is inspected at 375px and one representative wide viewport.
- Schema migrations are additive or follow an explicit expand/contract rollout.
- New behavior links its tests to the canonical product, feature, or architecture
  contract rather than to retired documents.

## Known Runtime Caveat

Integration tests use the generated OpenNext Worker and require the repository's test
setup patches. Better Auth internals are library-owned; project tests verify provider
configuration, route boundaries, session handling, and user isolation.
