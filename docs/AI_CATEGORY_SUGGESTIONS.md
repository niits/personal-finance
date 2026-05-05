# AI Category Suggestions

Analyzes all transaction notes and existing categories, then suggests new categories using Claude.

## Final Design Decisions

- **Button**: "✦ Gợi ý" in the Categories page header, always visible (next to "+ Thêm")
- **Flow**: 2 steps only — Loading → Results (no scope selection)
- **Model**: `@cf/qwen/qwen1.5-14b-chat-awq` (configurable via `CF_AI_MODEL`) via Cloudflare Workers AI
- **LLM input**: all categories (as `{id, name, type, level}[]`) + all transactions with notes
- **Parent resolution**: LLM receives `{id, name}[]` for existing categories, must return `parent_category_id` as a valid ID; server validates ownership before creating
- **Structured output**: `output_config.format.json_schema` enforced by the API

## LangChain + Cloudflare Workers AI Setup

LLM calls use **`@langchain/cloudflare`** (`ChatCloudflareWorkersAI`) with **`@langchain/core`** for the LCEL pipeline. Calls route through **Cloudflare AI Gateway** for logging, caching, and rate limiting.

### Stack

| Layer | Package | Role |
|---|---|---|
| Model | `@langchain/cloudflare` | `ChatCloudflareWorkersAI` — runs CF Workers AI models |
| Pipeline | `@langchain/core` | `RunnableSequence`, `ChatPromptTemplate`, `StructuredOutputParser` |
| Schema | `zod` | Type-safe output validation |
| Gateway | Cloudflare AI Gateway | HTTP proxy in front of Workers AI |

### 1. Create a gateway in Cloudflare dashboard
AI → AI Gateway → Create gateway. Note the **Account ID** and **Gateway ID**.

### 2. Get a Cloudflare AI API token
Dashboard → My Profile → API Tokens → Create Token. Grant **Workers AI: Run** permission.

### 3. Add secrets

```bash
# Local dev — add to .dev.vars (gitignored)
CF_ACCOUNT_ID=abc123...
CF_AI_API_TOKEN=...        # Cloudflare API token with Workers AI Run permission
CF_GATEWAY_ID=personal-finance
CF_AI_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast   # optional, this is the default

# Production
wrangler secret put CF_AI_API_TOKEN --env production
wrangler secret put CF_ACCOUNT_ID --env production
wrangler secret put CF_GATEWAY_ID --env production
```

Access via `process.env.*` — opennextjs bridges CF secrets to Node.js env.

### How it works

`src/lib/llm.ts` creates a `ChatCloudflareWorkersAI` instance with `baseUrl` pointing to the AI Gateway:
```
https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/workers-ai/
```
Falls back to direct CF API if `CF_GATEWAY_ID` is not set.

The suggest route builds a **LCEL chain**: `ChatPromptTemplate → model → StructuredOutputParser`.
`StructuredOutputParser.fromZodSchema()` injects JSON format instructions into the system prompt automatically — no separate API feature needed.

### Choosing a model

Set `CF_AI_MODEL` to any text-generation model on Cloudflare Workers AI:

| Model | Speed | Quality |
|---|---|---|
| `@cf/qwen/qwen1.5-14b-chat-awq` | Fast | High (default) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Fast | High |
| `@cf/meta/llama-3.1-8b-instruct` | Very fast | Medium |

> **OpenAI models**: To use `gpt-4o-mini` via Cloudflare AI Gateway (OpenAI provider), install `@langchain/openai` and point `baseURL` to `.../openai` with an `OPENAI_API_KEY`.

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
2. Fetch all categories (flat list with id, name, type, level)
3. Fetch all transactions with notes (no time filter — use all history for better signal)
4. Build prompt + call `claude-haiku-4-5` with json_schema output format
5. Validate `parent_category_id` values belong to user
6. Enrich response with `parent_category_name` for display

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
}
```

**Errors:**
- `400 NOT_ENOUGH_DATA` — fewer than 5 transactions with notes
- `502 AI_ERROR` — Anthropic call failed or returned unparseable output

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
