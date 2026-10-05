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

## Language

Formal register is mandatory in both languages, for chat replies and every written artifact (code, comments,
docstrings, tests, commits, docs, ADRs, notebooks, Finding.message, export labels).

- Formal English: complete, neutral sentences; no slang, contractions (don't → do not), emoji, or
  exclamation marks.
- Formal Vietnamese (văn phong kỹ thuật/hành chính): full diacritics; complete sentences; no teencode or chat
  abbreviations (ko, dc, k, vs, ok); no colloquial particles (nhé, nha, á, nè, luôn);
  no informal pronouns (mình, tớ, cậu, bro). Use tôi for the agent; address the user as bạn or omit
  the subject.
- Tables, bullets, and identifiers may stay terse but never colloquial.
- Rewrite existing informal text only when asked or when already editing that passage.
