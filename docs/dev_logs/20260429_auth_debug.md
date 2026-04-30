# 2026-04-29 — Auth Debug: GitHub OAuth login không hoạt động trong local dev

## Môi trường

- Next.js 16 (App Router) + TypeScript
- Cloudflare Workers via `@opennextjs/cloudflare`
- Better Auth 1.6.9
- Local dev: `npm run dev:cf` → `opennextjs-cloudflare preview -- --port 8787`

---

## Vấn đề 1: `export const runtime = "edge"` làm crash route module

**Triệu chứng:** `POST /api/auth/sign-in/social` → 500. Wrangler log không có chi tiết lỗi. Next.js bundle log: `TypeError: Cannot read properties of undefined (reading 'default')` tại `interopDefault` → `loadComponentsImpl`.

**Nguyên nhân:** `export const runtime = "edge"` trong `src/app/api/auth/[...all]/route.ts` khiến Next.js load module qua một code path khác (edge runtime). Trong bundle của OpenNext/Cloudflare, code path đó fail và module trả về `undefined`. `interopDefault(undefined)` → throw.

**Fix:** Xóa `export const runtime = "edge"`. Trong Workers environment mọi route đều chạy Workers runtime mặc định, không cần khai báo thêm.

---

## Vấn đề 2: `kysely-d1` không hỗ trợ transactions → account không được tạo

**Triệu chứng:** Sau khi GitHub callback thành công, DB có bản ghi `user` nhưng bảng `account` trống. Lần đăng nhập tiếp theo trả về `error=unable_to_link_account`.

**Nguyên nhân:**
- Better Auth bọc `createOAuthUser` (tạo user + account) trong `runWithTransaction()`
- `runWithTransaction` gọi `adapter.transaction()` → Kysely gọi `driver.beginTransaction()` → `kysely-d1` throw `'Transactions are not supported yet.'`
- Vì không có real transaction, user đã được INSERT trước khi lỗi xảy ra → orphaned user
- `account` không được tạo

**Fix:** Bỏ `kysely-d1`, truyền raw D1 object thẳng vào `database`:
```ts
// TRƯỚC (lỗi):
database: { dialect: new D1Dialect({ database: cfEnv.DB }), type: "sqlite" }

// SAU (đúng):
database: cfEnv.DB
```
Better Auth tự detect D1 (`"batch" in db && "exec" in db && "prepare" in db`) và dùng `D1SqliteDialect` nội bộ với `transaction: void 0` → adapter-base patch `transaction = async (cb) => cb(adapter)` (no-op fallback, an toàn).

---

## Vấn đề 3: Schema migration thiếu cột → INSERT account bị lỗi SQLite

**Triệu chứng:** Ngay cả sau fix #2, account vẫn không được tạo. DB vẫn orphaned.

**Nguyên nhân:** Migration `0001_auth_schema.sql` được tạo từ phiên bản cũ của Better Auth. Better Auth 1.6.9 thêm 3 cột mới vào bảng `account` khi insert OAuth tokens:
- `accessTokenExpiresAt`
- `refreshTokenExpiresAt`  
- `scope`

Schema cũ không có 3 cột này → SQLite throw "table account has no column named accessTokenExpiresAt" → INSERT fail → account không được tạo.

**Fix:** Tạo migration `0002_account_tokens.sql`:
```sql
ALTER TABLE `account` ADD COLUMN `accessTokenExpiresAt` integer;
ALTER TABLE `account` ADD COLUMN `refreshTokenExpiresAt` integer;
ALTER TABLE `account` ADD COLUMN `scope` text;
```
Apply cả local (`--local`) lẫn remote (`--remote`).

---

## Tóm tắt thứ tự fix

1. Xóa `export const runtime = "edge"` khỏi auth route
2. Dùng raw `cfEnv.DB` thay vì `kysely-d1` D1Dialect
3. Chạy migration `0002_account_tokens.sql` trên local và remote DB
4. Xóa orphaned data: `DELETE FROM user; DELETE FROM session; DELETE FROM account;`

---

## Bài học

- Không dùng `export const runtime = "edge"` trong Cloudflare Workers + OpenNext — Workers runtime là default.
- `kysely-d1` không tương thích với Better Auth vì không support transactions. Dùng raw D1 object để Better Auth tự quản lý.
- Khi upgrade Better Auth, luôn kiểm tra schema migration có đủ cột không — chạy `npx @better-auth/cli generate` để so sánh.
