<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Rules - Personal Finance Tracker

## Read First

- Use [`docs/README.md`](docs/README.md) to locate the authoritative document for the task.
- UI work: read [`docs/design/calm-ledger.md`](docs/design/calm-ledger.md), [`docs/architecture/components.md`](docs/architecture/components.md), the owning surface, and relevant product behavior.
- API, data, auth, or runtime work: read [`docs/architecture/technical.md`](docs/architecture/technical.md), relevant behavior, and relevant ADRs.
- Test work: read [`docs/quality/testing.md`](docs/quality/testing.md) and the contract being verified.

## Non-Negotiables

- Preserve business behavior, data integrity, accessibility, and route contracts.
- All application code runs on Cloudflare Workers; follow the runtime and auth boundaries in `docs/architecture/technical.md`.
- Every `/api/*` route except `/api/auth/*` authenticates the request and scopes data access to `session.user.id`.
- For UI, design from the user's question and task; existing screens are evidence, not the design brief. `docs/design/calm-ledger.md` remains the visual authority.
- Before UI implementation, use Storybook MCP to discover and verify existing components. Never guess component props or recreate a suitable primitive.
- Follow the component layers and story requirements in `docs/architecture/components.md`. New components require a co-located CSF3 story.
- Use the `frontend-design` skill within the Calm Ledger direction; it must not introduce a feature-specific aesthetic.
- Use design tokens rather than hardcoded visual values and validate UI at 375px.
