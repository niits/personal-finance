# AI Organize — Component Design Spec

| Field | Value |
|-------|-------|
| Type | Feature Spec + CDD Component Design |
| Status | Active |
| Epic | Epic 3: AI Refactor |
| GitHub issue | #64 |
| Related | EPIC_3_AI_REFACTOR.md, COMPONENT_ARCHITECTURE.md |

---

## 1. Feature Overview

A single "Tổ chức ✦" button on the dashboard triggers a full AI organization pass:

1. Calls `POST /api/ai/organize` — no DB writes, returns a preview of proposed changes
2. Shows `OrganizeReviewSheet` — user reviews and selects what to apply
3. User taps "Áp dụng" → `POST /api/ai/organize/apply` — writes selected changes
4. Dashboard and categories reload

---

## 2. User Flow

```
Dashboard (idle)
  └─ Tap "Tổ chức ✦"
       └─ Button enters loading state
            └─ POST /api/ai/organize (1–5s)
                 └─ OrganizeReviewSheet slides up
                      ├─ Section: "Danh mục mới" — checkbox per new category
                      ├─ Section: "Emoji" — "Sẽ gán emoji cho N danh mục" (count, auto-included)
                      └─ Section: "Phân loại lại" — checkbox per transaction reclassification
                           └─ Tap "Áp dụng"
                                └─ Sheet shows applying state (spinner)
                                     └─ POST /api/ai/organize/apply
                                          └─ Sheet closes, dashboard reloads
```

---

## 3. Component Breakdown

### 3.1 New atoms — none required

Existing atoms (`Button`, `Badge`, `Spinner`, `EmojiIcon`) cover all needs.

### 3.2 New molecules

#### `OrganizeSectionHeader`

Section divider used inside the review sheet. Displays a title and an optional count badge.

```typescript
type OrganizeSectionHeaderProps = {
  title: string;        // e.g. "Danh mục mới"
  count?: number;       // shown as badge when provided
  autoIncluded?: boolean; // shows "(tự động)" note when true
};
```

Stories:
- `WithCount` — "Danh mục mới" + count badge
- `AutoIncluded` — "Emoji" + auto-included note, no checkbox
- `Empty` — zero count, section grayed out

#### `NewCategoryRow`

A checkable row representing an AI-proposed new category.

```typescript
type NewCategoryRowProps = {
  tempId: string;          // "new:0", "new:1" …
  name: string;
  type: "income" | "expense";
  exampleNotes: string[];  // up to 3, shown as sub-text
  checked: boolean;
  onChange: (tempId: string, checked: boolean) => void;
};
```

Stories:
- `Checked` — expense category with 2 example notes
- `Unchecked` — income category, no examples
- `LongName` — name overflow with ellipsis

#### `RecategorizationRow`

A checkable row representing an AI-proposed transaction reclassification.

```typescript
type RecategorizationRowProps = {
  transactionId: number;
  note: string;           // transaction note shown as identifier
  currentCategory: string;
  suggestedCategory: string; // may be a new category name (resolved from temp_id)
  reason: string;
  checked: boolean;
  onChange: (transactionId: number, checked: boolean) => void;
};
```

Stories:
- `Checked` — shows "Ăn trưa: Di chuyển → Ăn uống"
- `Unchecked`
- `NewCategory` — suggested category is newly proposed (shown with ✦ prefix)
- `LongReason` — reason text truncated with expand on tap

### 3.3 New organisms

#### `OrganizeReviewSheet`

Bottom sheet with 3 sections. Manages its own checkbox selection state. Emits a filtered payload on apply.

```typescript
type OrganizePreview = {
  new_categories: {
    temp_id: string;
    name: string;
    type: "income" | "expense";
    parent_category_id: number | null;
    example_notes: string[];
  }[];
  emoji_assignments: {
    category_id: number;
    emoji: string;
  }[];
  recategorizations: {
    transaction_id: number;
    note: string;
    current_category_id: number;
    current_category_name: string;
    suggested_category_id: number | string; // number | "new:N"
    suggested_category_name: string;        // resolved display name
    reason: string;
  }[];
};

type OrganizeReviewSheetProps = {
  open: boolean;
  preview: OrganizePreview | null;
  applying: boolean;
  onApply: (selection: OrganizeSelection) => void;
  onClose: () => void;
};

type OrganizeSelection = {
  new_categories: OrganizePreview["new_categories"];
  emoji_assignments: OrganizePreview["emoji_assignments"]; // always full list
  recategorizations: OrganizePreview["recategorizations"];
};
```

Internal state:
- `selectedCategoryTempIds: Set<string>` — starts with all checked
- `selectedTransactionIds: Set<number>` — starts with all checked

Stories:
- `Empty` — preview with nothing to do (all arrays empty)
- `CategoriesOnly` — only new_categories populated
- `Full` — all 3 sections with realistic data
- `Applying` — applying=true, CTA replaced with spinner
- `Closed` — open=false (renders nothing)

### 3.4 Template changes — `DashboardTemplate`

Adds `organizeState` and `organizePreview` props. Renders the button and wires `OrganizeReviewSheet`.

New props added to `DashboardTemplateProps`:

```typescript
organizeState: "idle" | "loading" | "review" | "applying";
organizePreview: OrganizePreview | null;
onOrganize: () => void;
onOrganizeApply: (selection: OrganizeSelection) => void;
onOrganizeClose: () => void;
```

Button placement: above the transaction list, right-aligned, shown only when `isCurrentMonth` is true.

Button label:
- `idle` → "Tổ chức ✦"
- `loading` → `<Spinner size="sm" />` + "Đang phân tích…"
- `review` / `applying` → hidden (sheet is open)

### 3.5 Page changes — `src/app/(app)/page.tsx`

New state:
```typescript
const [organizeState, setOrganizeState] = useState<"idle" | "loading" | "review" | "applying">("idle");
const [organizePreview, setOrganizePreview] = useState<OrganizePreview | null>(null);
```

New handlers:
```typescript
async function handleOrganize() { ... }      // calls POST /api/ai/organize
async function handleOrganizeApply(selection) { ... } // calls POST /api/ai/organize/apply
function handleOrganizeClose() { ... }
```

---

## 4. State Machine

```
idle ──[tap button]──▶ loading
loading ──[API success]──▶ review
loading ──[API error]──▶ idle          (show toast TBD)
review ──[tap Áp dụng]──▶ applying
review ──[tap close / backdrop]──▶ idle
applying ──[API success]──▶ idle       (reload data)
applying ──[API error]──▶ review       (stay on sheet, re-enable button)
```

---

## 5. API Contracts (summary)

### POST /api/ai/organize

No body. Reads userId from session.

Response `200`:
```json
{
  "new_categories": [...],
  "emoji_assignments": [...],
  "recategorizations": [...]
}
```

### POST /api/ai/organize/apply

Body: `OrganizeSelection` (user-filtered subset of preview).

Response `200`: `{ "ok": true }`

Full contracts in `TECHNICAL_DESIGN.md §4.10`.

---

## 6. Storybook Coverage Checklist

| Component | Stories required |
|-----------|-----------------|
| `OrganizeSectionHeader` | WithCount, AutoIncluded, Empty |
| `NewCategoryRow` | Checked, Unchecked, LongName |
| `RecategorizationRow` | Checked, Unchecked, NewCategory, LongReason |
| `OrganizeReviewSheet` | Empty, CategoriesOnly, Full, Applying, Closed |
| `DashboardTemplate` | update existing Default story with new `organizeState="idle"` prop |

---

## 7. Implementation Order

1. `OrganizeSectionHeader` atom-sized molecule — no deps
2. `NewCategoryRow` — uses `Badge`, `EmojiIcon`
3. `RecategorizationRow` — uses `Badge`
4. `OrganizeReviewSheet` — composes 1–3; needs mock `OrganizePreview` fixtures
5. `DashboardTemplate` prop additions + button render
6. `page.tsx` state + handlers
7. API routes (`/api/ai/organize`, `/api/ai/organize/apply`)
