# AI Category Suggestions

| Field | Value |
|-------|-------|
| Type | Feature Specification |
| Status | Implemented |
| Version | 1.0 |
| Author | niits |
| Created | 2026-04-29 |
| Last Updated | 2026-04-29 |
| Related | TECHNICAL_DESIGN.md §4, specs/transaction-recategorize.md |

Analyzes all transaction notes and existing categories, then suggests new categories using an LLM.

---

## Final Design Decisions

- **Button**: "✦ Gợi ý" in the Categories page header, always visible (next to "+ Thêm")
- **Flow**: 2 steps only — Loading → Results (no scope selection)
- **Model**: configurable via `CF_AI_MODEL` env var via Cloudflare Workers AI
- **LLM input**: all categories (as `{id, name, type, level}[]`) + all transactions with notes
- **Parent resolution**: LLM receives `{id, name}[]` for existing categories, must return `parent_category_id` as a valid ID; server validates ownership before creating
- **Structured output**: `output_config.format.json_schema` enforced by the API

## AI Stack

LLM calls use **`workers-ai-provider`** + **Vercel AI SDK** (`ai` package). No LangChain.

### Stack

| Layer | Package | Role |
|---|---|---|
| Model | `workers-ai-provider` | `createWorkersAI` — wraps Cloudflare Workers AI binding |
| SDK | `ai` (Vercel AI SDK) | `generateText` + `Output.object()` for structured JSON |
| Schema | `zod` | Type-safe output validation |

### How it works

`src/lib/llm.ts` creates a Workers AI model via the `AI` binding from the Cloudflare environment:

```ts
import { createWorkersAI } from "workers-ai-provider";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getModel() {
  const { env } = await getCloudflareContext({ async: true });
  const workersai = createWorkersAI({ binding: env.AI });
  return workersai(process.env.CF_AI_MODEL ?? "@cf/moonshotai/kimi-k2.6");
}
```

The suggest route calls the model via Vercel AI SDK:

```ts
const { output } = await generateText({
  model,
  output: Output.object({ schema: SuggestionSchema }),
  system: SYSTEM_PROMPT,
  prompt: userContent,
});
```

`Output.object()` instructs the model to return structured JSON matching the Zod schema. The model must be initialized at request time (not module load time) — the Cloudflare context is not available at build time.

### Config

```bash
# Local dev — .dev.vars (gitignored)
CF_AI_MODEL=@cf/moonshotai/kimi-k2.6   # optional, this is the default

# Production — set via wrangler.jsonc AI binding (no separate API key needed)
```

The `AI` binding is declared in `wrangler.jsonc` and injected automatically. No external API keys required.

### Choosing a model

Set `CF_AI_MODEL` to any text-generation model available on Cloudflare Workers AI:

| Model | Speed | Quality |
|---|---|---|
| `@cf/moonshotai/kimi-k2.6` | Fast | High (current default) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Fast | High |
| `@cf/meta/llama-3.1-8b-instruct` | Very fast | Medium |

## Structured Output Schema

```typescript
// Enforced by StructuredOutputParser.fromZodSchema() + Zod at runtime
type Suggestion = {
  name: string;                     // Vietnamese category name
  type: "income" | "expense";
  parent_category_id: number | null; // must be null or a valid existing category ID
  example_notes: string[];           // max 3 real transaction notes
  transaction_count: number;
};

type LLMResponse = {
  suggestions: Suggestion[];
};
```

The server validates `parent_category_id` belongs to the user before returning/creating.

## API Route

`POST /api/categories/suggest`

No request body — uses authenticated user's own data.

**Flow:**
1. Authenticate
2. Find the last completed run (`status = 'done'`) to get the `from_tx_id` window boundary
3. Fetch all categories (flat list with id, name, type, level)
4. Fetch transactions with notes that are **new since the last run** (`id > from_tx_id AND id <= current_max_id`)
5. Create an `ai_suggestion_run` record with `status = 'pending'` (or `'done'` if no new transactions)
6. Call model with `generateText` + `Output.object({ schema: SuggestionSchema })`
7. Validate `parent_category_id` values belong to user; filter out invalid ones
8. Return suggestions with enriched `parent_category_name`

**Response:**
```typescript
{
  suggestions: Array<{
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    parent_category_name: string | null; // resolved server-side
    example_notes: string[];
    transaction_count: number;
  }>;
  run_id: number; // ID of the created ai_suggestion_run record
}
```

**Errors:**
- `502 AI_ERROR` — AI call failed or returned unparseable output; run record is deleted on failure
- Returns `{ suggestions: [], run_id }` (not an error) when there are no new transactions to analyze

## Three-Endpoint AI Flow

The full suggest → review → recategorize flow spans three endpoints:

```
1. POST /api/categories/suggest
   → returns suggestions + run_id (run status: pending)
   → user reviews suggestions in UI

2. PATCH /api/ai-suggestion-runs/:run_id { "status": "available" }
   → user approves; run transitions pending → available

3. POST /api/transactions/recategorize
   → consumes the available run window
   → returns recategorization suggestions
   → run transitions available → done
```

See `specs/transaction-recategorize.md` for step 3.

## UI

### Button placement
Header row: `Danh mục` title on left, `[✦ Gợi ý]  [+ Thêm]` on right.

### Bottom sheet states
1. **Loading** — spinner + "Đang phân tích X giao dịch..."
2. **Results** — list of suggestion cards (all toggled ON by default)
3. **Empty** — "Danh mục hiện tại đã phù hợp với lịch sử giao dịch"
4. **Error** — "Không thể phân tích lúc này. Thử lại sau."

### Suggestion card
- Category name + income/expense badge
- "└ ParentName" prefix if subcategory
- 2–3 example notes from real transactions (in italic)
- "~N giao dịch" count
- Toggle (default: selected)

### Apply button
"Thêm N danh mục" — calls `POST /api/categories` sequentially,
parents first (null parent_category_id), children second.

## File Plan

```
src/
  lib/
    llm.ts                    ← getLLM() helper — ChatCloudflareWorkersAI singleton
  app/
    api/
      categories/
        suggest/
          route.ts            ← POST handler
    dashboard/
      categories/
        page.tsx              ← add button + bottom sheet UI
```
