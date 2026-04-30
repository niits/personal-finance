# API Caching Strategy

## Tổng quan

App dùng hai tầng cache kết hợp:

1. **HTTP `Cache-Control` headers** — browser tự cache response, không cần gọi lại server
2. **SWR (stale-while-revalidate)** — in-memory cache phía client, deduplicate request và invalidate khi có mutation

## HTTP Cache-Control

### Categories

```
Cache-Control: private, max-age=3600, stale-while-revalidate=300
```

- `private` — chỉ browser local cache, Cloudflare CDN không cache (vì data theo từng user)
- `max-age=3600` — dùng cache tối đa 1 giờ
- `stale-while-revalidate=300` — sau 1 giờ, phục vụ data cũ ngay lập tức và fetch mới ở background trong vòng 5 phút tiếp theo

### Transactions

Phân biệt tháng hiện tại và tháng cũ:

| Trường hợp | Cache-Control |
|---|---|
| Tháng hiện tại | `private, max-age=30, stale-while-revalidate=120` |
| Tháng cũ (bất biến) | `private, max-age=86400` |

Tháng cũ được coi là **immutable** — transaction không thể bị sửa, nên cache 24 giờ an toàn.

### Dashboard

Tương tự transactions:

| Trường hợp | Cache-Control |
|---|---|
| Tháng hiện tại | `private, max-age=60, stale-while-revalidate=300` |
| Tháng cũ | `private, max-age=86400` |

## SWR (Client-side cache)

Dùng cho `/api/categories` vì đây là data được fetch ở nhiều nơi nhất:
- `CategoriesPage` — hiển thị và quản lý danh mục
- `TransactionForm` — chọn danh mục khi thêm giao dịch

### Cache key

```ts
const CATS_KEY = "/api/categories"
```

Cả hai component dùng cùng key → share một cache entry → chỉ một network request.

### Invalidation

Sau mọi mutation (thêm danh mục, seed), gọi:

```ts
mutate("/api/categories")
```

SWR broadcast đến tất cả component đang subscribe key đó — cả hai nơi dùng categories đều nhận data mới mà không cần coordination.

### Conditional fetching trong TransactionForm

```ts
useSWR(open ? "/api/categories" : null, fetcher)
```

Truyền `null` làm key khi form chưa mở → SWR không fetch. Khi form mở lần đầu, nếu cache còn fresh từ `CategoriesPage` thì trả về ngay, không tốn network.

## Seed categories

API `POST /api/categories/seed` gọi `seedNewUser()` cho user hiện tại.  
Hàm dùng `INSERT OR IGNORE` nên idempotent — gọi nhiều lần không sinh data trùng.

Nút "Tạo danh mục mẫu" chỉ hiện khi `cats.length === 0`. Sau khi seed, `mutate(CATS_KEY)` invalidate cache để hiển thị danh mục mới ngay lập tức.
