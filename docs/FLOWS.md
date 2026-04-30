# Sequence Diagrams — Personal Finance Tracker

## Pre-condition: Authentication

> **Áp dụng cho tất cả flows từ #2 trở đi.**
>
> Mỗi request đến API Route đều phải đi qua bước xác thực session trước khi chạm vào bất kỳ business logic nào:
>
> ```
> API->>Auth: getSession(request.headers)
> alt Không có session hợp lệ
>     Auth-->>API: null
>     API-->>Client: 401 { error: "Unauthorized" }
> else Session hợp lệ
>     Auth-->>API: { user: { id, email, ... } }
>     -- tiếp tục flow bên dưới --
> end
> ```
>
> Ngoài ra, mọi query DB đều được scope theo `user_id = session.user.id`. Truy cập tài nguyên của user khác trả về `403 Forbidden`.

---

## 1. Đăng nhập (GitHub OAuth)

```mermaid
sequenceDiagram
    actor User
    participant App as Next.js App
    participant Auth as better-auth
    participant GitHub

    User->>App: Bấm "Đăng nhập với GitHub"
    App->>Auth: signIn.social({ provider: "github" })
    Auth->>GitHub: Redirect OAuth authorize
    GitHub->>User: Hiển thị màn hình xác nhận
    User->>GitHub: Chấp nhận
    GitHub->>Auth: Callback với code
    Auth->>GitHub: Exchange code → access token
    GitHub->>Auth: Trả user profile (email, name, avatar)
    Auth->>Auth: Upsert User record trong D1
    Auth->>App: Session cookie + redirect /
    App->>User: Hiển thị Home screen
```

---

## 2. Log giao dịch chi tiêu

```mermaid
sequenceDiagram
    actor User
    participant Home as Home Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Home: Nhập số tiền, chọn danh mục, ghi chú, ngày
    User->>Home: (optional) Chọn custom budgets
    User->>Home: Bấm "Lưu"

    Home->>API: POST /api/transactions { amount, type: expense, category_id, note, date, custom_budget_ids[] }

    API->>DB: SELECT MonthlyBudget WHERE month = date.month AND user_id
    alt Chưa có budget tháng này
        DB-->>API: null
        API-->>Home: 400 { error: "Chưa có budget tháng này. Vui lòng tạo budget trước." }
        Home-->>User: Hiển thị error toast + link tới Budgets tab
    else Có budget
        DB-->>API: monthly_budget row
        API->>DB: INSERT Transaction (với monthly_budget_id)
        API->>DB: INSERT TransactionCustomBudget (nếu có custom_budget_ids)
        DB-->>API: transaction created
        API-->>Home: 201 { transaction }
        Home->>Home: Reset form (giữ category, date)
        Home->>Home: Refresh status card
        Home-->>User: Toast "Đã lưu ✓"
    end
```

---

## 3. Log thu nhập

```mermaid
sequenceDiagram
    actor User
    participant Home as Home Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Home: Chọn loại = "Thu nhập"
    Note over Home: Ẩn field Custom budgets
    User->>Home: Nhập số tiền, danh mục, ghi chú, ngày
    User->>Home: Bấm "Lưu"

    Home->>API: POST /api/transactions { amount, type: income, category_id, note, date }

    API->>DB: INSERT Transaction (monthly_budget_id = null cho income)
    DB-->>API: transaction created
    API-->>Home: 201 { transaction }
    Home->>Home: Refresh status card (cập nhật tiết kiệm tháng)
    Home-->>User: Toast "Đã lưu ✓"
```

---

## 4. Tạo Monthly Budget thủ công

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Vào tab Budgets, thấy "Chưa có budget tháng này"
    User->>Budgets: Bấm "Tạo budget tháng [MM/YYYY]"

    Budgets->>API: GET /api/budget-config
    API->>DB: SELECT BudgetConfig WHERE user_id
    DB-->>API: { default_monthly_amount }
    API-->>Budgets: { default_monthly_amount }

    Budgets-->>User: Hiển thị form với giá trị mặc định điền sẵn
    User->>Budgets: (optional) Sửa số tiền → Bấm "Tạo"

    Budgets->>API: POST /api/monthly-budgets { month: "YYYY-MM", amount }
    API->>DB: SELECT COUNT(*) WHERE month = ? AND user_id = ?
    alt Budget tháng này đã tồn tại
        DB-->>API: count > 0
        API-->>Budgets: 409 Conflict
        Budgets-->>User: "Budget tháng này đã tồn tại"
    else Chưa có
        API->>DB: INSERT MonthlyBudget
        DB-->>API: monthly_budget row
        API-->>Budgets: 201 { monthly_budget }
        Budgets->>Budgets: Render pace line chart
        Budgets-->>User: Budget tháng hiển thị
    end
```

---

## 5. Chỉnh sửa Monthly Budget (tăng/giảm)

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Bấm nút chỉnh budget
    Budgets-->>User: Bottom sheet: input delta (+ hoặc -), field ghi chú lý do

    User->>Budgets: Nhập delta = +500000, ghi chú "Lương thưởng thêm"
    User->>Budgets: Bấm "Xác nhận"

    Budgets->>API: PATCH /api/monthly-budgets/:id { delta: 500000, note: "..." }
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE MonthlyBudget SET amount = amount + delta WHERE id
    API->>DB: INSERT BudgetAdjustment { monthly_budget_id, delta, note }
    API->>DB: COMMIT
    DB-->>API: updated budget
    API-->>Budgets: 200 { monthly_budget, adjustment }
    Budgets->>Budgets: Cập nhật số tiền + re-render pace line
    Budgets->>Budgets: Thêm row vào accordion lịch sử
    Budgets-->>User: Toast "Đã cập nhật budget"
```

---

## 6. Tạo Custom Budget

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Bấm FAB "+" trong section Custom Budgets
    Budgets-->>User: Form: tên budget, số tiền mục tiêu

    User->>Budgets: Nhập "Trip Đà Lạt", 3.000.000₫ → Bấm "Tạo"
    Budgets->>API: POST /api/custom-budgets { name, amount }
    API->>DB: INSERT CustomBudget { user_id, name, amount, is_active: true }
    DB-->>API: custom_budget row
    API-->>Budgets: 201 { custom_budget }
    Budgets->>Budgets: Thêm card vào list
    Budgets-->>User: Card "Trip Đà Lạt" xuất hiện
```

---

## 7. Toggle Custom Budget active/inactive

```mermaid
sequenceDiagram
    actor User
    participant Budgets as Budgets Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Budgets: Toggle switch trên card custom budget
    Budgets->>API: PATCH /api/custom-budgets/:id { is_active: false }
    API->>DB: UPDATE CustomBudget SET is_active = false WHERE id
    DB-->>API: updated
    API-->>Budgets: 200 { custom_budget }
    Budgets->>Budgets: Card mờ đi (inactive state)
    Note over Budgets: Budget inactive sẽ không hiện trong form log giao dịch
```

---

## 8. Quản lý danh mục — Thêm danh mục

```mermaid
sequenceDiagram
    actor User
    participant Settings as Settings Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Settings: Vào Settings > Danh mục
    Settings->>API: GET /api/categories
    API->>DB: SELECT * FROM Category WHERE user_id ORDER BY level, sort_order
    DB-->>API: category rows
    API-->>Settings: Category tree
    Settings-->>User: Render tree view

    User->>Settings: Bấm "+" cạnh "Ăn uống" (level 1)
    Settings-->>User: Inline input xuất hiện ở level 2
    User->>Settings: Nhập "Bún bò" → Enter

    Settings->>API: POST /api/categories { name: "Bún bò", parent_id: <ăn_uống_id> }
    API->>API: Validate level ≤ 3
    API->>DB: INSERT Category { user_id, name, parent_id, level: 2 }
    DB-->>API: category row
    API-->>Settings: 201 { category }
    Settings->>Settings: Chèn node vào tree
    Settings-->>User: "Bún bò" xuất hiện dưới "Ăn uống"
```

---

## 9. Xoá danh mục

```mermaid
sequenceDiagram
    actor User
    participant Settings as Settings Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Settings: Swipe left trên danh mục → Bấm "Xoá"

    Settings->>API: DELETE /api/categories/:id
    API->>DB: SELECT COUNT(*) FROM Transaction WHERE category_id = :id
    alt Có giao dịch đang dùng
        DB-->>API: count > 0
        API-->>Settings: 409 { error: "Danh mục đang được dùng bởi N giao dịch" }
        Settings-->>User: Alert "Không thể xoá. Danh mục đang được dùng bởi N giao dịch."
    else Không có giao dịch
        API->>DB: SELECT COUNT(*) FROM Category WHERE parent_id = :id
        alt Có danh mục con
            DB-->>API: count > 0
            API-->>Settings: 409 { error: "Xoá danh mục con trước" }
            Settings-->>User: Alert "Vui lòng xoá danh mục con trước."
        else Không có con
            API->>DB: DELETE FROM Category WHERE id = :id
            DB-->>API: deleted
            API-->>Settings: 200 OK
            Settings->>Settings: Xoá node khỏi tree
            Settings-->>User: Danh mục biến mất
        end
    end
```

---

## 10. Cập nhật Budget Config (giá trị mặc định tháng tới)

```mermaid
sequenceDiagram
    actor User
    participant Settings as Settings Screen
    participant API as API Route
    participant DB as D1 Database

    User->>Settings: Sửa field "Giá trị budget mặc định tháng tới"
    User->>Settings: Blur hoặc bấm Enter

    Settings->>API: PUT /api/budget-config { default_monthly_amount }
    API->>DB: INSERT OR REPLACE BudgetConfig { user_id, default_monthly_amount }
    DB-->>API: updated
    API-->>Settings: 200 { budget_config }
    Settings-->>User: Toast "Đã lưu. Sẽ áp dụng khi tạo budget tháng tới."
```
