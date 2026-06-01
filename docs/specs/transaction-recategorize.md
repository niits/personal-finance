# Transaction Recategorize

> **⚠️ Superseded by `EPIC_3_AI_REFACTOR.md`.** Recategorization is now part of the batch AI Organize flow (`/api/ai/organize`), not a standalone Categories-screen action, and runs on OpenAI `gpt-4.1-nano` via the Cloudflare AI Gateway rather than Workers AI. Kept for history only.

| Field | Value |
|-------|-------|
| Type | Feature Specification |
| Status | Superseded |
| Version | 1.0 |
| Author | niits |
| Created | 2026-05-06 |
| Last Updated | 2026-05-06 |
| Related | specs/ai-category-suggestions.md, TECHNICAL_DESIGN.md §4.9 |

---

## Summary

AI-powered endpoint that reviews transactions within a specific window and suggests better category assignments. Part of a three-step flow that starts with `POST /api/categories/suggest` (see `specs/ai-category-suggestions.md`).

---

## `ai_suggestion_run` Table

Tracks the transaction window and lifecycle of each AI suggestion session.

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `user_id` | TEXT NOT NULL | |
| `from_tx_id` | INTEGER nullable | Exclusive lower bound; `null` = start from beginning of history |
| `up_to_tx_id` | INTEGER NOT NULL | Inclusive upper bound (max transaction id at time of suggest call) |
| `status` | TEXT | `'pending'` → `'available'` → `'done'` |

**Status transitions:**

| Transition | Triggered by |
|------------|-------------|
| (new) → `pending` | `POST /api/categories/suggest` when new transactions exist |
| (new) → `done` | `POST /api/categories/suggest` when no new transactions (empty window) |
| `pending` → `available` | `PATCH /api/ai-suggestion-runs/:id { status: "available" }` — user approves suggestions |
| `available` → `done` | `POST /api/transactions/recategorize` — window is consumed |

---

## Endpoint

`POST /api/transactions/recategorize`

No request body — operates on the authenticated user's own data.

### Flow

1. Authenticate
2. Find the most recent run with `status = 'available'` for the current user
3. If none → `404`
4. Fetch all **leaf categories** for the user (categories with no children)
5. Fetch transactions in the run's window (`id > from_tx_id AND id <= up_to_tx_id`) that have notes
6. Mark the run `'done'` **before** the LLM call — the window is committed regardless of AI outcome
7. If no transactions in window → return `{ suggestions: [] }`
8. Call `generateObject({ model, schema: RecategorizeSchema, ... })`
9. Filter suggestions: remove any where `suggested_category_id` is not a leaf or matches the current category
10. Return enriched suggestion list

### `RecategorizeSchema` (Zod)

```typescript
const RecategorizeSchema = z.object({
  recategorizations: z.array(
    z.object({
      transaction_id: z.number().int(),
      suggested_category_id: z.number().int(),  // must be a leaf category ID
      reason: z.string(),                         // 1 sentence in Vietnamese
    }),
  ),
});
```

### Response

```typescript
{
  suggestions: Array<{
    transaction_id: number;
    note: string;                    // original transaction note
    current_category_id: number;
    current_category_name: string;
    suggested_category_id: number;
    suggested_category_name: string;
    reason: string;                  // Vietnamese, 1 sentence
  }>;
}
```

Returns `{ suggestions: [] }` when:
- No transactions with notes in the run window
- All suggestions were filtered out (invalid category IDs, same-category suggestions)

### Errors

| Code | Condition |
|------|-----------|
| `401` | No valid session |
| `404` | No run with `status = 'available'` found for current user |
| `502 AI_ERROR` | `generateObject` failed or returned unparseable output |

> On `502`, the run has already been marked `'done'`. The window is consumed — a new suggest call is needed to create a fresh run.

---

## System Prompt

```
Bạn là trợ lý tài chính. Phân tích các giao dịch và gợi ý đổi danh mục khi danh mục hiện tại không phù hợp.

Danh mục được cung cấp đều là danh mục lá (leaf) — chỉ được chọn từ danh sách này.

Quy tắc:
1. Chỉ gợi ý khi có danh mục RÕ RÀNG phù hợp hơn trong danh sách
2. suggested_category_id PHẢI là ID từ danh sách danh mục lá đã cung cấp
3. Không gợi ý nếu danh mục hiện tại đã phù hợp
4. reason ngắn gọn, 1 câu tiếng Việt
5. Trả về danh sách rỗng nếu mọi danh mục đã phù hợp
```

---

## File Location

```
src/app/api/transactions/recategorize/route.ts
```
