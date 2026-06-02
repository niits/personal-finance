# Inline-Style → Tailwind-Utility Migration (staging vs main)

**Date:** 2026-06-02
**Scope:** Everything on `staging` since the latest `main` commit (`3f22198`, merge of PR #90).
**Diff command:** `git diff main...staging`

This log is an exhaustive audit of the **UI styling changes** introduced on `staging`. It
covers two things the diff does to the component layer:

1. **Style → class** — static inline `style={{…}}` objects converted to Tailwind utility classes.
2. **Token hygiene** — hardcoded hex / opaque-white `rgba(…)` values replaced with the design
   tokens (`var(--danger)`, `var(--success)`, `var(--body-muted)`, …) and a font-weight
   ladder correction (`500` → `400`/`600`).

It also documents the **global UI settings** that enabled all of the above (`globals.css`,
`DESIGN.md`, the new CSS integrity test).

> **Note on debt feature files.** The Debt-tracking epic added many *new* components
> (`DebtProgressBar`, `DebtPartyCard`, `DebtRepaymentItem`, `LinkTransactionSheet`,
> `DebtOverviewTemplate`, the `debts/*` pages). These have no "before" state, so there is no
> style→class *conversion* to report — but their styling conventions are noted at the end for
> completeness.

---

## 1. Global UI settings

### 1.1 `src/app/globals.css` (+54 lines)

**`@theme inline` token bridge (new).** A `@theme inline { … }` block was added that re-exports
every `:root` design token as a Tailwind utility. `inline` makes the generated utility *reference*
the variable rather than copy its value — e.g. `text-ink` compiles to `color: var(--ink)`. This is
the mechanism that lets old inline `style={{ color: "var(--ink)" }}` and new `className="text-ink"`
resolve to the identical runtime value, enabling incremental migration with zero visual diff.

Tokens exposed as utilities:

| Group | Tailwind prefix | Tokens mapped |
|-------|-----------------|---------------|
| Colors | `--color-*` | `primary`, `primary-focus`, `primary-on-dark`, `ink`, `ink-muted-80`, `ink-muted-48`, `canvas`, `canvas-parchment`, `surface-black`, `surface-tile-1`, `surface-chip-translucent`, `divider-soft`, `hairline`, `surface-white`, `surface-pearl`, `danger`, `success`, `on-dark`, `on-primary`, `body-muted` |
| Radius | `--radius-*` | `sm`, `md`, `lg`, `pill` |
| Spacing | `--spacing-*` | `xxs`, `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `section` (mapped from `--space-*`) |
| Font family | `--font-*` | `display`, `body` |

**Bottom-sheet keyframes (new).** Four CSS keyframes added so sheet enter/exit is driven by CSS
instead of a prop→state effect:

```css
@keyframes sheet-fade-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes sheet-fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes sheet-slide-in  { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes sheet-slide-out { from { transform: translateY(0) } to { transform: translateY(100%) } }
```

### 1.2 `DESIGN.md` (+15 lines)

New **"Styling Implementation"** section codifying the policy this migration follows:

- Tokens defined once in `globals.css` `:root`, re-exported via `@theme inline`.
- **Prefer Tailwind utility classes over inline `style`.** Lists the token utilities
  (`text-ink`, `bg-canvas`, `border-hairline`, `text-ink-muted-48`, `bg-primary`, `p-md`,
  `gap-lg`, `rounded-lg`, `rounded-pill`, `font-display`, `font-body`, …).
- Use arbitrary-value utilities (`text-[15px]`, `leading-[1.3]`, `tracking-[-0.374px]`) for
  one-off type metrics instead of inline `style`.
- Reserve inline `style` for genuinely runtime-dynamic values (progress-bar widths, chart colors).
- Never inline a hex value — reference a token utility or `var(--token-name)`.

### 1.3 `src/app/globals.css.test.ts` (+51 lines, new)

A **CSS custom-property integrity guard** (Vitest). Walks every `.ts/.tsx/.css` file under `src/`,
collects every `var(--token)` reference, and asserts each one is defined in `globals.css`. Added
because an undefined `var(--token)` silently produces an invalid value with no console error (the
`var(--destructive)` → transparent-button bug). This test is what makes the hex→token sweep below
safe to do at scale.

---

## 2. Token-ladder rules applied everywhere

These three substitutions recur across nearly every component touched. They are listed once here
and not repeated per-file in §3/§4.

| Old value | New value | Meaning |
|-----------|-----------|---------|
| `#ff453a`, `rgba(255,69,58,…)` | `var(--danger)`, `rgba(255,59,48,…)` | Danger/expense red — also a slight hue correction (69,58 → 59,48) |
| `#30d158`, `rgba(48,209,88,…)` | `var(--success)`, `rgba(52,199,89,…)` | Success/income green — hue correction (48,209,88 → 52,199,89) |
| `rgba(255,255,255,0.3–0.6)` | `var(--body-muted)` | Muted text on dark surfaces |
| `fontWeight: 500` | `400` or `600` | Removes the off-ladder weight 500; DESIGN.md ladder is 300/400/600/700 |
| `fontSize: 11/13/16` | `12/14/17` | Nudged onto the type scale (caption 12, footnote 14, body 17) |

---

## 3. Style → class conversions (per component)

### Atoms

**`Badge/Badge.tsx`** — *no style→class.* Token/value changes only:
`success` color `#30d158`→`var(--success)` (bg `48,209,88`→`52,199,89`); `danger`
`#ff453a`→`var(--danger)` (bg `255,69,58`→`255,59,48`); md size `fontSize 13→14`;
root `fontWeight 500→600`.

**`Button/Button.tsx`** — *no style→class.* `danger` variant bg `255,69,58`→`255,59,48`,
color `#ff453a`→`var(--danger)`; `sm` size `fontSize 13→14`; `md` size `fontSize 16→17` and
`borderRadius: 12`→`var(--radius-md)`.

**`CurrencyDisplay/CurrencyDisplay.tsx`** — *no style→class.* `formatVND` extracted to a new
`format.ts` (and re-exported via `index.ts`); `sm` size `fontWeight 500→600`; sign colors
`#30d158`/`#ff453a` → `var(--success)`/`var(--danger)`.

**`EmojiIcon/EmojiIcon.tsx`** — **style→class.** Wrapper `<div>` converted:
`borderRadius:"50%"` + `flexShrink:0` + `display:"flex"` + `alignItems`/`justifyContent:"center"`
→ `className="rounded-full shrink-0 flex items-center justify-center"`. Remaining
runtime-dynamic props (`width`/`height`/`background`/`fontSize`, conditional fallback font) stay
inline. Color schemes retokenized: expense `255,69,58`/`#ff453a`→`255,59,48`/`var(--danger)`,
income `48,209,88`/`#30d158`→`52,199,89`/`var(--success)`.

### Molecules

**`BudgetProgressBar/BudgetProgressBar.tsx`** — *no style→class.* `#ff453a`→`var(--danger)`,
`#30d158`→`var(--success)`, dark `rgba(255,255,255,0.5)`→`var(--body-muted)`.

**`MonthStepper/MonthStepper.tsx`** — *no style→class.* `btnStyle` hoisted to module scope;
dark text/chevron `rgba(255,255,255,0.5)`→`var(--body-muted)`; added `type="button"` to both
chevron buttons.

**`OrganizeSectionHeader/OrganizeSectionHeader.tsx`** — *no style→class.* Title `fontSize 13→14`;
count pill `fontWeight 500→600`.

**`PaceChip/PaceChip.tsx`** — **style→class.** Chip `<span>`:
`display:"inline-block"` + `padding:"4px 10px"` + `borderRadius:999` + `fontFamily` +
`fontSize:12` + `fontWeight:600` → `className="inline-block px-2.5 py-1 rounded-full font-body
text-xs font-semibold"`. Dynamic `background`/`color` (status-driven) stay inline. Status colors
retokenized (`#30d158`→`var(--success)`, `#ff453a`→`var(--danger)`, with rgba hue fixes).

**`RecategorizationRow/RecategorizationRow.tsx`** — **style→class.** Note `<p>` fully converted:
`fontFamily/fontSize:15/color/letterSpacing:-0.374/overflow/textOverflow/whiteSpace/lineHeight:1.3`
→ `className="font-body text-[15px] text-ink tracking-[-0.374px] truncate leading-[1.3]"`.

**`StatCard/StatCard.tsx`** — *no style→class*, but restructured: inner `renderValue()` extracted
into a standalone `StatValue` component. Token changes: dark title/narrative
`rgba(255,255,255,0.4/0.5)`→`var(--body-muted)`; card padding `"14px 16px"`→
`"var(--space-sm) var(--space-md)"`; title `marginBottom:6`→`var(--space-xs)`; narrative
`fontSize 13→14`, `lineHeight 1.5→1.43`, `letterSpacing:-0.224` added, `marginTop`→`var(--space-xs)`.

**`TransactionListItem/TransactionListItem.tsx`** — **heavy style→class.**
- Root row: `display:flex/alignItems/padding:"10px 16px"/borderTop/cursor/minHeight:44/gap:10/
  background` → `className="flex items-center px-4 py-3 gap-3 min-h-[44px] bg-canvas …"` with
  conditional `border-t border-hairline` and `cursor-pointer`/`cursor-default`. Added keyboard a11y
  (`role`, `tabIndex`, `onKeyDown` Enter/Space).
- Category `<p>`: inline → `className="font-body text-[17px] text-ink tracking-[-0.374px] truncate
  leading-[1.3]"` (note **fontSize 15→17**).
- Note `<p>`: inline → `className="font-body text-[14px] text-ink-muted-48 truncate leading-[1.43]
  tracking-[-0.224px] min-h-[1em]"` (**fontSize 12→14**).
- Custom-budget wrapper: `display:flex/gap:4/marginTop:3` → `className="flex gap-1 mt-xxs
  items-center"`; per-badge span `maxWidth:90/overflow/textOverflow` → `className="max-w-[90px]
  overflow-hidden text-ellipsis"`.
- Amount wrapper: `display:flex/alignItems/gap:8/flexShrink:0` → `className="flex items-center
  gap-2 shrink-0"`.
- New debt-context line added (`💸 Cho vay/Đi vay · {party}`) using utility classes.

### Organisms

**`DashboardSummary/DashboardSummary.tsx`** — *no style→class.* Period date
`rgba(255,255,255,0.3)`→`var(--body-muted)`, margin `"2px 0 8px"`→`"4px 0 10px"`; "đã chi" line
`rgba(255,255,255,0.45)`→`var(--body-muted)`, `marginTop:4`→`var(--space-xs)`; income/savings tiles
`gap:1→2`, `marginTop:16`→`var(--space-md)`, `borderRadius:10`→`var(--radius-md)`,
padding `"10px 14px"`→`"12px 14px"`, labels retokenized + `letterSpacing:-0.12`.

**`EmojiPicker/EmojiPicker.tsx`** — **style→class + feature.** (Logic: added keyword→emoji
`getSuggestions()`, new `suggestForName` prop, expanded emoji groups, new "Gợi ý" section.) Styling:
- Extracted shared `emojiBtn` renderer with
  `className="size-9 rounded-sm border-none text-[20px] cursor-pointer flex items-center
  justify-center transition-colors"` (was per-button inline `width:36/height:36/borderRadius:8/…`;
  note **36px→size-9/9px-radius** via `rounded-sm`).
- Trigger button: `width:44/height:44/borderRadius:11/background/cursor/display:flex/…/
  transition/color` → `className="size-11 rounded-md bg-canvas-parchment cursor-pointer flex
  items-center justify-center shrink-0 transition-[border-color] text-ink-muted-48"` (dynamic
  border + fontSize stay inline).
- Dropdown panel: `position:absolute/bottom/left/width:280/maxHeight:320/overflowY/background/
  border/borderRadius:14/boxShadow/zIndex:500/padding` → `className="absolute
  bottom-[calc(100%+8px)] left-0 w-[300px] max-h-[360px] overflow-y-auto bg-canvas border
  border-hairline rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.14)] z-[500] py-2"` (note
  **width 280→300, maxHeight 320→360**).
- Group label `<p>`: inline → `className="font-body text-[10px] font-semibold text-ink-muted-48
  tracking-[0.5px] uppercase mb-1 pl-0.5"`.

**`Navbar/Navbar.tsx`** — **style→class.**
- `<nav>`: `position:fixed/top/left/right/zIndex:100/height:44/background/display:flex/alignItems/
  padding:"0 22px"/justifyContent` → `className="fixed top-0 left-0 right-0 z-[100] h-11
  bg-surface-black flex items-center justify-between px-[22px]"`.
- Sign-in / sign-out / username buttons: inline `background:transparent/border:none/color/
  fontFamily/fontSize:12/cursor/padding:"4px 0"/letterSpacing:-0.12` → `className="bg-transparent
  border-none text-primary-on-dark font-body text-xs cursor-pointer py-1 px-0 tracking-[-0.12px]"`;
  username span `rgba(255,255,255,0.6)`→`var(--body-muted)`, `fontSize 12→14`,
  `letterSpacing:-0.224` added. Added `type="button"`.

**`OrganizeReviewSheet/OrganizeReviewSheet.tsx`** — **style→class + a11y.**
- Backdrop: changed `<div onClick>` → semantic `<button aria-label="Đóng">` (inline kept, adds
  `border:none/padding:0/cursor`).
- Sheet container: `position:fixed/bottom/left/right/zIndex:101/background/borderRadius:"16px 16px
  0 0"/maxHeight:80dvh/display:flex/flexDirection/overflow` → `className="fixed bottom-0 left-0
  right-0 z-[101] bg-canvas rounded-t-2xl max-h-[80dvh] flex flex-col overflow-hidden"`.
- Emoji-assignment caption `fontSize 13→14`.
- Apply button: full inline block → `className="w-full p-[14px] rounded-xl border-none font-body
  text-[17px] font-semibold flex items-center justify-center gap-2 tracking-[-0.4px] …"` with
  conditional `bg-canvas-parchment text-ink-muted-48 cursor-default` vs `bg-primary text-white
  cursor-pointer`.

**`TransactionGroup/TransactionGroup.tsx`** — *no style→class.* Header padding
`"10px 16px 6px"`→`"12px 16px 8px"`; date label `fontSize 13→14`.

**`VegaChart/VegaChart.tsx`** — **style→class.** Badge `<span>`:
`fontFamily/fontSize:12/fontWeight:600/borderRadius:8/padding:"3px 8px"/flexShrink:0/marginTop:1`
→ `className="font-body text-xs font-semibold rounded-sm px-2 py-[3px] shrink-0 mt-px"` (dynamic
`color`/`background` stay inline).

**`TransactionForm/TransactionForm.tsx`** — **NO style→class.** Despite being the largest single
diff (+533 / −608), this is a **logic refactor**, not a styling migration: added the
`TransactionFormMode` union (`create` | `create-debt-open` | `repayment` | `edit`), debt-link
state, repayment/unlink submit paths, and rewrote `CategoryDrillDown` to a flat drill list. The
JSX retains inline `style` throughout — **no `className` styling utilities were introduced.** The
only visual touch-ups are type-scale nudges (e.g. drill-down rows / labels `fontSize 13→14`).
`index.ts` now also exports `TransactionFormMode`.

### Templates

**`BudgetTemplate/BudgetTemplate.tsx`** — **the heaviest style→class file** (−129 inline lines).
Converted controls: create-budget amount input + `₫` adornment; preset-amount chips
(`bg-primary text-white` / `bg-canvas-parchment text-ink-muted-48`); confirm button; "Điều chỉnh
ngân sách" button; adjust ± toggle, amount input, note input, cancel/confirm buttons; custom-budget
"+ Thêm" button; new-fund name/amount inputs and cancel/create buttons; edit-fund inputs +
cancel/save; delete-confirm cancel/`bg-danger` confirm; per-fund Sửa / Bật-Tắt / ✕ delete buttons.
Pattern throughout: container/border/padding/radius/typography → utilities, while dynamic
state-colors stay inline. Token sweep: all `#ff453a`→`var(--danger)`/`bg-danger`,
`#30d158`→`var(--success)`, error-text `fontSize 13→14`, headings `fontSize 13→14`. Added
`type="button"` and `aria-label`s on the unlabeled numeric inputs. Progress bar over-color
`#ff453a`→`var(--danger)`.

**`CategoriesTemplate/CategoriesTemplate.tsx`** — **style→class + a11y** (−148 inline lines).
- Recat / suggestion rows: added `role="checkbox"` + `aria-checked` + `tabIndex` + `onKeyDown`.
- Checkbox box: `width:20/height:20/borderRadius:6/flexShrink:0/marginTop:2/display:flex/…`
  → `className="size-5 rounded-[6px] shrink-0 mt-0.5 flex items-center justify-center"` (dynamic
  bg/border stay inline). Applied in **both** the recat and suggest lists.
- Note `<p>`: inline → `className="font-body text-[15px] text-ink tracking-[-0.374px] mb-1 truncate"`.
- Bottom sheet container: full inline → `className="fixed bottom-0 left-0 right-0 bg-canvas
  rounded-t-2xl z-[101] max-h-[80vh] flex flex-col"`.
- Many `type="button"` added; type-scale nudges (`fontSize 11→12`, `13→14`, `15→17`, `16→17`);
  error text `#ff453a`→`var(--danger)`; header `rgba(255,255,255,0.4)`→`var(--body-muted)`.
  (One header step button still had a large inline block truncated in the diff; same pattern.)

**`DashboardTemplate/DashboardTemplate.tsx`** — **style→class + debt support** (+84 / −57).
- `TxnIcon` both branches: `width:32/height:32/borderRadius:"50%"/flexShrink:0/display:flex/…`
  → `className="size-8 rounded-full shrink-0 flex items-center justify-center text-[17px]"`
  (emoji branch) and `… font-display text-[13px] font-semibold` (fallback branch); dynamic bg/color
  inline + retokenized; fallback char now `txn.category?.name ?? "◈"`.
- Fill-emoji button: `borderRadius:"50%"/width:32/height:32/…` → `className="border-none
  rounded-full size-8 flex items-center justify-center cursor-pointer text-base shrink-0 mt-0.5"`.
- Root filter chips: full inline → `className="flex-1 px-1 py-1.5 rounded-full border-none
  cursor-pointer font-body text-[14px] font-semibold truncate …"` with `bg-primary text-white` /
  `bg-canvas-parchment text-ink` (note **fontSize 13→14, fontWeight 500→600**).
- Quick-link `<a>`: inline → `className="flex items-center gap-3 px-4 py-3 bg-canvas-parchment
  rounded-md no-underline text-ink"`.
- Transaction row category/note `<p>`: → utility classes (`font-body text-[15px] text-ink
  tracking-[-0.374px] truncate leading-[1.3]` / `font-body text-xs text-ink-muted-48 truncate …`).
- Custom-budget badges: inline → utility classes (`font-body text-xs font-semibold …`,
  **fontWeight 500→600**); income/savings tiles retokenized (`gap 1→2`, `borderRadius 10`→
  `var(--radius-md)`, padding `10px→12px`, `fontSize 16→17`, whites→`var(--body-muted)`/tokens).
- FAB: full inline → `className="size-14 rounded-full bg-primary text-white text-[28px]
  leading-none border-none cursor-pointer flex items-center justify-center
  shadow-[0_4px_16px_rgba(0,102,204,0.4)]"`.
- Action-sheet backdrop: `<div onClick>` → semantic `<button aria-label="Đóng">`; Sửa button →
  `className="w-full p-[14px] rounded-xl border-none bg-canvas-parchment text-ink font-body
  text-base font-semibold cursor-pointer"`; Xoá button → utility classes (dynamic danger bg inline).
- Added keyboard a11y (`role="button"`, `tabIndex`, `onKeyDown`) on feed rows.
- Debt support: `Transaction` type gains `debt_id`/`debt_party`/`debt_type`; category now nullable
  (`category?.name ?? "Khoản nợ"`, `category?.path ?? "Khoản nợ"`); new `💸` debt line; passes
  `mode={…}` (new `TransactionFormMode`) instead of `transaction={…}` and a `key` to remount.

**`StatisticsTemplate/StatisticsTemplate.tsx`** — **style→class** (+20 / −26).
- Error `<pre>`: full inline → `className="font-mono text-xs leading-[1.45] text-ink-muted-48
  bg-canvas border border-hairline rounded-sm p-3 m-0 whitespace-pre-wrap break-words
  max-h-[320px] overflow-auto"`.
- Retry / "Xem tháng hiện tại" buttons: inline → `className="px-6 py-3 rounded-xl border-none
  bg-primary text-white font-body text-[15px] font-semibold cursor-pointer"`.
- Insight badge `<span>`: → `className="font-body text-xs font-semibold rounded-sm px-2 py-[3px]
  shrink-0 mt-px"` (dynamic color/bg inline).
- AI-processing row: inline → `className="flex gap-2 mt-2 pt-2 border-t border-hairline items-center
  text-ink-muted-48 text-[13px]"`.
- Regen-error banner: container & dismiss `×` button → utility classes; whites →`var(--body-muted)`,
  insight summary `lineHeight 1.5→1.43`, `fontSize 13→14`, error title color `#b94a05`→`var(--danger)`.
- Month chevrons: `type="button"` added; disabled white →`var(--body-muted)`; caption white→token.

---

## 4. Page-level (`src/app`) style → class

**`(app)/layout.tsx`** — **style→class.**
- Bottom `<nav>`: full inline → `className="fixed bottom-0 left-0 right-0 h-[72px] flex items-start
  pt-2 z-50 border-t border-hairline bg-white/[0.92] backdrop-saturate-[1.8] backdrop-blur-[8px]"`.
- Tab `<Link>`: `flex/display/flexDirection/alignItems/gap:3/textDecoration/color/transition`
  → `className="flex-1 flex flex-col items-center gap-[3px] no-underline transition-colors …"`
  with conditional `text-primary` / `text-ink-muted-48`.
- (Also a nav change, not styling: tab list swapped "Danh mục ⊞" for **"Nợ ◈"**, Budget icon
  `◈`→`⊟`.)

**`sign-in/page.tsx`** — **style→class.**
- GitHub button: full inline → `className="w-full flex items-center justify-center gap-2 px-5 py-3
  rounded-md border border-hairline bg-surface-white text-ink font-body text-[15px] font-normal
  cursor-pointer mb-3"` (note **fontWeight 500→400**).
- `ComingSoonCard` icon `<span>`: `width:28/height:28/display:inline-flex/…/borderRadius:
  var(--radius-sm)/background/color/flexShrink` → `className="size-7 inline-flex items-center
  justify-center rounded-sm bg-canvas text-ink-muted-80 shrink-0"`.

**`(app)/page.tsx`** (dashboard) — **style→class.** Retry button inline → `className="font-body
text-[15px] font-semibold text-primary bg-transparent border-none cursor-pointer px-4 py-2"`.
(Rest of diff is a non-visual refactor: hoists `const { signal } = ctrl` for the abort guard.)

**`(app)/account/page.tsx`** — **style→class** (+37 / −72).
- Section label `<div>`: inline → `className="font-body text-xs font-semibold text-ink-muted-48
  uppercase tracking-[0.5px] pl-md mb-xs"`.
- `ListRow` icon box: inline → `className="size-8 rounded-sm bg-canvas-parchment flex items-center
  justify-center shrink-0 text-ink-muted-80"`. Row label `fontSize 16→17`, `lineHeight 1.3→1.47`,
  `letterSpacing:-0.374` added; value `fontSize 13→14`, `letterSpacing:-0.224` added.
- Avatar `<div>`: inline → `className="size-14 rounded-full bg-primary text-white flex items-center
  justify-center font-display text-[22px] font-semibold shrink-0"`.
- Name `<div>`: inline → `className="font-body text-[17px] font-semibold text-ink
  tracking-[-0.374px] truncate"`.
- Sign-out button: inline → `className="w-full py-[14px] px-md bg-transparent border-none
  text-danger font-body text-base font-normal cursor-pointer text-left"`.
- Module-scope button styles (`actionBtnStyle`, `unlinkBtnStyle`, `exportBtnStyle`)
  `fontWeight 500→400`; export blurb `lineHeight 1.5→1.43` + `letterSpacing:-0.224`; coming-soon
  blurb `fontSize 13→14`, `lineHeight 1.6→1.43`; `type="button"` added across buttons.
- **New section:** "Dữ liệu chính" → `<Link href="/account/categories">` ListRow.

**`(app)/categories/page.tsx`** — **route relocation, not styling.** Reduced to a 5-line
`redirect("/account/categories")`. The full categories UI moved to **`(app)/account/categories/
page.tsx`** (new file, content relocated as-is — no style→class conversion happened during the move).

---

## 5. New debt components (no "before" — styling conventions for reference)

These are net-new and so contain no conversions, but follow the same mixed convention (utility
classes for static structure, inline `style` for dynamic/token values):

- **`atoms/DebtProgressBar`** — inline styles (dynamic width/color bar); color uses
  `var(--success)` / `var(--primary)` / `#ff9f0a` (amber, borrow variant).
- **`molecules/DebtPartyCard`** — root `<button>` uses utility classes
  (`w-full bg-canvas rounded-[14px] px-4 py-[14px] mb-2.5 …` + conditional `opacity-[0.55]`);
  inner content inline. Overdue badge uses `text-danger`.
- **`molecules/DebtRepaymentItem`** — fully inline styled.
- **`organisms/LinkTransactionSheet`** — backdrop `<button>` inline; sheet container utility classes
  (`fixed bottom-0 … rounded-t-2xl px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] …`); rows
  mix utilities + inline.
- **`templates/DebtOverviewTemplate`** — mostly inline; settled-toggle button uses utility classes;
  borrow total uses amber `#ff9f0a`.
- **Pages `debts/page.tsx`** (no className — thin data page) and **`debts/[id]/page.tsx`**
  (13 className usages, mixed convention).

---

## 6. Post-migration regression: unlayered reset ate all class-based padding

After the migration, **padding/margin collapsed on nearly every element that was converted from
inline `style` to Tailwind utility classes** (e.g. the Navbar's `px-[22px]` rendered as
`padding: 0`). The classes themselves were fine — a full Tailwind compile confirmed all 204
distinct class tokens in the changed files generate valid CSS, the base `--spacing: 0.25rem` is
emitted, and named-token utilities (`px-md`, `pl-md`, `mt-xxs`, `mb-xs`) resolve correctly.

**Root cause — CSS cascade layers.** `globals.css` had this reset at top level (unlayered):

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
```

Tailwind v4 places every utility inside `@layer utilities`. Per the cascade-layer spec,
**unlayered declarations beat any layered declaration regardless of selector specificity.** So the
unlayered `* { padding: 0 }` overrode every `p-*` / `m-*` utility (which live in `@layer
utilities`). Inline `style` was never affected because inline styles outrank even unlayered rules —
which is exactly why the *pre*-migration inline-styled code looked correct and the regression only
surfaced once elements moved to classes.

Verified against the compiled stylesheet:

| Rule | Layer | Wins? |
|------|-------|-------|
| `.px-\[22px\] { padding-inline: 22px }` | `@layer utilities` | loses |
| `* { margin:0; padding:0 }` | unlayered (top level) | **wins → padding 0** |

**Fix.** Wrap the reset in `@layer base` so it sits *below* `@layer utilities` in layer order
(`theme, base, components, utilities`), letting utilities override it while elements without a
padding utility still get the reset:

```css
@layer base {
  * { box-sizing: border-box; margin: 0; padding: 0; }
}
```

**Regression guard.** `src/app/globals.css.test.ts` gained a test that strips all balanced
`@layer { … }` blocks and asserts no unlayered universal `* { … padding|margin … }` reset
remains — so this specific footgun can't return silently.

---

## Summary

| Area | Files with style→class | Files with token-only / no conversion |
|------|------------------------|----------------------------------------|
| Atoms | EmojiIcon | Badge, Button, CurrencyDisplay |
| Molecules | PaceChip, RecategorizationRow, TransactionListItem | BudgetProgressBar, MonthStepper, OrganizeSectionHeader, StatCard |
| Organisms | EmojiPicker, Navbar, OrganizeReviewSheet, VegaChart | DashboardSummary, TransactionGroup, **TransactionForm (logic-only)** |
| Templates | BudgetTemplate, CategoriesTemplate, DashboardTemplate, StatisticsTemplate | — |
| Pages | layout, sign-in, account, dashboard (page) | categories (→ redirect) |

**Global enablers:** `globals.css` `@theme inline` token bridge + sheet keyframes; `DESIGN.md`
Styling Implementation section; `globals.css.test.ts` undefined-token integrity guard.

**Cross-cutting hygiene:** hex→token color sweep (`#ff453a`/`#30d158` → `var(--danger)`/
`var(--success)` with rgba hue corrections), opaque-white → `var(--body-muted)`, font-weight
`500`→`400`/`600`, and type-scale nudges (`11→12`, `13→14`, `15/16→17`). The one component that
looks like it should have migrated but didn't is **`TransactionForm`** — its large diff is the
debt/repayment logic refactor, and it still uses inline `style` throughout.
