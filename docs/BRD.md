# Business Requirements Document (BRD)
## Personal Finance Tracker

---

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | Draft |
| Author | niits |
| Created | 2026-04-29 |
| Last Updated | 2026-04-29 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [Business Objectives](#3-business-objectives)
4. [Scope](#4-scope)
5. [Stakeholders](#5-stakeholders)
6. [Functional Requirements](#6-functional-requirements)
7. [Business Rules](#7-business-rules)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Data Requirements](#9-data-requirements)
10. [User Interface Requirements](#10-user-interface-requirements)
11. [Process Flows](#11-process-flows)
12. [Assumptions & Constraints](#12-assumptions--constraints)
13. [Glossary](#13-glossary)

---

## 1. Executive Summary

Hệ thống theo dõi tài chính cá nhân cho phép người dùng ghi nhận thu nhập và chi tiêu hàng ngày, quản lý ngân sách theo tháng, và theo dõi tiến độ chi tiêu thực tế so với kế hoạch thông qua biểu đồ pace line. Mục tiêu cuối cùng là giúp người dùng nhận biết được mình đang tiêu nhiều hay ít so với kế hoạch tại bất kỳ thời điểm nào trong tháng.

---

## 2. Business Context

### 2.1 Problem Statement

Việc theo dõi chi tiêu cá nhân hiện nay đòi hỏi dùng spreadsheet thủ công hoặc các ứng dụng phức tạp không phù hợp với thói quen dùng điện thoại. Người dùng thiếu một công cụ đơn giản, nhanh để ghi nhận chi tiêu tức thời và có cái nhìn trực quan về tiến độ ngân sách trong tháng.

### 2.2 Proposed Solution

Ứng dụng web mobile-first chạy trên Cloudflare Pages, giao diện tối giản theo phong cách Apple. Màn hình chính là form nhập giao dịch — mở app là nhập được ngay — kèm theo trạng thái ngân sách tháng hiện tại.

### 2.3 Current State vs Future State

| Aspect | Current State | Future State |
|--------|--------------|--------------|
| Ghi chép chi tiêu | Thủ công (spreadsheet / ghi nhớ) | Nhập trực tiếp trên app trong vài giây |
| Theo dõi ngân sách | Không có hoặc kiểm tra cuối tháng | Pace line real-time, biết ngay hôm nay đang vượt hay tiết kiệm |
| Phân loại | Không nhất quán | Danh mục phân cấp, nhất quán, có thể tùy chỉnh |
| Báo cáo | Tính tay | Tổng hợp tự động theo tháng, danh mục, và ngân sách |

---

## 3. Business Objectives

### 3.1 Primary Objectives

| ID | Objective | Success Criteria |
|----|-----------|-----------------|
| OBJ-01 | Ghi nhận giao dịch nhanh chóng | Thời gian nhập 1 giao dịch < 10 giây |
| OBJ-02 | Theo dõi tiến độ ngân sách tháng | Người dùng biết ngay hôm nay đang vượt hay dưới pace |
| OBJ-03 | Phân tích chi tiêu theo danh mục | Xem được breakdown chi tiêu theo tháng và danh mục |
| OBJ-04 | Tính toán tiết kiệm hàng tháng | Hiển thị chính xác: Thu nhập − Chi tiêu = Tiết kiệm |

### 3.2 Secondary Objectives

| ID | Objective |
|----|-----------|
| OBJ-05 | Quản lý ngân sách linh hoạt (tăng/giảm mid-month) với audit trail |
| OBJ-06 | Hỗ trợ ngân sách dự án riêng (custom budgets) ngoài ngân sách tháng |

---

## 4. Scope

### 4.1 In Scope

- Xác thực người dùng qua GitHub OAuth
- Quản lý danh mục chi tiêu phân cấp (tối đa 3 cấp)
- Ghi nhận giao dịch chi tiêu và thu nhập (thủ công)
- Ngân sách tháng: tạo, điều chỉnh, lịch sử thay đổi
- Custom budgets: tạo, quản lý, gán giao dịch
- Pace line chart: biểu đồ tích lũy chi tiêu vs ngân sách lý tưởng
- Lịch sử giao dịch: xem, sửa, xóa, lọc
- Thống kê tháng: tổng chi, tổng thu, tiết kiệm
- Cấu hình giá trị ngân sách mặc định tháng tới
- Giao diện tiếng Việt, đơn vị VND

### 4.2 Out of Scope

- Import dữ liệu từ file ngân hàng (CSV, PDF)
- Đa tiền tệ
- Recurring transactions (giao dịch lặp lại tự động)
- Chia sẻ dữ liệu giữa nhiều người dùng
- Export báo cáo
- Push notification / reminder
- Tích hợp ngân hàng trực tiếp (Open Banking)

---

## 5. Stakeholders

| Role | Name | Responsibilities |
|------|------|-----------------|
| Product Owner | niits | Định nghĩa yêu cầu, phê duyệt |
| Developer | niits | Thiết kế, xây dựng, triển khai |
| End User | niits | Sử dụng ứng dụng hàng ngày |

---

## 6. Functional Requirements

### 6.1 Authentication (AUTH)

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-01 | Hệ thống phải hỗ trợ đăng nhập bằng GitHub OAuth | Must Have |
| AUTH-02 | Mỗi tài khoản GitHub tương ứng với 1 profile người dùng độc lập | Must Have |
| AUTH-03 | Session phải được duy trì qua cookie bảo mật (httpOnly) | Must Have |
| AUTH-04 | Người dùng chưa đăng nhập không được truy cập bất kỳ dữ liệu nào | Must Have |

---

### 6.2 Transaction Management (TXN)

| ID | Requirement | Priority |
|----|-------------|----------|
| TXN-01 | Người dùng phải có thể tạo giao dịch chi tiêu với các field: số tiền, danh mục, ghi chú (optional), ngày | Must Have |
| TXN-02 | Người dùng phải có thể tạo giao dịch thu nhập với các field: số tiền, danh mục, ghi chú (optional), ngày | Must Have |
| TXN-03 | Mỗi giao dịch chi tiêu phải được tự động liên kết với Monthly Budget của tháng tương ứng | Must Have |
| TXN-04 | Người dùng có thể gán giao dịch chi tiêu vào một hoặc nhiều Custom Budget | Must Have |
| TXN-05 | Giao dịch thu nhập không liên kết với bất kỳ Budget nào | Must Have |
| TXN-06 | Người dùng phải có thể xem danh sách giao dịch nhóm theo ngày, mặc định hiển thị tháng hiện tại | Must Have |
| TXN-07 | Người dùng phải có thể sửa bất kỳ field nào của giao dịch | Must Have |
| TXN-08 | Người dùng phải có thể xóa giao dịch | Must Have |
| TXN-09 | Người dùng phải có thể lọc danh sách giao dịch theo: tháng, danh mục, loại (chi/thu), custom budget | Should Have |
| TXN-10 | Số tiền phải là số nguyên dương, đơn vị VND | Must Have |
| TXN-11 | Ngày giao dịch mặc định là ngày hiện tại, người dùng có thể chọn ngày khác | Must Have |

---

### 6.3 Monthly Budget (MBGT)

| ID | Requirement | Priority |
|----|-------------|----------|
| MBGT-01 | Mỗi user chỉ có tối đa 1 Monthly Budget cho mỗi tháng | Must Have |
| MBGT-02 | Người dùng phải có thể tạo Monthly Budget thủ công cho bất kỳ tháng nào chưa có budget | Must Have |
| MBGT-03 | Khi tạo Monthly Budget, giá trị mặc định được lấy từ Budget Config | Should Have |
| MBGT-04 | Người dùng phải có thể điều chỉnh số tiền Monthly Budget (tăng hoặc giảm) kèm ghi chú lý do | Must Have |
| MBGT-05 | Mỗi lần điều chỉnh phải tạo ra 1 record Budget Adjustment để lưu lịch sử | Must Have |
| MBGT-06 | Hệ thống phải hiển thị lịch sử điều chỉnh của Monthly Budget (ngày, delta, ghi chú) | Must Have |
| MBGT-07 | Khi tạo giao dịch chi tiêu cho tháng T mà chưa có budget tháng T, hệ thống phải báo lỗi và yêu cầu tạo budget trước | Must Have |
| MBGT-08 | Hệ thống phải hiển thị Pace Line Chart cho Monthly Budget (xem FR-CHART) | Must Have |

---

### 6.4 Custom Budget (CBGT)

| ID | Requirement | Priority |
|----|-------------|----------|
| CBGT-01 | Người dùng phải có thể tạo Custom Budget với: tên và số tiền mục tiêu | Must Have |
| CBGT-02 | Custom Budget có trạng thái active hoặc inactive, người dùng có thể toggle bất kỳ lúc nào | Must Have |
| CBGT-03 | Chỉ Custom Budget đang active mới hiển thị trong form nhập giao dịch | Must Have |
| CBGT-04 | Một giao dịch chi tiêu có thể được gán vào nhiều Custom Budget cùng lúc | Must Have |
| CBGT-05 | Người dùng phải có thể xem danh sách giao dịch thuộc từng Custom Budget | Must Have |
| CBGT-06 | Hệ thống phải hiển thị progress của Custom Budget: tổng đã chi / mục tiêu | Must Have |
| CBGT-07 | Người dùng phải có thể sửa tên và số tiền mục tiêu của Custom Budget | Should Have |
| CBGT-08 | Người dùng phải có thể xóa Custom Budget (không xóa các giao dịch liên quan) | Should Have |

---

### 6.5 Budget Config (BCFG)

| ID | Requirement | Priority |
|----|-------------|----------|
| BCFG-01 | Mỗi user có đúng 1 Budget Config record | Must Have |
| BCFG-02 | Budget Config lưu trữ giá trị ngân sách mặc định dùng để seed Monthly Budget tháng tới | Must Have |
| BCFG-03 | Thay đổi Budget Config không ảnh hưởng đến Monthly Budget đang tồn tại | Must Have |
| BCFG-04 | Giao diện phải hiển thị rõ ràng rằng giá trị này chỉ dùng cho tháng tiếp theo | Must Have |

---

### 6.6 Category Management (CAT)

| ID | Requirement | Priority |
|----|-------------|----------|
| CAT-01 | Danh mục có cấu trúc phân cấp tối đa 3 cấp | Must Have |
| CAT-02 | Hệ thống phải cung cấp bộ danh mục mặc định (seed data) khi user đăng ký lần đầu | Must Have |
| CAT-03 | Người dùng phải có thể thêm danh mục ở bất kỳ cấp nào (1, 2, hoặc 3) | Must Have |
| CAT-04 | Người dùng phải có thể đổi tên danh mục | Must Have |
| CAT-05 | Người dùng phải có thể xóa danh mục không có giao dịch và không có danh mục con | Must Have |
| CAT-06 | Khi xóa danh mục đang được dùng bởi giao dịch, hệ thống phải từ chối và hiển thị số lượng giao dịch bị ảnh hưởng | Must Have |
| CAT-07 | Chỉ được chọn leaf node (danh mục không có con) khi gán cho giao dịch | Must Have |
| CAT-08 | Danh mục cấp 3 không thể có danh mục con | Must Have |

**Seed categories mặc định:**

```
Ăn uống
  └─ Ăn ngoài
  └─ Đi chợ / siêu thị
  └─ Đồ uống

Đi lại
  └─ Xăng
  └─ Gửi xe
  └─ Taxi / Grab

Mua sắm
  └─ Quần áo
  └─ Điện tử
  └─ Gia dụng

Sức khoẻ
  └─ Thuốc
  └─ Khám bệnh

Giải trí
  └─ Phim / sự kiện
  └─ Game
  └─ Du lịch

Hoá đơn & dịch vụ
  └─ Điện nước
  └─ Internet / điện thoại
  └─ Thuê nhà

Thu nhập
  └─ Lương
  └─ Thưởng
  └─ Thu nhập khác
```

---

### 6.7 Pace Line Chart (CHART)

| ID | Requirement | Priority |
|----|-------------|----------|
| CHART-01 | Biểu đồ phải hiển thị 2 đường: Budget lý tưởng (dashed) và Chi thực tế (solid) | Must Have |
| CHART-02 | Trục X: ngày trong tháng (1 đến N), trục Y: số tiền VND | Must Have |
| CHART-03 | Đường budget lý tưởng: tuyến tính từ 0 đến `budget_amount`, điểm tại ngày D = `(budget_amount / days_in_month) × D` | Must Have |
| CHART-04 | Đường chi thực tế: cumulative sum các expense transactions từ đầu tháng đến hôm nay | Must Have |
| CHART-05 | Vùng fill giữa 2 đường: xanh khi thực tế ≤ lý tưởng, đỏ khi thực tế > lý tưởng | Must Have |
| CHART-06 | Đường thực tế chỉ vẽ đến ngày hiện tại (không vẽ tương lai) | Must Have |
| CHART-07 | Khi budget bị điều chỉnh, đường lý tưởng phải phản ánh giá trị budget hiện tại | Must Have |

---

### 6.8 Dashboard & Reporting (RPT)

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-01 | Màn hình Home phải hiển thị: tổng đã chi tháng này, budget còn lại, và tiết kiệm tháng này | Must Have |
| RPT-02 | Tiết kiệm tháng = Tổng thu nhập − Tổng chi tiêu trong tháng | Must Have |
| RPT-03 | Màn hình Transactions phải hiển thị summary: tổng chi, tổng thu, tiết kiệm cho tháng đang xem | Must Have |
| RPT-04 | Người dùng phải có thể điều hướng xem dữ liệu của các tháng trước | Must Have |

---

## 7. Business Rules

| ID | Rule |
|----|------|
| BR-01 | Mỗi user có đúng 1 Monthly Budget per tháng (unique constraint: user_id + month) |
| BR-02 | Monthly Budget của tháng T phải tồn tại trước khi tạo expense transaction có date thuộc tháng T |
| BR-03 | Income transaction không được liên kết với Monthly Budget hoặc Custom Budget |
| BR-04 | Custom Budget không có time constraint — tồn tại cho đến khi người dùng xóa hoặc deactivate |
| BR-05 | Budget Adjustment lưu delta (positive = tăng, negative = giảm); `MonthlyBudget.amount` luôn phản ánh tổng hiện tại |
| BR-06 | Không được xóa danh mục đang được dùng bởi ít nhất 1 giao dịch |
| BR-07 | Không được xóa danh mục khi còn danh mục con |
| BR-08 | Chỉ leaf node (danh mục không có con) mới được gán cho giao dịch |
| BR-09 | Danh mục tối đa 3 cấp; danh mục cấp 3 không thể có con |
| BR-10 | Số tiền giao dịch phải là số nguyên dương (> 0), không có giá trị âm hoặc thập phân |
| BR-11 | Budget Config change không ảnh hưởng retroactively đến Monthly Budget đã tồn tại |
| BR-12 | Một expense transaction có thể thuộc 0, 1, hoặc nhiều Custom Budget đồng thời |
| BR-13 | Mỗi user có đúng 1 Budget Config record (tạo tự động khi user đăng ký lần đầu) |
| BR-14 | Seed categories được tạo tự động cho user mới, có thể sửa/xóa/thêm tùy ý sau đó |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-P01 | Thời gian phản hồi API cho các thao tác thông thường (CRUD) < 500ms |
| NFR-P02 | Pace Line Chart phải render trong < 1 giây với tối đa 31 điểm dữ liệu |
| NFR-P03 | Danh sách giao dịch tháng phải load trong < 1 giây |

### 8.2 Security

| ID | Requirement |
|----|-------------|
| NFR-S01 | Mọi API endpoint phải xác thực session trước khi xử lý |
| NFR-S02 | User A không được đọc hoặc chỉnh sửa dữ liệu của User B |
| NFR-S03 | SQL queries phải dùng parameterized statements, không concatenate string |
| NFR-S04 | Session cookie phải có httpOnly và Secure flag |

### 8.3 Usability

| ID | Requirement |
|----|-------------|
| NFR-U01 | Giao diện phải hoạt động tốt trên iPhone (375px – 430px viewport width) |
| NFR-U02 | Giao diện phải responsive trên desktop (1280px+) |
| NFR-U03 | Tất cả số tiền phải hiển thị định dạng có dấu phân cách hàng nghìn (VD: 1.500.000 ₫) |
| NFR-U04 | Form nhập giao dịch phải tự focus vào field số tiền khi mở app |

### 8.4 Reliability

| ID | Requirement |
|----|-------------|
| NFR-R01 | Ứng dụng chạy trên Cloudflare Pages (edge network), uptime theo SLA của Cloudflare |
| NFR-R02 | Dữ liệu lưu trên Cloudflare D1 (SQLite), có backup tự động theo chính sách D1 |

### 8.5 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-M01 | Schema migration phải dùng Wrangler migrations, không chỉnh sửa trực tiếp database |
| NFR-M02 | Mọi thay đổi schema phải có migration file tương ứng |

---

## 9. Data Requirements

### 9.1 Entity Relationship Overview

```
User ─────────┬──── BudgetConfig (1:1)
              ├──── Category (1:N)
              ├──── MonthlyBudget (1:N, unique per month)
              │         └──── BudgetAdjustment (1:N)
              ├──── CustomBudget (1:N)
              └──── Transaction (1:N)
                        ├──── Category (N:1)
                        ├──── MonthlyBudget (N:1, nullable for income)
                        └──── CustomBudget (N:M via TransactionCustomBudget)
```

### 9.2 Data Dictionary

#### User
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | PK | Managed by better-auth |
| email | TEXT | NOT NULL, UNIQUE | Email GitHub |
| name | TEXT | | Display name |
| created_at | DATETIME | NOT NULL | |

#### Category
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| name | TEXT | NOT NULL | |
| parent_id | INTEGER | FK → Category.id, nullable | Null nếu level 1 |
| level | INTEGER | NOT NULL, CHECK (1-3) | |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Thứ tự hiển thị |
| created_at | DATETIME | NOT NULL | |

#### Transaction
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| amount | INTEGER | NOT NULL, CHECK (> 0) | VND, số nguyên dương |
| type | TEXT | NOT NULL, CHECK ('expense','income') | |
| category_id | INTEGER | NOT NULL, FK → Category.id | |
| note | TEXT | nullable | |
| date | TEXT | NOT NULL | Format YYYY-MM-DD |
| monthly_budget_id | INTEGER | FK → MonthlyBudget.id, nullable | Null cho income |
| created_at | DATETIME | NOT NULL | |

#### TransactionCustomBudget
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| transaction_id | INTEGER | NOT NULL, FK → Transaction.id | |
| custom_budget_id | INTEGER | NOT NULL, FK → CustomBudget.id | |
| PRIMARY KEY | | (transaction_id, custom_budget_id) | |

#### MonthlyBudget
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| month | TEXT | NOT NULL | Format YYYY-MM |
| amount | INTEGER | NOT NULL, CHECK (> 0) | Giá trị hiện tại sau adjustments |
| created_at | DATETIME | NOT NULL | |
| UNIQUE | | (user_id, month) | |

#### BudgetAdjustment
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| monthly_budget_id | INTEGER | NOT NULL, FK → MonthlyBudget.id | |
| delta | INTEGER | NOT NULL | Dương = tăng, âm = giảm |
| note | TEXT | nullable | Lý do điều chỉnh |
| created_at | DATETIME | NOT NULL | |

#### CustomBudget
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, FK → User.id | |
| name | TEXT | NOT NULL | |
| amount | INTEGER | NOT NULL, CHECK (> 0) | Số tiền mục tiêu |
| is_active | INTEGER | NOT NULL, DEFAULT 1 | 1 = active, 0 = inactive |
| created_at | DATETIME | NOT NULL | |

#### BudgetConfig
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | TEXT | NOT NULL, UNIQUE, FK → User.id | 1 row per user |
| default_monthly_amount | INTEGER | NOT NULL, CHECK (> 0) | Giá trị seed tháng tới |
| updated_at | DATETIME | NOT NULL | |

---

## 10. User Interface Requirements

### 10.1 Navigation Structure

```
App (authenticated)
├── Tab 1: Home
│   ├── Status Card (budget pace summary)
│   └── Log Transaction Form
├── Tab 2: Transactions
│   ├── Month Navigator
│   ├── Summary Bar (chi / thu / tiết kiệm)
│   └── Transaction Feed (grouped by date)
├── Tab 3: Budgets
│   ├── Monthly Budget Section
│   │   ├── Pace Line Chart
│   │   ├── Adjust Budget Action
│   │   └── Adjustment History (accordion)
│   └── Custom Budgets Section
│       ├── Budget Cards (progress + toggle)
│       └── Create Custom Budget (FAB)
└── Tab 4: Settings
    ├── Categories (tree view, 3 levels)
    ├── Budget Config (default monthly amount)
    └── Account (profile + sign out)
```

### 10.2 Home Screen — Log Transaction Form

**Field order và behavior:**

| # | Field | Type | Required | Notes |
|---|-------|------|----------|-------|
| 1 | Số tiền | Number input | Yes | Auto-focus khi vào tab; tự format dấu phân cách |
| 2 | Loại | Segmented control | Yes | Chi tiêu / Thu nhập; default Chi tiêu |
| 3 | Danh mục | Bottom sheet picker | Yes | Tree 3 level; chỉ chọn leaf node |
| 4 | Ghi chú | Text input | No | Placeholder "Ghi chú..." |
| 5 | Ngày | Date picker | Yes | Default hôm nay |
| 6 | Custom budgets | Multi-select chips | No | Chỉ hiển thị khi loại = Chi tiêu; chỉ show active budgets |
| 7 | Nút Lưu | Button | — | Submit form |

**Post-submit behavior:** Reset số tiền và custom budgets; giữ nguyên loại, danh mục, và ngày; hiển thị toast "Đã lưu ✓"; refresh status card.

### 10.3 Status Card (Home)

Hiển thị theo thứ tự:
1. Label tháng: "Tháng 5/2026 · còn N ngày"
2. Progress: "Đã chi X.XXX.XXX ₫ / Y.YYY.YYY ₫"
3. Mini pace bar: 2 lớp (budget lý tưởng đến hôm nay vs thực tế)
4. Tiết kiệm: "Tiết kiệm: +Z.ZZZ.ZZZ ₫" (xanh nếu dương, đỏ nếu âm)

### 10.4 Design System

Tuân thủ `DESIGN.md`:
- Color tokens (không inline hex)
- Typography: SF Pro Display/Text, body 17px
- Spacing tokens
- Mobile-first, breakpoint collapse strategy

---

## 11. Process Flows

Sequence diagrams chi tiết được mô tả trong [`FLOWS.md`](./FLOWS.md).

| Flow | Diagram |
|------|---------|
| Đăng nhập GitHub OAuth | FLOWS.md #1 |
| Log giao dịch chi tiêu | FLOWS.md #2 |
| Log thu nhập | FLOWS.md #3 |
| Tạo Monthly Budget thủ công | FLOWS.md #4 |
| Chỉnh sửa Monthly Budget | FLOWS.md #5 |
| Tạo Custom Budget | FLOWS.md #6 |
| Toggle Custom Budget active/inactive | FLOWS.md #7 |
| Thêm danh mục | FLOWS.md #8 |
| Xóa danh mục | FLOWS.md #9 |
| Cập nhật Budget Config | FLOWS.md #10 |

---

## 12. Assumptions & Constraints

### 12.1 Assumptions

| ID | Assumption |
|----|------------|
| A-01 | Người dùng có tài khoản GitHub để đăng nhập |
| A-02 | Tất cả giao dịch đều được nhập thủ công, không có tích hợp ngân hàng |
| A-03 | Chỉ sử dụng VND, không cần đa tiền tệ |
| A-04 | Người dùng tự chủ động tạo Monthly Budget trước khi nhập giao dịch của tháng mới |
| A-05 | Số lượng giao dịch mỗi tháng ở mức cá nhân (< 500 giao dịch/tháng) |

### 12.2 Constraints

| ID | Constraint |
|----|------------|
| C-01 | Phải chạy trên Cloudflare Pages + D1, không dùng server riêng |
| C-02 | Database là SQLite (D1), không phải PostgreSQL/MySQL |
| C-03 | Framework là Next.js App Router + TypeScript, không thay đổi |
| C-04 | Không có offline mode |

### 12.3 Dependencies

| ID | Dependency | Impact if Unavailable |
|----|------------|----------------------|
| D-01 | GitHub OAuth | Không thể đăng nhập |
| D-02 | Cloudflare D1 | Không thể lưu/đọc dữ liệu |
| D-03 | Cloudflare Pages | App không thể deploy |
| D-04 | better-auth | Toàn bộ auth flow bị ảnh hưởng |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Monthly Budget | Ngân sách được tạo cho một tháng cụ thể. Mỗi user chỉ có 1 budget/tháng. |
| Custom Budget | Ngân sách tùy chỉnh không giới hạn thời gian, dùng cho dự án hoặc mục đích cụ thể (VD: "Trip Đà Lạt"). |
| Budget Adjustment | Một lần thay đổi giá trị Monthly Budget, lưu lại delta và ghi chú để tạo audit trail. |
| Budget Config | Cài đặt lưu giá trị ngân sách mặc định, chỉ dùng để seed Monthly Budget tháng tới. |
| Pace Line | Biểu đồ so sánh chi tiêu tích lũy thực tế với đường ngân sách lý tưởng (linear). |
| Pace | Tốc độ chi tiêu. "Đúng pace" = đang tiêu đúng tỷ lệ so với ngân sách; "Vượt pace" = tiêu nhanh hơn kế hoạch. |
| Leaf Node | Danh mục không có danh mục con. Chỉ leaf node mới được gán cho giao dịch. |
| Seed Data | Dữ liệu mặc định được tạo tự động khi user đăng ký lần đầu (categories, budget config). |
| Delta | Giá trị thay đổi trong Budget Adjustment. Dương (+) = tăng ngân sách, âm (−) = giảm ngân sách. |
| Cumulative Sum | Tổng tích lũy chi tiêu từ ngày 1 đến ngày D trong tháng, dùng để vẽ đường thực tế trên Pace Line chart. |
