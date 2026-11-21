# ADR 008: MCP Access Through Better Auth OAuth

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-11-21 |
| Author | niits |
| Current contract | [`architecture/technical.md`](../architecture/technical.md) |

## Context

Users want Claude to perform, through the Model Context Protocol (MCP), every action
they can perform in the app. Remote MCP clients such as Claude.ai, Claude Desktop, and
Claude Code discover an OAuth 2.1 authorization server, register themselves
dynamically, and act with a per-user access token. Every app user must be able to
connect without per-user infrastructure setup.

## Decision

- The Better Auth `mcp` plugin is the OAuth authorization server. Tokens resolve
  directly to a Better Auth user, so MCP access is scoped by `user_id` exactly like a
  browser session.
- Dynamic client registration stays open, as MCP clients require it. Because any
  party can register a client with its own `redirect_uri`, every authorization request
  is forced to `prompt=consent` and the user must approve the named client and its
  redirect host on `/oauth/consent`. Silent authorization is never possible.
- PKCE with `S256` is mandatory.
- Login during authorization reuses the existing sign-in page and providers.
- Each MCP tool calls one existing route handler in-process with the caller's bearer
  token. Business rules therefore live only in the routes, and the REST API and MCP
  cannot diverge. Legacy endpoints the UI no longer models (`/api/debts`,
  transaction debt links) are not exposed.

## Alternatives Considered

### Cloudflare Access Managed OAuth

Rejected. Access identities map to app users only by email, every new user would need
an Access policy change, and email/password accounts would need an extra Access login
method.

### Personal API Keys

Rejected. Claude.ai and Claude Desktop custom connectors require OAuth; API keys would
serve only Claude Code.

## Consequences

- Any authorization requires an explicit user decision; refresh tokens keep a
  connected client working without repeated consent.
- The plugin's token endpoint does not re-check consent, so the consent code must only
  ever be delivered to the consent page. `consentPage` must stay configured.
- REST routes accept MCP bearer tokens through `requireSession`; token expiry is
  enforced there because the plugin's session lookup does not check it.
- OAuth tables (`oauthApplication`, `oauthAccessToken`, `oauthConsent`) join the
  Better Auth schema.
