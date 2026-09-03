# Calm Ledger Authenticated App Redesign

---

| Field | Value |
|---|---|
| Type | Product UI and Component Design Specification |
| Version | 1.0 |
| Status | Active |
| Scope | Authenticated application at 375px first |
| Visual authority | `DESIGN.md` |
| Behavior authority | `docs/intent/*`, then active feature specifications |
| Component method | Component Driven Development, `componentdriven.org` |
| Deliverable | Product UI and component implementation contract |

---

## 1. Purpose

This document redesigns the authenticated product around the questions users need
answered, then decomposes those outcomes into isolated components. It covers the app
shell, Dashboard, Statistics, Finance, Account, Budget and Category management, plus
the transaction and contextual sheet flows connecting them.

The current routes, templates and components are evidence of shipped behavior. They
are not the target hierarchy. Existing components remain reusable only when their
purpose, anatomy, states and visual language satisfy this specification and
`DESIGN.md`.

This specification does not introduce a new aesthetic. Calm Ledger remains the only
visual language. Behavior and data changes still require support from the active intent
documents; this specification authorizes the component and page composition described
below.

## 2. Source precedence

Behavior conflicts are resolved in this order:

1. Confirmed behavior intents dated 2026-08-25:
   `docs/intent/transactions-behavior.md`, `budget-behavior.md` and
   `credit-card-behavior.md`.
2. Active feature specifications such as `docs/specs/ai-organize.md`.
3. `BRD.md` requirements that do not conflict with a newer intent or active spec.
4. Older implemented or draft specifications only when they do not conflict with a
   newer source.

UI decisions use the separate precedence required by `DESIGN.md` and `AGENTS.md`:

1. An approved Calm Ledger Figma pattern for the same interaction.
2. A canonical pattern in `DESIGN.md`.
3. A compliant existing production component.
4. A new documented pattern only when none of the above can serve the task.

`AGENTS.md` and `docs/COMPONENT_ARCHITECTURE.md` govern component boundaries and
implementation responsibilities after behavior and UI intent are established.

Consequences of this precedence:

- Working-day budget periods replace calendar-month assumptions in older flows.
- Debt and savings movements use protected non-budget categories and do not affect
  monthly or custom budgets.
- Finance account screens present balances and history. `TransactionForm` remains the
  single transaction-entry experience.
- Credit-card purchases count once on their transaction date. Unpaid card spend is a
  subset of total spending, not another expense.
- Permanent black navigation, black product mastheads, equal KPI grids, generic `+`
  actions and card-per-row ledgers are legacy composition, not redesign input.
- Standalone AI category and recategorization screens remain superseded by AI
  Organize.

## 3. Component Driven contract

This design follows the sequence described by `componentdriven.org`:

1. Build one component at a time in isolation and define its fixed series of states.
2. Combine small components into coherent features.
3. Assemble full pages from those composite components using mock data, including
   hard-to-reach and edge states.
4. Integrate pages with business logic and backend services only after the page and
   component states are proven.

### 3.1 Design top-down, implement bottom-up

Product design proceeds in this order:

1. User question.
2. Decision or task.
3. Information hierarchy.
4. Truthful states.
5. Interaction model.
6. Component composition.

Implementation later proceeds in the reverse construction direction:

```text
atoms -> molecules -> organisms -> templates -> pages
```

### 3.2 Layer responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| Atom | One primitive visual or control contract | Domain fetches, router, business rules, another component dependency |
| Molecule | A small, reusable composition with pure props | Side effects, API calls, routing, application state |
| Organism | One coherent section or interaction; local presentation state | Direct fetches, direct mutations, auth/session ownership |
| Template | Reading order, responsive regions and organism slots | API-shaped rendering, form state, fetches, router, chart construction |
| Page/controller | Session, data loading, mutations, navigation adapters, state mapping | Product hierarchy duplicated in `page.tsx` |

Templates accept view models and slots, not raw API responses. Pages translate domain
data into those view models. Organisms emit user intent such as `onSave`, `onRetry` or
`onRequestDelete`; pages/controllers decide how that intent reaches an API.

### 3.3 Isolation requirements

Every target component must be demonstrable without auth, router or network. Stories
use fixed mocked inputs. A story must not become truthful only after an API request.

Each component contract documents:

- purpose;
- level;
- anatomy;
- input and event API;
- variants;
- meaningful states;
- responsive behavior;
- accessibility behavior;
- composition dependencies.

## 4. Product map

### 4.1 Global navigation

The authenticated application has four primary destinations:

| Label | Destination | Question |
|---|---|---|
| Tổng quan | `/` | Tháng này tiền của tôi đang đi theo hướng nào? |
| Thống kê | `/statistics` | Điều gì đáng chú ý, vì sao, và tôi nên làm gì? |
| Tài chính | `/cards` initially; route name may migrate separately | Tôi đang nợ, để dành, và chưa thanh toán bao nhiêu? |
| Tài khoản | `/account` | Tôi quản lý dữ liệu và cấu hình của mình ở đâu? |

Budget and Category management are Account-level destinations, not global tabs.
Finance uses `Nợ`, `Tiền gửi` and `Chi thẻ` as a local content selector, not another
navigation bar.

### 4.2 Detail and contextual surfaces

| Surface | Navigation level | Entry |
|---|---|---|
| Transaction form | Modal sheet | “Ghi giao dịch” from Dashboard |
| Transaction actions | Action sheet | Transaction row |
| AI Organize review | Review sheet | Dashboard action shown only for the current month |
| Finance account detail | Detail screen | Debt or savings account row |
| Card group detail | Detail screen | Credit-card group row |
| Statement detail/payment | Detail screen or sheet | Statement row |
| Budget management | Management screen | Account |
| Category management | Management screen | Account |
| Destructive confirmation | Confirmation sheet | Explicit destructive request |

## 5. App shell

### 5.1 User question and task

The shell answers: “Tôi đang ở đâu, và tôi chuyển sang công việc chính khác như thế
nào?” The task is navigation, not account promotion or branding.

### 5.2 Information hierarchy

1. Current screen content.
2. Quiet contextual header when a title, back action or local action is necessary.
3. Four-destination bottom navigation.
4. Session or network interruption only when it affects the current task.

### 5.3 Composition

```text
AuthenticatedAppPage
└── AppShellTemplate
    ├── ContextualHeader?                 organism
    │   ├── BackButton?                   atom
    │   ├── ScreenTitle                   atom
    │   └── Button?                       atom
    ├── pageContent                       slot
    ├── ConnectionNotice?                 molecule
    └── BottomNavigation                  organism
        └── NavigationDestination x4      molecule
```

### 5.4 Interaction and responsive behavior

- Phone uses bottom navigation with labels always visible and safe-area-aware bottom
  padding.
- The active destination uses Action Blue plus a non-color cue such as icon treatment
  and stronger label weight.
- Every destination is at least `44 x 44px`.
- Detail and management screens show an explicit back action in a quiet canvas header.
- Desktop centers the destination content; it does not transform the shell into a
  dashboard sidebar unless the navigation model is approved as a system change.
- The old fixed black `Navbar` is not part of the target shell.
- Account identity and sign-out move to Account, where they answer the screen question.

### 5.5 States

| State | Presentation |
|---|---|
| Initial session check | Preserve shell geometry; do not flash unauthenticated content |
| Expired session | Explain that sign-in expired, preserve unsaved input where feasible, offer “Đăng nhập lại” |
| Network unavailable | Keep already loaded content visible when present; show a concise notice and do not promise offline operation |
| Route loading | Keep active destination and page frame stable |
| Narrow viewport | Four equal navigation destinations; no hidden labels |

## 6. Dashboard redesign

### 6.1 User question and task

**Question:** “Trong kỳ ngân sách này tôi đã chi bao nhiêu, tôi còn ổn không, và giao
dịch nào vừa làm con số thay đổi?”

**Decision/task:** understand spending direction, inspect or filter the ledger, and
record or correct a transaction.

### 6.2 Information hierarchy at 375px

1. Selected period and total consumption spending.
2. Remaining budget and plain-language pace.
3. Unpaid credit-card subset when non-zero.
4. Contextual primary action: “Ghi giao dịch”.
5. Filters and transaction ledger in reverse chronology.
6. AI Organize as a secondary ledger-maintenance action shown only for the current
   month. Its analysis scope remains exactly the active API specification.
7. Income and savings context only when it adds information.

The first viewport must answer the question without a dark hero, equal KPI cards or a
chart. Total spending is not presented as a balance. Unpaid card spending is phrased
as “Trong đó … dùng thẻ chưa thanh toán” so it cannot be read as additive.

### 6.3 Composition

```text
DashboardPage
└── DashboardTemplate
    ├── dashboardHeader                    slot
    │   └── PeriodHeader                   organism
    │       ├── MonthStepper               molecule
    │       └── period range copy
    ├── monthlyOutcome                     slot
    │   └── MonthlyOutcome                 organism
    │       ├── CurrencyDisplay            atom
    │       ├── BudgetStatus               organism
    │       │   ├── BudgetProgressBar      molecule
    │       │   └── PaceAnnotation         molecule
    │       └── UnpaidCardSubset?          molecule
    ├── Button “Ghi giao dịch”             atom
    ├── transactionToolbar                slot
    │   └── TransactionLedgerToolbar       organism
    │       ├── Button “Lọc”               atom
    │       ├── ActiveFilterSummary?       molecule
    │       └── Button “Tổ chức ✦”?        atom
    ├── transactionLedger                 slot
    │   └── TransactionLedger              organism
    │       └── TransactionGroup xN        organism
    │           ├── DateGroupHeader        molecule
    │           └── TransactionListItem xN molecule
    ├── TransactionActionSheet?            organism
    ├── TransactionFormSheet?              organism
    └── OrganizeReviewSheet?               organism
```

### 6.4 Monthly outcome anatomy

| Part | Rule |
|---|---|
| Eyebrow | “Chi kỳ này” or period-specific equivalent |
| Primary amount | Total consumption spending; Display role once on screen |
| Period | Working-day start inclusive to end exclusive, shown in familiar dates |
| Remaining | “Còn …” or “Vượt …”; amount before percentage |
| Pace | “Còn trong nhịp”, “Nhanh hơn kế hoạch”, or “Chưa có ngân sách” |
| Unpaid subset | Visible only when non-zero; explicitly starts with “Trong đó” |
| Progress | One semantic fill on neutral track; no gradient or pace layer without text |

### 6.5 Ledger interaction

- The default list is reverse chronological and grouped by transaction date.
- A date header shows a familiar date label and daily net total.
- Transaction identity leads: specific note when available, otherwise category.
- Context includes category path, custom budgets, payment method, debt party or
  savings account only when relevant.
- Amount aligns right and includes sign. Direction never relies on color alone.
- Tapping a row opens `TransactionActionSheet`; edit and delete are not hidden behind
  swipe-only gestures.
- Filters cover month, category, custom budget and note search. A selected filter is
  summarized in plain language and can be cleared.
- “Ghi giao dịch” is the only dominant action in the Dashboard action region and sits
  between the outcome and ledger controls. It remains reachable before a long ledger.
- AI Organize is a labeled secondary action, not an icon-only sparkle control.

### 6.6 Dashboard states

| State | Required design |
|---|---|
| Initial loading | Outcome and ledger skeletons preserve final geometry |
| Background refresh | Keep values and ledger visible; quiet refresh cue |
| No budget period | Explain that consumption expenses require a period; CTA “Tạo ngân sách kỳ này” |
| Empty period | Outcome remains visible; “Chưa có giao dịch trong kỳ này”; CTA “Ghi giao dịch” |
| Filtered empty | Name the active filter and offer “Xóa bộ lọc” |
| Summary failed, ledger loaded | Preserve ledger; inline retry in outcome region |
| Ledger failed, summary loaded | Preserve outcome; inline retry in ledger region |
| AI preview failed | Return the organize action to idle, show plain-language failure and offer “Thử lại” without opening an empty sheet |
| Over budget | “Vượt …” plus warning icon/text; not red alone |
| Zero spending | Show `0 ₫`; do not imply missing data |
| Large amount | Scale Display to Title role; never ellipsize amount |
| Long transaction content | Wrap identity/context before truncating; amount remains intact |
| Delete requested | Named confirmation with transaction identity, amount and consequence |
| Delete pending | Disable duplicate submission; retain accessible action label |
| Network unavailable | Preserve already loaded ledger when present; disable network actions and explain retry without claiming offline support |

## 7. Transaction entry redesign

### 7.1 User question and task

**Question:** “Dòng tiền nào vừa xảy ra và nó thuộc ngữ cảnh nào?”

**Task:** save one truthful income or expense transaction in under ten seconds without
accidentally changing budget, debt, savings or card meaning.

### 7.2 Progressive form hierarchy

1. Amount.
2. Expense or income direction.
3. Transaction context: consumption, debt or savings.
4. Required context fields determined by that choice.
5. Date and optional note.
6. Reviewable validation and “Lưu giao dịch”.

The form reveals only fields that can affect the chosen transaction. It must not show
debt, savings, card and custom-budget controls simultaneously.

### 7.3 Composition

```text
TransactionFormSheet                    organism
├── SheetHeader                         molecule
│   ├── title                           atom
│   └── CloseButton                     atom
├── AmountField                         molecule
│   ├── FormLabel                       atom
│   ├── CurrencyInput                   atom
│   └── FieldError?                     atom
├── TransactionTypeSelector             molecule
├── TransactionContextSelector          molecule
├── ConsumptionFields?                  organism
│   └── FormField xN                    molecule
├── FinanceMovementFields?              organism
│   ├── FormField xN                    molecule
│   └── inline account form
├── FormField “Ngày”                    molecule
├── FormField “Ghi chú”                 molecule
├── FieldError?                         atom
└── Button “Lưu giao dịch”              atom
```

### 7.4 Behavior contract

- Create defaults to expense, today and focused amount.
- Remembered category, custom budgets and payment method are convenience defaults,
  never hidden persisted facts.
- Consumption requires a leaf category.
- Consumption expense requires an existing working-day budget period.
- Payment is either cash or one card group; no split payment.
- A consumption expense may count in full toward multiple active custom budgets.
- Debt and savings movements select or create exactly one account, receive a protected
  system category and cannot select custom budgets.
- Finance screens do not launch this organism. The Dashboard action is the only entry;
  debt and savings context is selected inside the same form.
- Edit uses the same organism with explicit title “Sửa giao dịch”.
- Date cannot be in the future; amount is a positive VND integer.

### 7.5 Form states

Default, editing, missing categories, missing monthly budget, no card groups, no
finance accounts, inline account creation, field validation, server validation,
saving, saved, duplicate-submit prevention, network unavailable, expired session, long names,
large amount and open keyboard must all be isolated Storybook states.

On phone the sheet uses the canonical sheet radius, traps focus, restores focus to its
trigger, keeps title/action stable while fields scroll, and resizes or lifts for the
keyboard. Inputs retain visible labels and at least the Body font size.

## 8. Statistics redesign

### 8.1 User question and task

**Question:** “Điều gì đáng chú ý, vì sao, và tôi nên làm gì?”

**Decision/task:** understand one notable observation for a selected period, inspect
its evidence and choose whether to adjust behavior or regenerate the report.

### 8.2 Information hierarchy

1. One specific observation in plain language.
2. The amount or comparison that proves it.
3. A concise explanation of why it matters.
4. One chart only when comparison is meaningful.
5. A separately labeled recommendation.
6. Additional observations in a continuous narrative below.
7. Report freshness and regeneration as contextual metadata/actions.

The screen is not a grid of `StatCard`s. AI insights read as annotated ledger analysis,
not promotional dark cards. One-value insights use a sentence and amount, not a chart.

### 8.3 Composition

```text
StatisticsPage
└── StatisticsTemplate
    ├── PeriodHeader                     organism
    ├── ReportFreshness?                 molecule
    ├── InsightNarrative                 organism
    │   ├── headline and primary numeric value with unit
    │   ├── observation copy
    │   ├── chart region?
    │   │   ├── VegaChart                organism
    │   │   ├── ChartSummary             molecule
    │   │   └── AccessibleDataTable      molecule
    │   └── recommendation copy?
    ├── InsightNarrative xN              organism
    └── Button “Phân tích lại”          atom
```

### 8.4 Chart contract

- `VegaChart` is the single chart renderer; templates do not duplicate Vega setup.
- Action Blue identifies the focal datum or series. Neutral ink/divider tones provide
  context. Semantic colors appear only when the data meaning is income, expense,
  warning or settled.
- The narrative determines the highlighted datum; the largest value is not selected
  automatically.
- Axis labels and values remain legible at 375px.
- Every chart has a textual summary and accessible data representation.
- The semantic layer owns arithmetic. AI text interprets supplied metrics and does not
  create totals.

### 8.5 Statistics states

| State | Required design |
|---|---|
| Initial loading | Preserve period header and narrative geometry |
| No report | Explain what analysis provides; CTA “Phân tích tháng này” |
| No meaningful data | State the absence without producing filler charts |
| Generating | User-language progress such as “Đang tìm thay đổi đáng chú ý”; no tool names, row counts or model internals |
| Progressive result | Append complete insights without reanimating existing content |
| Dirty report | Keep report visible with “Dữ liệu đã thay đổi” and refresh action |
| Background regeneration | Keep current report visible; mark as refreshing |
| Recoverable failure | Plain-language message and “Thử lại”; no stack, status code or serialized cause |
| Chart failure | Keep narrative and data summary; localized chart retry or omission |
| One value | Sentence and amount only |
| Long label | Wrap or adapt chart layout; preserve accessible full text |
| Network unavailable | Keep the last useful report visible when present; disable generation and explain retry |
| Expired session | Preserve visible report geometry and offer “Đăng nhập lại” |

## 9. Finance redesign

### 9.1 User question and task

**Question:** “Tôi đang nợ, để dành, và chưa thanh toán bao nhiêu?”

**Decision/task:** choose one finance mode, understand the most important total, open
an account or statement, and perform the next contextual action safely.

### 9.2 Information architecture

Finance has three local modes in this order:

1. `Nợ`.
2. `Tiền gửi`.
3. `Chi thẻ`.

The selected mode determines the leading total, explanation, list and action. The
screen does not render debt accounts, savings accounts and card groups as consecutive
backend sections. It does not show three equal KPI cards.

### 9.3 Shared composition

```text
FinancePage
└── FinanceTemplate
    ├── FinanceModeSelector              molecule
    ├── financeSummary                   slot
    │   └── FinanceOutcome               organism
    ├── financeCollection                slot
    │   └── mode-specific organism
```

`FinanceModeSelector` is a content selector with one selected value, keyboard arrow
support and a clear non-color selected cue. It is not sticky bottom navigation and it
does not replace the screen title.

### 9.4 Debt mode

**Leading total:** one total with a precise label based on current data, such as “Còn
được nhận” or “Còn phải trả”. If lending and borrowing both exist, the narrative
states both values in reading order rather than subtracting them into an ambiguous net
balance.

```text
DebtMode
└── DebtAccountList                      organism
│   └── DebtAccountRow xN                molecule
│       ├── identity and direction
│       ├── remaining/opening amount
│       ├── status text
│       └── latest movement preview?
```

- Debt mode is read-only for transaction entry. It does not launch a prefilled form or
  create an account. Debt movements and inline account creation remain available only
  through the shared “Ghi giao dịch” flow on Dashboard.
- Open items lead. Settled items appear in a lower, collapsible ledger section.
- Overdue combines warning text/icon with date.
- Reverse balance is never normalized with `Math.abs()`.
- Lending overpayment reads “Đã trả dư …”; borrowing over-receipt uses precise
  direction-specific language approved with domain behavior.
- A list row may preview only the latest movement. Full history belongs to detail.

### 9.5 Savings mode

**Leading total:** “Đang để dành” across savings accounts, followed by account rows.

```text
SavingsMode
└── SavingsAccountList                   organism
│   └── SavingsAccountRow xN             molecule
```

- Each row identifies the term deposit/account, current computed balance and latest
  movement.
- Withdrawal beyond deposits is shown as “Đã rút vượt …”, not hidden as a positive
  balance.
- Savings mode is read-only for transaction entry. Deposits, withdrawals and inline
  account creation remain in the shared Dashboard transaction flow.

### 9.6 Card mode

**Leading total:** “Chưa thanh toán”, including unpaid closed statements and the
current open period.

```text
CardMode
└── CreditCardGroupList                  organism
│   └── CreditCardGroupRow xN            molecule
│       ├── group identity and close day
│       ├── aggregate unpaid amount
│       └── statement status summary
```

The Finance-level `FinanceOutcome` supplies “Chưa thanh toán” and the clarification
“Đã được tính trong chi tiêu” while Card mode is selected. “Thêm nhóm thẻ” is a
management action inside card-group collection state, not a global Finance action.

Group detail composition:

```text
CreditCardGroupDetailPage
└── CreditCardGroupDetailTemplate
    ├── ContextualHeader                 organism
    ├── FinanceOutcome                   organism
    ├── StatementList                    organism
    │   └── StatementRow xN              molecule
    ├── StatementDetail?                 organism
    │   └── TransactionLedger            organism
    ├── CreditCardGroupManagement        organism
    └── StatementPaymentSheet?           organism
```

- Statements show period, status, amount and included purchase count.
- Statement payment is all-or-nothing and requires a payment date.
- Confirmation explains that payment updates status only; it does not create another
  expense or change a past budget.
- Create, edit and delete group actions are contextual and use named confirmation.
- Delete behavior and consequences must follow the active domain/API contract; this
  design does not invent transaction reassignment behavior.
- Editing a group's close day explains that the new day affects newly created
  statements only; existing statements keep their original periods.

### 9.7 Finance account detail

**Question:** “Số dư này hình thành từ những giao dịch nào?”

**Task:** verify the computed debt or savings balance and open a source transaction for
correction. This surface remains read-only for transaction entry.

```text
FinanceAccountDetailPage
└── FinanceAccountDetailTemplate
    ├── ContextualHeader
    ├── FinanceAccountOutcome            organism
    ├── FinanceMovementLedger            organism
    │   └── FinanceMovementRow xN         molecule
    └── AccountManagementActions         organism
```

The outcome names account, direction and truthful balance. The ledger is reverse
chronological and includes every linked movement with signed amount, type, date and
note. Selecting a movement opens the shared transaction action flow for edit/delete;
the detail screen itself never creates a movement. Account management actions are
limited to behavior confirmed by the domain contract and use named consequence copy.

At 375px the outcome precedes one continuous movement ledger. States cover loading,
created-but-unused, partial movement failure, zero, overdue debt, settled debt, reverse
balance, long account/party name, large amount, movement correction pending, network unavailable
and expired session.

### 9.8 Card group and statement detail

**Question:** “Những khoản mua nào tạo nên số chưa thanh toán của nhóm thẻ này?”

**Task:** inspect statements and included purchases, then mark one entire unpaid
statement paid with a payment date.

The group outcome shows aggregate unpaid amount and close day. `StatementList` orders
the current open period first, then closed statements in reverse chronology. Opening a
statement reveals its exact period, status, amount and a continuous purchase ledger.
Each purchase retains transaction date, category/note and signed amount.

`StatementPaymentSheet` names the statement period and amount, requires a valid payment
date and explains that this records payment metadata only. It does not create an
expense or change a past budget. The current open period is presented as an unpaid
period kind, not a third statement status. States cover current period, unpaid closed,
paid, no purchases,
loading, purchase-list failure, payment pending, duplicate-submit prevention, payment
failure, payment success, network unavailable and expired session.

At 375px statement identity and amount precede purchase history. On wider screens the
statement list and selected detail may form two independent columns without changing
reading order.

### 9.9 Finance states

Each mode covers initial loading, background refresh, empty, created-but-unused,
partial source failure, zero balance, reverse balance, large amount, long account
name, overdue, settled/paid, mutation pending, recoverable mutation error, network unavailable and
destructive confirmation.

Finance-level partial failures stay local. For example, card data failure does not
erase a successfully loaded debt mode. The app must not coerce unresolved requests to
empty arrays.

## 10. Account redesign

### 10.1 User question and task

**Question:** “Tôi quản lý dữ liệu và cấu hình của mình ở đâu?”

**Task:** reach category and budget configuration, understand account identity, export
data when supported, and sign out safely.

### 10.2 Information hierarchy

1. Data structure: Categories and Budget.
2. Account identity and linked authentication methods.
3. Data controls such as export when behavior is supported.
4. Sign out as a low-frequency action.

### 10.3 Composition

```text
AccountPage
└── AccountTemplate
    ├── SettingsSection “Quản lý”        organism
    │   ├── SettingsRow “Danh mục”       molecule
    │   └── SettingsRow “Ngân sách”      molecule
    ├── SettingsSection “Tài khoản”      organism
    │   └── SettingsRow xN               molecule
    ├── SettingsSection “Dữ liệu”?       organism
    │   └── SettingsRow xN               molecule
    └── Button “Đăng xuất”               atom
```

Settings rows share a surface with internal dividers. They do not become individual
large cards. The page itself contains no rendering-only local component definitions;
all reusable rows and sections are isolated and storied.

### 10.4 States

Session loading preserves Account geometry. Missing provider data, linking pending,
linking error, export pending/success/failure, network unavailable and expired session receive
explicit states. Unsupported export is omitted rather than represented by a control
that cannot complete.

## 11. Budget management redesign

### 11.1 User question and task

**Question:** “Tôi còn có thể chi bao nhiêu mà vẫn đúng kế hoạch, và tôi thay đổi kế
hoạch ở đâu?”

**Decision/task:** understand current remaining budget first, then create or adjust the
monthly period and manage independent custom budgets.

### 11.2 Information hierarchy

1. Current period remaining amount and pace.
2. Current limit, consumed amount and period dates as supporting facts.
3. Contextual “Điều chỉnh ngân sách” action.
4. Adjustment history on demand.
5. Custom budgets with amount-first progress.
6. Default configuration for the next month as lower-priority settings.

The configured amount must not outrank “Còn có thể chi”. Monthly and custom budgets
are separate bounded concepts, not equal cards derived from API entities.

### 11.3 Composition

```text
BudgetPage
└── BudgetTemplate
    ├── CurrentBudgetOutcome             organism
    │   ├── CurrencyDisplay
    │   ├── BudgetStatus
    │   └── Button “Điều chỉnh”
    ├── AdjustmentHistory                organism
    │   └── AdjustmentRow xN             molecule
    ├── CustomBudgetSection              organism
    │   ├── section heading
    │   ├── CustomBudgetRow xN           molecule
    │   └── Button “Tạo ngân sách riêng”
    ├── CustomBudgetDetail?              organism
    │   └── TransactionLedger            organism
    ├── FutureBudgetConfig               organism
    ├── MonthlyBudgetFormSheet?          organism
    ├── BudgetAdjustmentSheet?           organism
    ├── CustomBudgetFormSheet?           organism
    └── ConfirmationSheet?               organism
```

### 11.4 Behavior and state requirements

- Monthly period follows the working-day boundary.
- The optional monthly objective appears as supporting copy and remains editable with
  the period; an empty objective does not reserve blank space.
- Missing period explains that consumption expenses cannot be recorded yet and offers
  “Tạo ngân sách kỳ này”.
- `MonthlyBudgetFormSheet` pre-fills the configured next-month default when applicable,
  accepts the period amount and optional objective, states the working-day range, and
  handles duplicate-period and server validation without losing entered values.
- Adjustment uses a signed delta and required reason; labels are “Tăng” and “Giảm” but
  selected controls still use Action Blue, not green/red interactive accents.
- Adjustment history shows timestamp, signed amount and reason.
- Custom budget progress presents spent and remaining/over amount before percentage.
- Opening a custom budget shows every linked transaction in a continuous ledger so the
  user can verify how its spent amount was formed.
- Exceeding a custom target warns but never blocks a transaction.
- Inactive custom budgets remain manageable but do not appear in transaction entry.
- Custom budgets expose an explicit activate/deactivate event. Target changes retain a
  visible adjustment history rather than overwriting prior targets silently.
- Delete is unavailable while linked transactions exist; explain the affected count
  and recovery.
- Rename and target change are real persisted actions; the UI must not present an edit
  flow without an event/API contract.
- Default configuration explicitly says it applies to the next month only and does not
  change an existing period.

Stories cover loading, background refresh, no monthly period, zero spent, exactly
exhausted, exceeded, adjustment form, required reason error, adjustment pending,
duplicate submission, adjustment success, adjustment server failure, custom empty,
custom detail with linked transactions, inactive, linked-delete blocked, destructive
confirmation, long name, large amount, network unavailable and expired session.

## 12. Category management redesign

### 12.1 User question and task

**Question:** “Danh mục của tôi được tổ chức thế nào, và tôi thay đổi chúng an toàn ra
sao?”

**Task:** scan the hierarchy, add or rename a category, understand protected system
categories, and delete only eligible categories.

### 12.2 Information hierarchy

1. Expense and income category trees.
2. Contextual “Thêm danh mục” action.
3. Row-level edit/delete affordances.
4. Protected category explanation where relevant.

### 12.3 Composition

```text
CategoriesPage
└── CategoriesTemplate
    ├── CategoryTypeSelector?            molecule
    ├── CategoryTree                     organism
    │   └── CategoryBranch xN            organism
    │       └── CategoryRow xN           molecule
    ├── Button “Thêm danh mục”           atom
    ├── CategoryFormSheet?               organism
    └── ConfirmationSheet?               organism
```

### 12.4 Behavior and states

- The tree supports up to three levels and exposes hierarchy without relying on
  indentation alone.
- Only leaf categories can be assigned to transactions; management copy explains this
  when an attempted action conflicts.
- Protected debt/savings system categories show a lock/status label and no edit/delete
  controls.
- Delete rejection names child categories or affected transaction count and provides
  a recovery path.
- An empty account offers “Tạo danh mục mẫu” and “Thêm danh mục”.
- Long names wrap; the full name is never available only through hover.
- Add/edit form retains visible labels, adjacent validation and keyboard-safe actions.
- AI Organize remains a Dashboard-only flow under the active specification. Category
  management reflects applied results but does not provide a separate AI destination.

Stories cover full tree, empty, seed pending/failure, maximum depth, long names,
protected category, edit, delete eligible, delete blocked by children, delete blocked
by transactions, edit/delete pending, duplicate submission, mutation success/failure,
background refresh, network unavailable and expired session.

## 13. Shared overlays

### 13.1 Base sheet pattern

`BaseSheet` is an organism-level behavioral surface, not a decorative card. It provides
the consistent overlay contract used by forms, review and confirmation.

| Part | Contract |
|---|---|
| Scrim | Dimmed overlay; click behavior is explicit per variant |
| Surface | Canvas, canonical sheet radius, floating-surface elevation only |
| Header | Visible title and close action |
| Body | Scrollable when needed |
| Footer | Stable primary action and safe-area padding |
| Focus | Trap while open; initial focus chosen by task; restore to trigger |
| Keyboard | Lift/resize without obscuring current field or primary action |
| Motion | Short fade plus vertical slide; reduced-motion alternative |

### 13.2 Variants

| Variant | Purpose | Dismissal |
|---|---|---|
| Action sheet | Choose a short contextual action | Close button, neutral cancel, optional scrim |
| Form sheet | Complete a focused short form | Explicit close; warn before discarding meaningful edits |
| Review sheet | Review selectable proposed changes | Explicit close; no writes until apply |
| Confirmation sheet | Confirm named destructive or consequential action | Neutral cancel and one final destructive action |

Sheets never nest. A transition from review to confirmation replaces the current
surface or uses an inline final step.

### 13.3 Destructive confirmation

Confirmation copy states:

1. The named object.
2. What data or relationship changes.
3. Whether recovery is possible.
4. A neutral cancel action.
5. One final destructive action using Danger semantics.

`window.confirm` is not a target pattern.

## 14. Target component catalog

### 14.1 Atoms

| Component | Disposition | Purpose and required states |
|---|---|---|
| `Button` | Revise as canonical | Primary, secondary, ghost, destructive; default, pressed, focus, disabled, loading |
| `CurrencyDisplay` | Keep canonical | VND formatting, sign, tabular alignment, compact/title/display roles, large amount |
| `Spinner` | Revise | Supplemental loading indicator with accessible label; never sole geometry |
| `EmojiIcon` | Keep | Category/account anchor with fallback and decorative semantics control |
| `Badge` | Revise | Status/category metadata; remove deprecated translucent product styling |
| `ScreenTitle` | New | Title role only; default and long title |
| `FormLabel` | New | Persistent field label and required indicator |
| `FieldError` | New | Adjacent recoverable validation message |
| `CloseButton` | New | Named icon control with 44px target |
| `BackButton` | New | Explicit contextual back action with 44px target |
| `ProgressTrack` | New | Neutral track and runtime fill geometry; semantic meaning supplied by composition |
| `CurrencyInput` | New | Positive integer VND entry with focus, disabled and invalid states |

`DebtProgressBar` is not an atom in the target taxonomy because it composes financial
formatting and domain status. It is replaced by or folded into a molecule.

### 14.2 Molecules

| Component | Disposition | Purpose |
|---|---|---|
| `MonthStepper` | Revise canonical | Previous/next period with disabled current boundary and accessible labels |
| `NavigationDestination` | New | One labeled global destination with active and route-loading states |
| `BudgetProgressBar` | Revise canonical | Amount-first monthly/custom progress with textual status |
| `PaceAnnotation` | Replaces `PaceChip` use | Plain-language pace with semantic icon/text, not decorative chip by default |
| `TransactionListItem` | Revise canonical | Identity, context, signed amount and row action contract |
| `DateGroupHeader` | New | Relative/familiar date plus daily net total |
| `ActiveFilterSummary` | New | Names current filters and clear action |
| `UnpaidCardSubset` | New | Explicit subset sentence; zero hidden variant |
| `FinanceModeSelector` | New | Nợ/Tiền gửi/Chi thẻ content selection |
| `DebtAccountRow` | Replaces card-first debt row | Debt identity, direction, amount, status and latest movement |
| `SavingsAccountRow` | New | Savings identity, computed balance and latest movement |
| `CreditCardGroupRow` | New | Group identity, close day and unpaid status |
| `StatementRow` | New | Statement period, status, amount and purchase count |
| `SettingsRow` | New | Label, supporting value/status and navigation/action affordance |
| `AdjustmentRow` | New | Timestamp, signed delta and reason |
| `CustomBudgetRow` | New | Name, amount-first progress, state and contextual action |
| `ChartSummary` | New | Textual equivalent of the visual finding |
| `ReportFreshness` | New | Generated/dirty/refreshing report status and contextual refresh intent |
| `AccessibleDataTable` | New | Keyboard/screen-reader chart data representation |
| `ConnectionNotice` | New | Network-unavailable/stale/refresh state without promising offline operation |
| `FormField` | New | Label, control, helper and adjacent error |
| `AmountField` | New | VND input and validation |
| `SheetHeader` | New | Title and close action |
| `TransactionTypeSelector` | New | Expense/income single selection after amount entry |
| `TransactionContextSelector` | New | Consumption/debt/savings single selection |
| `CategoryTypeSelector` | New | Expense/income category-tree filtering without changing hierarchy |
| `CategoryRow` | New | Hierarchy identity, protected/leaf state and contextual actions |
| `FinanceMovementRow` | New | Signed source movement with date and context |
| `NewCategoryRow` | Revise canonical | Reviewable AI category proposal with full long-name access |
| `RecategorizationRow` | Revise canonical | Current to proposed category, reason and selection |
| `OrganizeSectionHeader` | Keep canonical | Review section label, count and auto-included status |
| `TransactionEmojiRow` | Keep canonical | Reviewable emoji assignment |

`StatCard` is not the primary Statistics composition. It may remain only for a truly
bounded standalone statistic; it must not drive an equal-card report grid.

### 14.3 Organisms

| Component | Disposition | Purpose |
|---|---|---|
| `BottomNavigation` | New | Four global destinations and safe-area behavior |
| `ContextualHeader` | New | Screen title, optional back and one contextual action |
| `PeriodHeader` | New | Month stepping and working-day range |
| `MonthlyOutcome` | Replaces legacy dark summary | Total consumption spending and budget interpretation |
| `BudgetStatus` | New | Remaining/over amount, progress and pace composition |
| `TransactionLedgerToolbar` | New | Filter and secondary organize controls |
| `TransactionLedger` | New | Ledger states and date-group composition |
| `TransactionGroup` | Revise canonical | Date header and transaction rows |
| `TransactionFormSheet` | Refactor target | Single transaction entry interaction without API ownership |
| `ConsumptionFields` | New | Category, payment method and custom-budget field group |
| `FinanceMovementFields` | New | Movement kind, account selection and inline account creation |
| `TransactionActionSheet` | New | Edit/delete actions for one transaction |
| `OrganizeReviewSheet` | Revise canonical | Selection, review, applying and recoverable error |
| `InsightNarrative` | New | Observation, evidence, optional chart and recommendation |
| `VegaChart` | Revise as sole renderer | CSP-safe visual chart only; no duplicate template renderer |
| `FinanceOutcome` | New | Mode-specific leading total and explanation |
| `DebtAccountList` | New | Open/settled debt reading order and states |
| `SavingsAccountList` | New | Savings account reading order and states |
| `CreditCardGroupList` | New | Card groups and unpaid-state reading order |
| `StatementList` | New | Statement chronology and payment entry |
| `StatementDetail` | New | Exact statement period, status, amount and included purchase ledger |
| `StatementPaymentSheet` | New | Full-statement payment date and consequence confirmation |
| `CreditCardGroupManagement` | New | Create/edit/delete group forms and confirmed consequences |
| `FinanceAccountOutcome` | New | Account identity, direction and truthful computed balance |
| `FinanceMovementLedger` | New | Complete linked movement history and local states |
| `AccountManagementActions` | New | Confirmed account-level management actions only |
| `SettingsSection` | New | Shared settings surface with dividers |
| `CurrentBudgetOutcome` | New | Remaining-first budget summary |
| `AdjustmentHistory` | New | Adjustment ledger |
| `CustomBudgetSection` | New | Custom budget collection and contextual action |
| `CustomBudgetDetail` | New | Linked transaction history for one custom budget |
| `FutureBudgetConfig` | New | Default amount for the next month with explicit non-retroactive copy |
| `MonthlyBudgetFormSheet` | New | Create one working-day period from a default amount and optional objective |
| `BudgetAdjustmentSheet` | New | Signed monthly adjustment with required reason |
| `CustomBudgetFormSheet` | New | Create/rename/retarget/activate custom budget and show target history |
| `CategoryTree` | New | Accessible three-level hierarchy |
| `CategoryBranch` | New | Recursive branch up to the confirmed three-level maximum |
| `CategoryFormSheet` | New | Add/rename category with parent/type constraints |
| `BaseSheet` | New canonical behavior | Shared focus, scroll, safe area, keyboard and motion contract |
| `ConfirmationSheet` | New | Named consequential/destructive confirmation |

The current permanent black `Navbar` is deprecated in the target. `DashboardSummary`
is superseded by `MonthlyOutcome`. `DebtPartyCard` may inform debt-row data but its
card-first presentation is not canonical. `LinkTransactionSheet` remains legacy until
the product explicitly reaffirms transaction linking under the current intent.

### 14.4 Templates

| Template | Status | Slot contract |
|---|---|---|
| `AppShellTemplate` | New | contextual header, content, notice, bottom navigation |
| `DashboardTemplate` | Redesign | period header, outcome, transaction action, toolbar, ledger, overlays |
| `StatisticsTemplate` | Redesign | period header, freshness, narrative sequence, action region |
| `FinanceTemplate` | Replaces entity-ordered `CreditCardsTemplate` | selector, mode summary and mode collection |
| `FinanceAccountDetailTemplate` | New | detail header, outcome, movement history, management actions |
| `CreditCardGroupDetailTemplate` | New | detail header, outcome, statement list, selected statement purchase detail, management actions, overlay |
| `AccountTemplate` | New | management, identity, data and account action sections |
| `BudgetTemplate` | Redesign | outcome, adjustment history, custom budgets, future config, overlays |
| `CategoriesTemplate` | Redesign | tree, add action and overlays |

Templates define reading order and responsive regions only. Forms, selectors, charts,
lists and sheets remain organisms. A template story composes those organisms with
fixed view models and callbacks.

### 14.5 Component API and fixed-state contracts

The catalog above defines purpose and layer. The matrices below complete each target
component's isolated contract. `Input` means fixed story data; `event` means a user
intent callback. No entry below implies network, auth or router access.

#### Atom contracts

| Component | Input/event API | Variants and fixed states | Isolation, responsive and accessibility |
|---|---|---|---|
| `Button` | label, variant, disabled, loading, type; click event | primary, secondary, ghost, destructive; default, pressed, focus, disabled, loading | Width is caller-owned; keeps label semantics while loading; 44px target |
| `CurrencyDisplay` | raw amount, sign/direction, role, accessible label | compact, body, title, display; zero, negative meaning, large | No formatting fetch; tabular numerals; no ellipsis; scales display at narrow width |
| `Spinner` | size, accessible label, decorative flag | small, regular, reduced motion | Never represents loading geometry alone; status text remains available |
| `EmojiIcon` | emoji, fallback, size, decorative flag | present, missing, unsupported glyph | Stable box; hidden from assistive tech when redundant |
| `Badge` | label, semantic role | neutral, selected, success, danger, warning; long label | Metadata only; semantic meaning includes text; not the sole control target |
| `ScreenTitle` | text, heading level | default, long | Title role and wrap; one screen heading relationship |
| `FormLabel` | text, target id, required | default, required, disabled | Programmatically labels its control; never replaced by placeholder |
| `FieldError` | field id, message | hidden, visible, long | Linked by `aria-describedby`; adjacent to failing control |
| `CloseButton` | accessible label; close event | default, focus, disabled | 44px target; visible close affordance |
| `BackButton` | accessible label; back event | default, focus, disabled | 44px target; no router dependency |
| `ProgressTrack` | normalized value, semantic role, text id | empty, partial, full, exceeded | Runtime width only; references visible textual status |
| `CurrencyInput` | value, label ids, disabled, invalid; change/blur events | empty, entered, focus, invalid, disabled | Numeric keyboard hint, Body-size text, no future formatting side effect |

#### Molecule contracts

| Component | Input/event API | Variants and fixed states | Composition and accessibility |
|---|---|---|---|
| `MonthStepper` | period label, previous/next availability; step events | current, past, both directions, narrow label | Buttons + label; named controls; disabled remains visible |
| `NavigationDestination` | label, icon, active, loading; activate event | inactive, active, focus, loading, narrow | 44px target, visible label and non-color active cue |
| `BudgetProgressBar` | spent, limit, status text, semantic role | zero, under, full, over, no budget | `ProgressTrack` + amounts; text carries meaning |
| `PaceAnnotation` | pace status, explanation | in pace, faster, no budget | Icon/text; no color-only state |
| `TransactionListItem` | identity, context, financial amount, date, selected; open event | income, expense, card, custom budget, debt, savings, long, large | `EmojiIcon` + `CurrencyDisplay`; 44px row; complete accessible name |
| `DateGroupHeader` | date label, daily total | today, yesterday, older, zero/negative net | Label + `CurrencyDisplay`; semantic group heading |
| `ActiveFilterSummary` | filter labels; clear event | one, many, long | Visible summary and 44px clear action |
| `UnpaidCardSubset` | amount, explanatory copy | non-zero, large; zero renders absent by contract | `CurrencyDisplay`; copy states subset relationship |
| `FinanceModeSelector` | selected mode; select event | each mode, focus, narrow | Single-selection semantics and arrow-key behavior |
| `DebtAccountRow` | identity, direction, amount, status, latest movement; open event | lend, borrow, overdue, settled, reverse, long | Text/sign plus semantics; 44px row |
| `SavingsAccountRow` | identity, amount, latest movement; open event | positive, zero, withdrawn over, long | Truthful balance label; no absolute-value conversion |
| `CreditCardGroupRow` | identity, close day, unpaid amount, statement summary; open event | unpaid, all paid, unused, long | Status text plus amount; 44px row |
| `StatementRow` | period, period kind, unpaid/paid status, amount, purchase count; open event | current-period unpaid, closed unpaid, paid, empty | Period/status included in accessible name; “current” is not a persisted status |
| `SettingsRow` | label, supporting text, status, action kind; activate event | navigation, action, disabled, pending, long | Shared divider geometry; 44px target |
| `AdjustmentRow` | timestamp, signed delta, reason | increase, decrease, long reason | Sign and copy independent of semantic color |
| `CustomBudgetRow` | identity, spent, target, active state, blocked action; open/event menu | under, full, over, inactive, no spend, long | `BudgetProgressBar`; status and action names |
| `ChartSummary` | title and textual finding | short, long, no comparison | Associated with chart by id |
| `ReportFreshness` | generated time, dirty/refreshing flags; refresh event | fresh, dirty, refreshing, stale | Textual status; does not replace report during refresh |
| `AccessibleDataTable` | columns, rows, caption | empty, default, long labels | Native table reading order; scroll container only when necessary |
| `ConnectionNotice` | status, message; retry/dismiss events | network unavailable, stale, refreshing, retrying | Polite live region; never promises offline operation or replaces useful data |
| `FormField` | label, control slot, helper, error | default, focus-within, invalid, disabled | `FormLabel` + control + `FieldError`; ids are explicit |
| `AmountField` | VND value, disabled, error; change/blur events | empty, entered, invalid, large | `FormField` + `CurrencyInput`; strongest form entry |
| `SheetHeader` | title, description id; close event | form, review, confirmation, long title | Title + `CloseButton`; labels parent dialog |
| `TransactionTypeSelector` | selected type; select event | expense, income, disabled | Single selection; Action Blue selection, text labels |
| `TransactionContextSelector` | selected context, available contexts; select event | consumption, debt, savings, disabled | Single selection; context consequences announced |
| `CategoryTypeSelector` | selected type; select event | expense, income, disabled | Single selection; does not mutate categories |
| `CategoryRow` | identity, level, leaf/protected state, expanded state; open/edit/delete events | leaf, parent, max level, protected, long | Exposes level/expanded state; protected label |
| `FinanceMovementRow` | identity, date, signed amount, movement kind; open event | income, expense, reverse contribution, long | Signed amount and movement text; 44px row |
| `NewCategoryRow` | proposal, checked state; change event | checked, unchecked, long name, no examples | Native check semantics; full text available |
| `RecategorizationRow` | transaction identity, current/proposed categories, reason, checked; change event | checked, unchecked, new category, long reason | Native check semantics; complete category transition text |
| `OrganizeSectionHeader` | title, count, auto-included | populated, empty, automatic | Heading relationship and textual automatic status |
| `TransactionEmojiRow` | category, proposed emoji | default, fallback, long category | `EmojiIcon`; decorative meaning is also named |

#### Organism contracts

| Component | Input/event API | Variants and fixed states | Composition and boundary |
|---|---|---|---|
| `BottomNavigation` | destinations, active key; navigate event | each active, route loading, narrow, safe area | `NavigationDestination` presentation may remain internal; no router |
| `ContextualHeader` | title, optional back/action slots | root, detail, management, long | `ScreenTitle`, `BackButton`, optional `Button`; one heading |
| `PeriodHeader` | period view model; step events | current, historical, missing dates | `MonthStepper` + period range; no date calculation |
| `MonthlyOutcome` | financial outcome and async state; retry event | loading, ready, no budget, zero, over, partial error | `CurrencyDisplay`, `BudgetStatus`, optional subset |
| `BudgetStatus` | spent, remaining, limit, pace | under, faster, exhausted, over, no budget | `BudgetProgressBar` + `PaceAnnotation`; no data calculation |
| `TransactionLedgerToolbar` | available/active filters, organize state; filter/organize/retry-organize events | default, filtered, organizing, organize-preview failure, historical | `ActiveFilterSummary`, labeled controls; Organize visible only for current month and uses active API scope |
| `TransactionLedger` | grouped rows and async state; retry/open events | loading, refreshing, ready, empty, filtered empty, error | `TransactionGroup` sequence; no grouping calculation |
| `TransactionGroup` | date header and rows | one, many, long | `DateGroupHeader` + `TransactionListItem`; semantic section |
| `TransactionFormSheet` | form view model, values, mode, submit state; field/submit/close events | create, edit, validation, saving, server error, keyboard | `BaseSheet` plus field organisms; no API or remembered-default storage |
| `ConsumptionFields` | category/payment/custom-budget options and values; change/create-request events | default, missing category, no cards, many budgets | Pure field composition; consequences explained |
| `FinanceMovementFields` | movement kinds, accounts, inline-create state; change/create/close events | debt, savings, no account, creating account, error | Pure field/form composition; no account mutation |
| `TransactionActionSheet` | selected transaction, pending action; edit/delete/close events | default, delete pending, long identity | `BaseSheet`; delete requests confirmation rather than executing |
| `OrganizeReviewSheet` | preview, applying/error state; apply/close/retry events | empty, partial, full, none selected, applying, error | Owns checkbox selection as required by active spec; emits filtered payload; no preview/apply request |
| `InsightNarrative` | observation, required primary numeric value/unit, explanation, recommendation, optional chart model | amount without chart, chart, long, chart fallback | `CurrencyDisplay`/value text, `ChartSummary`, optional `VegaChart`; observation and recommendation labeled |
| `VegaChart` | approved spec/data, focal datum, accessible ids; render retry event | bar, line, pie, area, render failure, narrow | Visual renderer only; paired summary/table supplied by parent |
| `FinanceOutcome` | selected mode and financial display state | debt, savings, card, loading, error, reverse | One leading total; no cross-mode arithmetic |
| `DebtAccountList` | account rows and async state; open/retry events | loading, empty, open, settled only, mixed, error | `DebtAccountRow`; no transaction-entry event |
| `SavingsAccountList` | account rows and async state; open/retry events | loading, empty, unused, reverse, error | `SavingsAccountRow`; no transaction-entry event |
| `CreditCardGroupList` | group rows and async/mutation state; open/create/edit/delete/retry events | loading, empty, ready, partial error, delete blocked | `CreditCardGroupRow`; management only |
| `StatementList` | statement rows and async state; open/retry events | loading, current-period unpaid, closed unpaid, all paid, empty, error | `StatementRow`; chronological view model supplied |
| `StatementDetail` | statement identity, period kind, unpaid/paid status, amount, purchase groups and async state; open-purchase/retry events | current-period unpaid, closed unpaid, paid, no purchases, loading, purchase error | `TransactionLedger`-style purchase ledger; current period is not a third status |
| `StatementPaymentSheet` | statement identity/amount, date, submit state; change/submit/close events | default, invalid, pending, failure, success | `BaseSheet` + `FormField`; full-payment consequence copy |
| `CreditCardGroupManagement` | groups, form values, close-day consequence, submit/delete states; create/edit/delete/cancel events | create, edit, invalid close day, pending, failure, eligible delete | Existing statement periods remain unchanged; no API ownership |
| `FinanceAccountOutcome` | account identity/direction/balance and async state | debt, savings, zero, reverse, overdue, settled | `CurrencyDisplay`; complete truthful label |
| `FinanceMovementLedger` | movement rows and async state; open/retry events | loading, empty, ready, partial error, refreshing | `FinanceMovementRow`; no create event |
| `AccountManagementActions` | confirmed available actions and pending state; request events | none, edit, eligible delete, blocked delete, pending | Does not invent actions absent from domain contract |
| `SettingsSection` | title and settings rows | default, partial status, long | `SettingsRow` list with internal dividers |
| `CurrentBudgetOutcome` | period outcome, optional objective and async state; adjust/create/edit-objective/retry events | loading, missing period, under, exhausted, over, objective empty/long, error | `BudgetStatus`; remaining leads and objective is supporting copy |
| `AdjustmentHistory` | adjustment rows and async state; retry event | empty, ready, long reason, error | `AdjustmentRow` ledger |
| `CustomBudgetSection` | rows and async state; open/create/toggle/retry events | loading, empty, ready, mixed active, toggle pending/error | `CustomBudgetRow`; no mutation transport |
| `CustomBudgetDetail` | budget identity, progress, transaction groups and async state; open transaction event | unused, ready, over, partial error | `BudgetProgressBar` + `TransactionLedger` |
| `FutureBudgetConfig` | next-month default amount and submit state; change/submit events | default, editing, invalid, pending, success, failure | `AmountField`; explicitly next-month-only and non-retroactive |
| `MonthlyBudgetFormSheet` | period range, configured default, amount, optional objective, submit state; change/submit/close events | prefilled, objective empty/long, invalid amount, duplicate period, pending, duplicate submit, server failure | `BaseSheet` + form molecules; creates one period and owns no mutation |
| `BudgetAdjustmentSheet` | current limit, delta, direction, reason, submit state; change/submit/close events | increase, decrease, missing reason, pending, duplicate submit, failure | `BaseSheet` + form molecules; no mutation |
| `CustomBudgetFormSheet` | mode, name, target, active, target history, submit state; change/toggle/submit/close events | create, rename, retarget, deactivate, invalid, pending, success, failure | `BaseSheet`; preserves and displays target-change history |
| `CategoryTree` | branch view models and async state; row events/retry | loading, empty, ready, max depth, partial error | `CategoryBranch`; tree semantics |
| `CategoryBranch` | category and child branches; expand/row events | collapsed, expanded, leaf, max depth, protected | Recursive composition capped at three levels |
| `CategoryFormSheet` | mode, options, values, submit state; change/submit/close events | add root, add child, rename, invalid, pending, failure | `BaseSheet` + `FormField`; no mutation |
| `BaseSheet` | open, title ids, body/footer slots, dismissal policy; close event | action, form, review, confirmation, keyboard, reduced motion | Focus trap/restore, safe area and responsive dialog conversion |
| `ConfirmationSheet` | object, consequence, confirm label, pending/error; confirm/cancel events | destructive, consequential, blocked, pending, failure | `BaseSheet`; one neutral and one final action |

#### Template contracts

| Template | Slot/input API | Fixed page states | Responsive boundary |
|---|---|---|---|
| `AppShellTemplate` | optional header, content, notice, navigation slots | session loading, ready, network unavailable, expired | Phone bottom navigation; centered larger view |
| `DashboardTemplate` | period, outcome, action, toolbar, ledger and overlay slots | loading, ready, no budget, empty, partial failure | One column; action before long ledger |
| `StatisticsTemplate` | period, freshness, narrative sequence, regenerate action slots | loading, no report, no data, generating, ready, dirty, error | Narrative measure; no KPI grid |
| `FinanceTemplate` | selected mode, selector, outcome and collection slots | each mode, loading, empty, mode-local error | One mode at a time; optional independent tablet columns |
| `FinanceAccountDetailTemplate` | header, outcome, movement ledger, management slots | loading, unused, ready, reverse, partial error | Outcome then one-column ledger at 375px |
| `CreditCardGroupDetailTemplate` | header, outcome, statements, `StatementDetail`, management/overlay slots | loading, empty, current period, unpaid, paid, purchase-detail error, partial error | Single column phone; optional list/detail tablet split |
| `AccountTemplate` | management, account, data and sign-out slots | session loading, ready, provider partial, network unavailable | Shared list surfaces; no inline page components |
| `BudgetTemplate` | current outcome, history, custom budgets, config and overlay slots | loading, missing period, ready, partial error, network unavailable | Remaining first; one column phone |
| `CategoriesTemplate` | type selector, tree, add action and overlay slots | loading, empty, ready, partial error, network unavailable | Tree remains readable without horizontal scroll |

All responsive behavior not repeated in a row inherits section 16. All focus, naming,
color-independent meaning and target-size behavior inherits section 17. All async
components use the explicit state model in section 15.1; they never infer loading from
an empty collection.

## 15. View-model boundaries

Page data must be mapped to presentation contracts before reaching templates. The
following examples describe shape, not TypeScript implementation.

### 15.1 Async region state

```text
AsyncRegion<T> =
  | initial-loading
  | ready with T and optional refreshing flag
  | empty with explicit reason
  | error with recoverable user message
```

Independent regions receive independent state. Dashboard summary failure does not
erase the ledger. Finance card failure does not turn debt into an empty list.

### 15.2 Financial display state

```text
FinancialAmount =
  raw integer amount
  display direction
  precise Vietnamese label
  semantic role
  optional explanatory text
```

Components do not infer direction from `Math.abs()` or a color. The page/controller
supplies the truthful label and raw signed meaning.

### 15.3 Events

Events describe user intent rather than transport details:

| Prefer | Avoid |
|---|---|
| `onRequestCreateTransaction` | `onPostTransactionsApi` |
| `onRequestDelete(transaction)` | `onDelete(id)` without context |
| `onSelectFinanceMode(mode)` | router calls inside selector |
| `onRetrySummary` | template-owned `fetch` |
| `onSubmitAdjustment(values)` | form importing SWR mutation |

## 16. Responsive rules

### 16.1 Phone, 375-430px

- One reading column and `20px` page gutter.
- Outcome first, action within thumb reach, bottom navigation safe-area-aware.
- Sheets bottom-aligned and keyboard-aware.
- Amounts scale before body text; important values never ellipsize.
- Filters use a sheet or wrapping controls, not a clipped horizontal row with hidden
  labels.
- Every design is accepted at 375px before larger widths.

### 16.2 Narrow phone, 320-374px

- Preserve `20px` gutter when possible, then use the documented `16px` fallback.
- Stack action pairs.
- Reduce Display amount to Title role.
- Never reduce body or input text below their canonical role.

### 16.3 Tablet, 768-1023px

- Center content.
- Use two columns only for independent subjects, such as a Finance outcome beside its
  collection summary; never split one ledger's reading order.
- Bottom sheets may become dialogs with the same component state contract.

### 16.4 Desktop, 1024px and above

- Ledger flows cap near the documented narrow measure.
- Analytics and management may use the wider documented measure.
- More width does not create equal KPI grids, card walls or persistent black
  navigation.

## 17. Accessibility contract

- Body copy defaults to the documented Body role; form inputs are at least that size.
- Every interactive target is at least `44 x 44px`.
- Focus-visible is independent of fill and semantic color.
- Income, expense, debt direction, overdue, exceeded, validation and selection always
  include a non-color cue.
- Icon-only buttons have accessible names; important actions prefer visible labels.
- Transaction rows expose a meaningful accessible name including identity, amount,
  direction and date.
- Content selectors use appropriate single-selection semantics and keyboard behavior.
- Trees expose hierarchy, level and expanded state.
- Sheets trap and restore focus, support Escape where appropriate and announce title.
- Charts include narrative summary and accessible tabular data.
- Loading announcements are polite and do not repeatedly announce background refresh.
- Motion honors `prefers-reduced-motion`.

## 18. Storybook state matrix

Every component receives a co-located CSF3 story with `autodocs` and a11y enabled.
Template stories use isolated organisms and fixed data, never API calls.

| Component/surface | Minimum stories |
|---|---|
| `AppShellTemplate` | Dashboard active, detail with back, network unavailable, expired session, 375px safe area |
| `MonthlyOutcome` | under pace, faster pace, exceeded, no budget, zero, unpaid subset, large amount, loading |
| `TransactionListItem` | expense, income, card, custom budget, debt, savings, long identity, large amount, selected/focus |
| `TransactionLedger` | default, loading, empty, filtered empty, partial error, refreshing, long month |
| `TransactionFormSheet` | default, edit, consumption, debt, savings, missing budget, validation, saving, server error, keyboard |
| `TransactionLedgerToolbar` | default, filtered, organizing, preview failure with retry, historical month |
| `OrganizeReviewSheet` | empty, categories only, full, long content, none selected, applying, apply error, narrow |
| `InsightNarrative` | text only, amount, chart, recommendation, long label, chart fallback |
| `StatisticsTemplate` | loading, no report, no data, generating, ready, progressive, dirty, refreshing, error |
| `FinanceModeSelector` | each selected mode, keyboard focus, long localization, narrow |
| Debt mode | empty, open, settled only, mixed direction, overdue, overpaid, loading, error |
| Savings mode | empty, default, zero, withdrawal exceeded, loading, error |
| Card mode | empty, unpaid, current open, all paid, partial error, large amount |
| `FinanceAccountDetailTemplate` | loading, unused, history, zero, reverse, overdue, settled, partial error, network unavailable, expired |
| `CreditCardGroupDetailTemplate` | loading, current period, unpaid, paid, empty statement, purchase failure, network unavailable, expired |
| `StatementDetail` | current-period unpaid, closed unpaid, paid, no purchases, purchase loading/error, long purchase identity |
| Statement payment | default, date validation, pending, duplicate submit, failure, success consequence copy |
| `AccountTemplate` | default, session loading, provider partial, export pending, export success/error, network unavailable, expired |
| `BudgetTemplate` | loading, refreshing, missing period, objective empty/long, under, exhausted, over, adjustment history, partial error, network unavailable, expired |
| `MonthlyBudgetFormSheet` | prefilled default, objective empty/long, invalid, duplicate period, pending, duplicate submit, failure |
| `CustomBudgetRow` | active, inactive, under, over, no spend, delete blocked, long name |
| `CustomBudgetDetail` | unused, linked transactions, over, partial ledger error, long identity |
| `CustomBudgetFormSheet` | create, rename, retarget with history, activate, deactivate, validation, pending, failure |
| `BudgetAdjustmentSheet` | increase, decrease, missing reason, pending, duplicate submit, failure |
| `CategoriesTemplate` | loading, refreshing, empty, seeded tree, max depth, long names, protected, partial error, network unavailable, expired |
| `ConfirmationSheet` | transaction delete, group delete, category blocked, discard edits, pending |

For each applicable story, verify `375px`, `393px`, `768px` and `1280px`. At least
one 375px story per organism/template includes long Vietnamese content and a large VND
amount.

## 19. Existing component disposition

| Existing implementation | Target decision |
|---|---|
| Fixed black `Navbar` | Deprecate; replace with App shell contextual header and bottom navigation |
| Inline Dashboard summary, month stepper and transaction rows | Remove duplication; compose canonical molecules/organisms |
| `DashboardSummary` | Supersede with remaining-aware `MonthlyOutcome` |
| `TransactionGroup` and `TransactionListItem` | Revise and make production canonical |
| Template-local Vega renderer | Remove; `VegaChart` is the single renderer |
| Dark/shadowed Statistics cards | Replace with continuous `InsightNarrative` composition |
| Entity-ordered `CreditCardsTemplate` | Replace with mode-driven `FinanceTemplate` |
| `Math.abs()` finance balances | Prohibit in presentation mapping; show reverse state truthfully |
| `DebtOverviewTemplate` | Do not integrate as-is; reuse only domain-safe parts inside Finance mode |
| `LinkTransactionSheet` | Legacy pending explicit product decision |
| Account UI inside `page.tsx` | Extract target `AccountTemplate`, sections and rows |
| Stateful monolithic Budget/Categories templates | Decompose interactions into organisms; templates retain layout only |
| `window.confirm` | Replace with `ConfirmationSheet` |
| API-owning `TransactionForm` | Refactor target to injected data/events; preserve one shared form experience |

No component is deprecated merely because it is old. Deprecation above is based on a
documented conflict with Calm Ledger, current intent or the CDD layer contract.

## 20. Documentation decisions still required before implementation

The following are not silently resolved by visual design:

1. Confirm whether `/cards` remains the canonical Finance URL or is migrated to a
   clearer route. The visible navigation label is already “Tài chính”.
2. Confirm whether Finance account details use dedicated routes and whether the old
   `/debts/[id]` route is retired or redirected permanently.
3. Reconcile legacy debt link/unlink behavior with the current rule that debt and
   savings accounts are selected directly in the shared transaction form.
4. Approve precise Vietnamese reverse-balance copy for all lend/borrow edge directions.
5. Confirm whether data export is still in product scope; the current BRD marks it out
   of scope while Account UI contains export controls.
6. Reconcile the old mandatory pace-line chart BRD entries with the newer Home spec
   that removed that chart and `DESIGN.md`, which requires charts only when useful.

Implementation must not invent answers to these decisions.

## 21. Recommended implementation sequence after approval

This section is sequencing guidance only; it does not authorize implementation.

1. Add missing approved tokens already named in `DESIGN.md`, then document token
   migration from deprecated dark/translucent values.
2. Build and prove shared atoms and molecules in Storybook.
3. Build `BaseSheet`, `ContextualHeader`, `BottomNavigation` and other shared organisms
   in isolation.
4. Build Dashboard organisms and compose `DashboardTemplate` with mock view models.
5. Integrate Dashboard through a thin page/controller.
6. Build and integrate the shared `TransactionFormSheet` once on Dashboard; Finance
   remains read-only for debt/savings transaction entry.
7. Build Statistics narrative and make `VegaChart` the sole chart renderer.
8. Build mode-specific Finance organisms, then compose `FinanceTemplate`.
9. Build Account, Budget and Categories management compositions.
10. Remove deprecated and duplicate implementations only after route-level visual,
    accessibility and behavior verification.

At every step: build in isolation, define states, compose, assemble the page with mock
data, then integrate business logic. This ordering is mandatory Component Driven
Development, not an optional Storybook follow-up.

## 22. Design acceptance checklist

- The first section of every screen answers its documented user question.
- Every action region has exactly one dominant action.
- Dashboard shows consumption spending first and unpaid card spend only as a subset.
- Finance uses one local mode at a time and never hides reverse balances.
- Budget shows remaining amount before configuration.
- Statistics reads as a narrative and does not render meaningless charts.
- Account management is composed from shared settings components, not inline page UI.
- Transaction entry exists once on Dashboard and handles consumption, debt and savings
  contexts without a second Finance entry surface.
- Lists use rhythm and dividers before cards.
- Permanent black navigation, decorative gradients, card shadows and generic `+`
  actions are absent.
- All important financial directions combine label/sign/icon with semantic color.
- Loading, empty, partial, error, unusual value, long content, keyboard, unavailable network,
  pending and destructive states are designed.
- The 375px composition has no horizontal overflow and all targets meet `44 x 44px`.
- Each component is isolated with fixed mocked states before page integration.
- Every new component has a co-located CSF3 story and `autodocs`.
- Pages own data and mutations; templates own reading order; organisms own coherent
  interactions; molecules and atoms remain pure.

## 23. Non-goals

- No new visual language, color family, typography, radius grammar, chart grammar or
  navigation model.
- No desktop-first dashboard grid.
- No API, database or route implementation.
- No retroactive endorsement of behavior found only in legacy UI.
- No component code, CSS, tests or Storybook files in this documentation phase.
