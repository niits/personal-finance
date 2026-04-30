# Sequence Diagrams — Personal Finance Tracker

## Pre-condition: Authentication

> **Applies to all flows from #2 onwards.**
>
> Every request to an API Route must go through session authentication before touching any business logic:
>
> ```
> API->>Auth: getSession(request.headers)
> alt No valid session
>     Auth-->>API: null
>     API-->>Client: 401 { error: "Unauthorized" }
> else Valid session
>     Auth-->>API: { user: { id, email, ... } }
>     -- continue flow below --
> end
> ```
>
> In addition, all DB queries are scoped to `user_id = session.user.id`. Accessing another user's resources returns `403 Forbidden`.

---

## 1. Login (GitHub OAuth)

```mermaid
sequenceDiagram
    actor User
    participant App as Next.js App
    participant Auth as better-auth
    participant GitHub

    User->>App: Click "Đăng nhập với GitHub"
    App->>Auth: signIn.social({ provider: "github" })
    Auth->>GitHub: Redirect OAuth authorize
    GitHub->>User: Show authorization screen
    User->>GitHub: Approve
    GitHub->>Auth: Callback with code
    Auth->>GitHub: Exchange code → access token
    GitHub->>Auth: Return user profile (email, name, avatar)
    Auth->>Auth: Upsert User record in D1
    Auth->>App: Session cookie + redirect /
    App->>User: Show Home screen
```

---

## 2. Log expense transaction

```mermaid
sequenceDiagram
    actor User
    participant Home as Home Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Home: Enter amount, select category, note, date
    User->>Home: (optional) Select custom budgets
    User->>Home: Press "Lưu"

    Home->>API: POST /api/transactions { amount, type: expense, category_id, note, date, custom_budget_ids[] }

    API->>DB: SELECT MonthlyBudget WHERE month = date.month AND user_id
    alt No budget for this month
        DB-->>API: null
        API-->>Home: 400 { error: "Chưa có budget tháng này. Vui lòng tạo budget trước." }
        Home-->>User: Show error toast + link to Budgets tab
    else Budget exists
        DB-->>API: monthly_budget row
        API->>DB: INSERT Transaction (with monthly_budget_id)
        API->>DB: INSERT TransactionCustomBudget (if custom_budget_ids present)
        DB-->>API: transaction created
        API-->>Home: 201 { transaction }
        Home->>Home: Reset form (keep category, date)
        Home->>Home: Refresh status card
        Home-->>User: Toast "Đã lưu ✓"
    end
```

---

## 3. Log income transaction

```mermaid
sequenceDiagram
    actor User
    participant Home as Home Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Home: Select type = "Thu nhập"
    Note over Home: Hide Custom budgets field
    User->>Home: Enter amount, category, note, date
    User->>Home: Press "Lưu"

    Home->>API: POST /api/transactions { amount, type: income, category_id, note, date }

    API->>DB: INSERT Transaction (monthly_budget_id = null for income)
    DB-->>API: transaction created
    API-->>Home: 201 { transaction }
    Home->>Home: Refresh status card (update monthly savings)
    Home-->>User: Toast "Đã lưu ✓"
```

---

## 4. Manually create Monthly Budget

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Open Budgets tab, see "Chưa có budget tháng này"
    User->>Budgets: Press "Tạo budget tháng [MM/YYYY]"

    Budgets->>API: GET /api/budget-config
    API->>DB: SELECT BudgetConfig WHERE user_id
    DB-->>API: { default_monthly_amount }
    API-->>Budgets: { default_monthly_amount }

    Budgets-->>User: Show form with default amount pre-filled
    User->>Budgets: (optional) Edit amount → Press "Tạo"

    Budgets->>API: POST /api/monthly-budgets { month: "YYYY-MM", amount }
    API->>DB: SELECT COUNT(*) WHERE month = ? AND user_id = ?
    alt Budget for this month already exists
        DB-->>API: count > 0
        API-->>Budgets: 409 Conflict
        Budgets-->>User: "Budget tháng này đã tồn tại"
    else Does not exist yet
        API->>DB: INSERT MonthlyBudget
        DB-->>API: monthly_budget row
        API-->>Budgets: 201 { monthly_budget }
        Budgets->>Budgets: Render pace line chart
        Budgets-->>User: Monthly budget displayed
    end
```

---

## 5. Adjust Monthly Budget (increase/decrease)

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Press adjust budget button
    Budgets-->>User: Bottom sheet: input delta (+ or -), reason note field

    User->>Budgets: Enter delta = +500000, note "Lương thưởng thêm"
    User->>Budgets: Press "Xác nhận"

    Budgets->>API: PATCH /api/monthly-budgets/:id { delta: 500000, note: "..." }
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE MonthlyBudget SET amount = amount + delta WHERE id
    API->>DB: INSERT BudgetAdjustment { monthly_budget_id, delta, note }
    API->>DB: COMMIT
    DB-->>API: updated budget
    API-->>Budgets: 200 { monthly_budget, adjustment }
    Budgets->>Budgets: Update amount + re-render pace line
    Budgets->>Budgets: Add row to history accordion
    Budgets-->>User: Toast "Đã cập nhật budget"
```

---

## 6. Create Custom Budget

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Press "+" FAB in Custom Budgets section
    Budgets-->>User: Form: budget name, target amount

    User->>Budgets: Enter "Trip Đà Lạt", 3.000.000₫ → Press "Tạo"
    Budgets->>API: POST /api/custom-budgets { name, amount }
    API->>DB: INSERT CustomBudget { user_id, name, amount, is_active: true }
    DB-->>API: custom_budget row
    API-->>Budgets: 201 { custom_budget }
    Budgets->>Budgets: Add card to list
    Budgets-->>User: Card "Trip Đà Lạt" appears
```

---

## 7. Toggle Custom Budget active/inactive

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Toggle switch on custom budget card
    Budgets->>API: PATCH /api/custom-budgets/:id { is_active: false }
    API->>DB: UPDATE CustomBudget SET is_active = false WHERE id
    DB-->>API: updated
    API-->>Budgets: 200 { custom_budget }
    Budgets->>Budgets: Card appears dimmed (inactive state)
    Note over Budgets: Inactive budgets will not appear in the transaction log form
```

---

## 8. Category management — Add category

```mermaid
sequenceDiagram
    actor User
    participant Settings as Settings Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Settings: Go to Settings > Categories
    Settings->>API: GET /api/categories
    API->>DB: SELECT * FROM Category WHERE user_id ORDER BY level, sort_order
    DB-->>API: category rows
    API-->>Settings: Category tree
    Settings-->>User: Render tree view

    User->>Settings: Press "+ Thêm" button
    Settings-->>User: Form panel appears (name input + parent selector dropdown)
    User->>Settings: Type "Bún bò", select "Ăn uống" as parent → Press "Lưu"

    Settings->>API: POST /api/categories { name: "Bún bò", parent_id: <ăn_uống_id> }
    API->>API: Validate level ≤ 3
    API->>DB: INSERT Category { user_id, name, parent_id, level: 2 }
    DB-->>API: category row
    API-->>Settings: 201 { category }
    Settings->>Settings: Insert node into tree
    Settings-->>User: "Bún bò" appears under "Ăn uống"
```

---

## 9. Delete category

```mermaid
sequenceDiagram
    actor User
    participant Settings as Settings Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Settings: Swipe left on category → Press "Delete"

    Settings->>API: DELETE /api/categories/:id
    API->>DB: SELECT COUNT(*) FROM Transaction WHERE category_id = :id
    alt Category is used by transactions
        DB-->>API: count > 0
        API-->>Settings: 409 { error: "Danh mục đang được dùng bởi N giao dịch" }
        Settings-->>User: Alert "Không thể xoá. Danh mục đang được dùng bởi N giao dịch."
    else No transactions
        API->>DB: SELECT COUNT(*) FROM Category WHERE parent_id = :id
        alt Has child categories
            DB-->>API: count > 0
            API-->>Settings: 409 { error: "Xoá danh mục con trước" }
            Settings-->>User: Alert "Vui lòng xoá danh mục con trước."
        else No children
            API->>DB: DELETE FROM Category WHERE id = :id
            DB-->>API: deleted
            API-->>Settings: 200 OK
            Settings->>Settings: Remove node from tree
            Settings-->>User: Category disappears
        end
    end
```

---

## 10. Update Budget Config (default value for next month)

```mermaid
sequenceDiagram
    actor User
    participant Settings as Settings Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Settings: Edit "Default budget value for next month" field
    User->>Settings: Blur or press Enter

    Settings->>API: PUT /api/budget-config { default_monthly_amount }
    API->>DB: INSERT OR REPLACE BudgetConfig { user_id, default_monthly_amount }
    DB-->>API: updated
    API-->>Settings: 200 { budget_config }
    Settings-->>User: Toast "Đã lưu. Sẽ áp dụng khi tạo budget tháng tới."
```

---

## 11. Seed categories on demand

```mermaid
sequenceDiagram
    actor User
    participant Settings as Categories Screen
    participant API as API Route
    participant DB as D1 Database

    Note over Settings: Shown only when GET /api/categories returns empty array
    User->>Settings: Press "Create sample categories"

    Settings->>API: POST /api/categories/seed
    API->>DB: INSERT OR IGNORE seed categories (7 parent + 20 children)
    DB-->>API: done
    API-->>Settings: 200 { ok: true }
    Settings->>Settings: mutate("/api/categories") — invalidate SWR cache
    Settings->>API: GET /api/categories
    API-->>Settings: Full category tree
    Settings-->>User: Category list renders
```
