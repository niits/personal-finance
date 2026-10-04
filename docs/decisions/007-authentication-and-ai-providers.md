# ADR 007: Support Google And GitHub With OpenAI

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-05 |
| Author | niits |
| Partially supersedes | [`ADR 002`](./002-platform-stay-cloudflare.md) |
| Current contract | [`architecture/technical.md`](../architecture/technical.md) |

## Context

Documentation and implementation disagreed about replacing GitHub with Google,
supporting both providers, and using Gemini, Workers AI, or OpenAI. Provider choice had
become entangled with the independent decision to remain on Cloudflare Workers and D1.

## Decision

- Better Auth remains the authentication framework.
- Google and GitHub are both supported target social providers.
- Verified provider accounts may link to one user according to Better Auth's safe
  account-linking rules.
- OpenAI is the target model provider for organization and statistics features.
- Gateway routing and observability may change without changing the product provider
  contract.
- Provider credentials are environment secrets and never client configuration.

This ADR supersedes only the Google-replacement and Gemini recommendations in ADR 002.
ADR 002's Cloudflare Workers and D1 platform decision remains accepted.

## Alternatives Considered

### Replace GitHub With Google

Rejected because existing GitHub identities remain valid and supporting both avoids a
forced identity migration.

### Keep GitHub Only

Rejected because Google is an approved target sign-in option.

### Use Gemini As The Target Model Provider

Rejected in favor of the currently selected OpenAI model family and integration.

### Make Provider Choice Undocumented

Rejected because auth identity migration and model behavior have operational and user
experience consequences.

## Consequences

- Google support must be completed without breaking existing GitHub users.
- Sign-in and Account surfaces expose both providers and honest partial availability.
- Stale Anthropic or Workers AI dependencies and bindings can be removed after runtime
  verification.
- A future provider change requires a new ADR but not a platform migration by default.
