---
version: 1.0
name: Calm Ledger
status: active
product: Personal Finance Tracker
reference: "Figma · Personal Finance — iPhone 13 Redesign"
description: A quiet, mobile-first financial interface that makes money easy to scan and decisions easy to make. Precise like a well-kept ledger, calm enough for daily use.
---

# Calm Ledger

## 1. Product idea

This product is a private daily ledger, not a bank terminal, trading dashboard, or marketing site. It helps someone understand their money without making them feel judged or overwhelmed.

Every screen should answer, in order:

1. **What changed?**
2. **Am I still okay?**
3. **What should I do next?**

The interface should feel composed before it feels impressive. Its identity comes from clear numbers, short explanations, quiet dividers, contextual actions, and a stable reading rhythm.

## 2. Design starts from the question

Do not begin a UI task by copying the current DOM, route structure, component inventory, or screenshot. Those are implementation evidence, not the design brief.

Before choosing components, write down:

- **User question:** what is the person trying to understand?
- **Decision or task:** what can they decide or complete here?
- **Information priority:** what must be understood first, second, and only on demand?
- **Truthful states:** loading, empty, partial, error, unusual values, and destructive consequences.
- **Interaction context:** phone width, safe areas, keyboard, reach, and where the user came from.

Only then select or create atoms, molecules, organisms, and templates. Existing components may be reused when they serve the hierarchy; they must not dictate it.

### Consistency contract

Outcome-driven design does **not** mean choosing a new visual direction for each
feature. The user question determines the content and hierarchy; **Calm Ledger
determines how that hierarchy looks and behaves**.

Use this precedence order for every UI decision:

1. An approved Calm Ledger Figma pattern for the same interaction.
2. A canonical pattern explicitly documented in this file.
3. An existing production component that already follows the first two sources.
4. A new pattern, only when none of the above can serve the user task.

The current repository UI is not authoritative merely because it exists, but neither
is it disposable. Reuse a compliant pattern exactly—spacing, type roles, radius,
states, and interaction behavior included. Redesign composition when the user question
requires it; do not redesign the visual language.

When a new pattern is necessary:

- derive it from existing Calm Ledger tokens and neighboring patterns;
- document its purpose, anatomy, variants, states, and responsive behavior here or in
  an approved component spec;
- add or update its Storybook stories;
- use it consistently everywhere the same problem occurs;
- do not introduce a new aesthetic, token family, radius grammar, navigation model, or
  data-visualization grammar inside a feature PR.

Any deliberate visual-language change is a design-system change, not a local styling
choice. It requires explicit user approval and an update to this document before code.

### Screen questions

| Surface | Primary question |
|---|---|
| Dashboard | “Tháng này tiền của tôi đang đi theo hướng nào?” |
| Statistics | “Điều gì đáng chú ý, vì sao, và tôi nên làm gì?” |
| Finance | “Tôi đang nợ, để dành, và chưa thanh toán bao nhiêu?” |
| Budget | “Tôi còn có thể chi bao nhiêu mà vẫn đúng kế hoạch?” |
| Account | “Tôi quản lý dữ liệu và cấu hình của mình ở đâu?” |

## 3. Principles

### Calm before clever

- Prefer a clear hierarchy over novelty.
- Present one primary message per viewport section.
- AI insights read like helpful annotations, not promotional cards.
- Loading and error states preserve the geometry of loaded content.
- Motion confirms change; it never delays access to financial information.

### A ledger, not a dashboard wall

- Transactions form a continuous record; do not wrap every row in its own card.
- Use alignment, typography, whitespace, and hairlines before adding containers.
- Cards are for bounded concepts: a monthly outcome, budget, debt party, finance account, statement, or insight.
- Avoid grids of equal KPI cards when the information has a natural reading order.

### Numbers carry hierarchy

- Amounts receive more contrast than labels.
- Format VND consistently with Vietnamese grouping, `₫` suffix, and no unnecessary decimals.
- Keep sign and amount together.
- Income/expense direction never relies on color alone; pair color with sign, text, or icon.
- Do not abbreviate an important amount when that changes understanding.

### Mobile is canonical

- Canonical artboard: `390 × 844`.
- Verify every layout at `375px` before desktop.
- Minimum touch target: `44 × 44px`.
- Page gutter: `20px`.
- Structural rhythm: `8px`; use `4px` only for optical corrections.
- Respect top safe area, bottom Home Indicator, bottom navigation, and the on-screen keyboard.

### One accent, several meanings

Action Blue is the only interactive accent. Income green, expense red, and warning amber are semantic data colors—not competing brand accents.

- Blue: action, selection, focus, progress.
- Green: income, settled, safely under a limit.
- Red: expense when direction matters, destructive action, exceeded limit.
- Amber: borrowed debt, due soon, approaching a limit.
- Semantic colors do not become decorative card backgrounds.

## 4. Color system

### Canonical palette

| Role | CSS token | Value | Use |
|---|---|---:|---|
| Action | `--primary` | `#0066cc` | Links, primary actions, selected state |
| Focus | `--primary-focus` | `#0071e3` | Focus ring and strong selection outline |
| Action on dark | `--primary-on-dark` | `#2997ff` | Actions on rare dark surfaces |
| Primary ink | `--ink` | `#1d1d1f` | Amounts, headings, essential labels |
| Secondary ink | `--ink-muted-80` | `#333333` | Supporting labels and dense copy |
| Muted ink | `--ink-muted-48` | `#7a7a7a` | Dates, metadata, placeholders |
| Canvas | `--canvas` | `#ffffff` | Main reading surface |
| Paper | `--canvas-parchment` | `#f5f5f7` | App background and grouped regions |
| Raised surface | `--surface-pearl` | `#fafafc` | Inputs and quiet bounded surfaces |
| Soft divider | `--divider-soft` | `#f0f0f0` | Separation in dense groups |
| Hairline | `--hairline` | `#e0e0e0` | Explicit boundaries and input outlines |
| Income/success | `--success` | `#34c759` | Positive cash flow and settled state |
| Expense/danger | `--danger` | `#ff3b30` | Negative cash flow and destructive state |
| Warning | `--warning` | `#c77800` | Borrowed debt, overdue, budget attention |
| Overlay | `--surface-black` | `#000000` | Modal scrim and rare high-contrast surface |
| On action/dark | `--on-primary`, `--on-dark` | `#ffffff` | Foreground on strong fills |

`--warning` is a target token. Add it to `globals.css` before component use.

Pure black is not the product’s navigation theme. Persistent black navigation, alternating dark marketing tiles, and photographic surface colors are legacy concepts and must not guide new product UI.

### Contrast

- Body text meets WCAG AA at minimum.
- Muted text is not allowed for balances, required instructions, form errors, or interactive labels.
- Bright semantic colors may be used for bars and icons; validate contrast before using them as small text.
- Every focusable control has a visible `:focus-visible` ring independent of fill.

## 5. Typography

SF Pro Display gives financial outcomes authority; SF Pro Text keeps dense records readable. System fallbacks are intentional.

| Role | Spec | Use |
|---|---|---|
| Display | 34/38, 600, tight tracking | Primary balance or monthly outcome; at most once per screen |
| Title | 28/33, 600 | Screen title, major sheet title |
| Heading | 21/26, 600 | Section heading, featured insight |
| Body strong | 17/23, 600 | Transaction name, button, important label |
| Body | 17/25, 400 | Explanations, values, form content |
| Compact | 15/21, 400 | Dense supporting text |
| Caption | 13/18, 400 | Date, category path, helper text |
| Micro | 11/14, 600 | Eyebrow and chart annotation; never essential content |

Rules:

- Use tabular numerals where balances or columns must align.
- Keep amount and currency suffix on one line.
- Scale a large amount from 34px to 28px on narrow screens; never ellipsize it.
- Use weight 400 for body and 600 for emphasis. Avoid 500 as an accidental intermediate hierarchy.
- Do not use authenticated-app hero typography above 40px.

## 6. Layout and rhythm

### Spacing

| Role | Value |
|---|---:|
| Optical correction | 4px |
| Tight relationship | 8px |
| Control/content gap | 12px |
| Compact card padding | 16px |
| Phone page gutter | 20px |
| Section/card separation | 24px |
| Major section break | 32px |
| Empty-state breathing room | 48px |
| Rare editorial break | 64px |

The existing `--space-md: 17px` is Apple-derived legacy. New designs use 16px. Change the global token only in a dedicated migration because existing layouts may depend on it.

### Responsive structure

| Width | Behavior |
|---|---|
| 320–374px | Preserve 20px gutter when possible; fall back to 16px. Stack actions. Scale large amounts, not body text. |
| 375–430px | Canonical one-column phone layout with bottom navigation. |
| 431–767px | Same reading order with more outer space; sheets remain bottom-aligned. |
| 768–1023px | Centered content; use two columns only for independent subjects; sheets may become dialogs. |
| ≥1024px | Cap ledger flows near 720px and analytics/management near 1040px. A larger viewport does not justify equal-weight dashboard grids. |

Full-bleed backgrounds may reach screen edges, but their content remains on the page grid. Content always reserves enough bottom padding for navigation and safe areas.

## 7. Shape, surface, and elevation

| Radius | Use |
|---|---|
| 8px | Compact control, chip, inline utility |
| 12px | Input and standard card |
| 18px | Summary card and prominent bounded section |
| 24px | Bottom sheet and large modal |
| Pill | Badge, segmented selector, compact primary action |

- Do not turn every container into a rounded card.
- Transaction lists, settings lists, and timelines normally share a surface with internal dividers.
- Default UI has no shadow; use hairlines and surface contrast for grouping.
- One soft shadow treatment is allowed for temporary floating surfaces above a scrim.
- Avoid decorative gradients, glass effects, and layered translucent cards.

## 8. Component language

### Buttons

- **Primary:** blue fill, white label, one dominant action per action region. Full width is appropriate in forms and sheets.
- **Secondary:** neutral fill or canvas with hairline border and ink label.
- **Ghost:** no fill, blue label, low emphasis.
- **Destructive:** red appears only at the final destructive confirmation; cancellation is neutral.
- Cover default, pressed, focus-visible, disabled, and loading. Loading keeps width and accessible label.

### Inputs and forms

- Inputs use a quiet white/pearl surface, visible hairline, 12px radius, and 44px minimum height.
- Labels remain visible after entry; placeholders are examples, not labels.
- Amount is the strongest entry point in `TransactionForm`.
- Validation sits next to the failing field and explains recovery.
- Input font is at least 17px on iOS to avoid automatic zoom.

### Transactions

- A row has a stable rhythm: identity → context → amount.
- Emoji/category icon anchors the left edge but is not decoration.
- Use the note or category as primary label—whichever is more specific.
- Date, category path, debt party, and custom budget are metadata.
- Align amount right; add sign and semantic color when useful.
- Use dividers, not one card per transaction.

### Summaries and budgets

- Monthly outcome is the first reading point.
- Budget progress communicates amount before percentage.
- Budget status uses familiar language: “vẫn trong ngân sách”, “chi nhanh hơn kế hoạch”, “chưa có ngân sách”.
- Progress bars normally have one semantic fill and a neutral track; no gradients. On the Dashboard, unpaid credit-card spend may appear as an amber segment within total spending, paired with a textual “Dư nợ thẻ tín dụng” label so color is not the only cue.
- Over-budget adds text/icon and never relies on a red bar alone.

### Finance

The Finance screen answers one combined question across three content modes: **Nợ, Tiền gửi, Chi thẻ**.

- The three labels are a content selector, not a second navigation bar.
- Do not add an ambiguous global `+`. Use contextual actions such as “Thêm khoản nợ”.
- Keep `TransactionForm` as the single place to record a transaction.
- Show the most important total first; supporting totals are secondary, not equal KPI cards.
- Never hide reverse balances with `Math.abs()`; explain “Đã trả dư”, “Đã nhận dư”, or “Đã rút vượt”.
- Clarify that unpaid card spend is already included in total expense.
- A card may preview only the latest transaction; detail screens hold full history.
- Destructive confirmation names the object and consequence; do not use `window.confirm`.

### Navigation

- Global navigation is mobile-first: Tổng quan, Thống kê, Tài chính, Tài khoản.
- Active destination uses Action Blue plus a non-color cue.
- Top bars are quiet contextual headers, not permanent black marketing navigation.
- Detail and management screens expose an explicit back action.
- Navigation labels do not disappear merely to look cleaner.

### Sheets and overlays

- Bottom sheets are the default phone surface for short contextual decisions.
- Use 24px top radius, a dimmed scrim, visible close action, and safe-area-aware bottom padding.
- Keep title and primary action stable while internal content scrolls.
- Lift or resize appropriately for the keyboard.
- Never nest a modal inside another modal; replace or close the current one.

## 9. Statistics and AI

Statistics answers: **“Điều gì đáng chú ý, vì sao, và tôi nên làm gì?”** It is a narrative, not a wall of charts.

- One specific headline, one concise explanation, one useful chart when comparison is meaningful.
- Highlight the datum discussed by the narrative, not automatically the largest value.
- Use Action Blue for the focal series and neutral gray for context. Reserve semantic colors for actual financial meaning.
- Do not render a chart for one value; show a sentence and amount.
- Axes, labels, and values remain legible at 375px.
- The semantic layer computes metrics; AI interprets them and must not invent arithmetic.
- Distinguish observation from recommendation.
- Dirty reports may remain visible with a refresh cue; do not replace useful existing data with a blank loader.
- Generation states explain progress in user terms without exposing raw model internals.

## 10. Content design

- Vietnamese is the default voice.
- Use short, direct, familiar financial language.
- Prefer “Chi tháng này” over abstract terms such as “Total outflow”.
- Never shame the user. State the fact, consequence, and recoverable next action.
- Buttons are verbs: “Lưu giao dịch”, “Điều chỉnh”, “Liên kết”, “Thử lại”.
- Confirmation copy names the affected object and consequence.
- Use precise labels such as “Còn phải trả”, “Còn được nhận”, and “Chưa thanh toán” instead of generic “Số dư”.

## 11. Motion and accessibility

- Pressed controls may scale subtly to 0.98; avoid a global 0.95 jump on dense mobile UI.
- Sheets use a short fade plus vertical slide, approximately 180–240ms.
- List changes preserve context and do not reanimate the whole page.
- Respect `prefers-reduced-motion`.
- Minimum touch target is 44 × 44px; default body is 17px.
- Icon-only controls require accessible names.
- Charts include a textual summary and accessible data representation.
- Color is never the only representation of direction, debt type, status, or validation.
- Sheets trap focus and restore it to their trigger.

## 12. State completeness

Every feature design covers more than the happy path:

- initial loading and background refresh;
- empty collection and created-but-unused entity;
- partial failure when independent data sources exist;
- field validation and recoverable server error;
- long names, large amounts, narrow screens, and open keyboard;
- zero, negative, reverse-direction, overdue, and settled financial values;
- pending, success, duplicate-submission prevention, and destructive confirmation;
- expired session and unavailable network.

Do not display an empty state before the first request finishes. During background refresh, keep stale-but-useful data visible.

## 13. Implementation contract

`DESIGN.md` defines product intent and canonical values. `src/app/globals.css` implements the tokens and exposes Tailwind utilities through `@theme inline`.

- Prefer token-backed Tailwind utilities.
- Never hardcode color, font size, spacing, or radius when a token exists.
- Inline style is for runtime values such as progress width and chart geometry.
- Arbitrary Tailwind values are for documented optical corrections, not a parallel token system.
- Add a visual token here first, then to `globals.css`, then cover it in Storybook.
- Pages fetch data. Components own visual hierarchy and interaction presentation.
- Stories cover default, loading, disabled, empty, error, selected, destructive, and narrow states as relevant.

### Migration from the old Apple system

| Existing token/concept | Calm Ledger action |
|---|---|
| `--primary`, focus variants | Keep as the single action accent |
| Neutral ink/canvas/paper/hairline tokens | Keep |
| `--success`, `--danger` | Keep and use semantically, not decoratively |
| `--surface-black` | Limit to scrims and rare high-contrast surfaces |
| `--surface-tile-*` | Deprecate; do not use in new work |
| `--surface-chip-translucent` | Deprecate; photography-control legacy |
| `--body-muted` | Deprecate after migrating duplicate usages |
| `--space-md: 17px` | Migrate deliberately to 16px |
| Product photography and product tiles | Remove from product design vocabulary |
| Permanent black global navbar | Replace with contextual product navigation |
| Product-image-only shadow rule | Replace with floating-surface-only elevation |
| — | Add `--warning`, `--space-page`, and `--radius-sheet` before use |

Deprecation means “do not use in new work.” Remove a token only after repository-wide migration and visual verification.

## 14. Review checklist

Before accepting a UI change:

- What user question does this screen answer?
- What decision or task can the user complete?
- Which approved Calm Ledger patterns does it reuse?
- If it introduces a new pattern, is the gap and system-level decision documented?
- Is the first reading point the most important information—not merely what the API returns first?
- Is there exactly one dominant action in each action region?
- Are numbers easier to scan than their labels?
- Does it work at 375px without horizontal scrolling?
- Are touch targets at least 44px?
- Is any financial meaning communicated by color alone?
- Could spacing or a divider replace a card?
- Are loading, empty, error, unusual-value, and destructive states designed?
- Does the copy describe financial reality precisely and without judgment?
- Are Storybook stories updated?

## 15. Explicit exclusions

These do not belong to Calm Ledger:

- product photography as a layout primitive;
- full-bleed marketing tiles alternating light and dark;
- desktop-first four/five-column product grids;
- permanent black global navigation;
- decorative glass, gradients, or card shadows;
- marketing hero type inside the authenticated app;
- Apple Store concepts such as configurators, product cards, “Buy” CTAs, or purchase bars.

The Apple influence retained is limited to typographic care, platform-native behavior, restrained color, and precise spacing. The identity is the calm ledger—not an Apple website replica.
