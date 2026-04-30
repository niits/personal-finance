# Personal Finance Tracker

Ứng dụng theo dõi thu chi cá nhân — ghi nhanh giao dịch, theo dõi ngân sách tháng qua pace line chart.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Cloudflare Workers · D1 (SQLite) · better-auth

---

## Tính năng

- Ghi thu/chi với danh mục phân cấp (tối đa 3 cấp)
- Ngân sách tháng + pace line chart (chi tiêu thực tế vs kế hoạch)
- Custom budget cho các mục tiêu riêng (trip, dự án...)
- Đăng nhập GitHub OAuth
- UI mobile-first, tối ưu cho iPhone

---

## Phát triển cục bộ

```bash
npm install
npm run dev          # Next.js dev server → http://localhost:3000
npm run dev:cf       # Cloudflare Workers local preview → http://localhost:8787
```

Tạo file `.dev.vars` với các biến môi trường:

```
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## Build & Deploy

```bash
npm run build:cf     # Build cho Cloudflare Workers (opennextjs)
npm run deploy:cf    # Build + deploy lên production
```

Deploy production tự động qua GitHub Actions khi push vào nhánh `main`.

---

## Database

```bash
# Chạy migrations cục bộ (D1 local)
wrangler d1 migrations apply personal-finance-auth

# Chạy migrations trên production
wrangler d1 migrations apply personal-finance-auth --remote --env production
```

---

## Tests

```bash
npm test               # Unit + integration
npm run test:unit      # Unit tests (Vitest / Node)
npm run test:integration  # Integration tests (Vitest / Cloudflare Workers runtime)
```

---

## Tài liệu

| File | Nội dung |
|------|----------|
| [docs/BRD.md](docs/BRD.md) | Business Requirements — yêu cầu, data model, business rules |
| [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) | Thiết kế kỹ thuật — schema, API, edge cases |
| [docs/FLOWS.md](docs/FLOWS.md) | Sequence diagrams cho các flow chính |
| [docs/TESTING.md](docs/TESTING.md) | Chiến lược test — unit và integration |
| [docs/API_CACHE.md](docs/API_CACHE.md) | Caching strategy — HTTP headers và SWR |
| [DESIGN.md](DESIGN.md) | Design system — color tokens, typography, spacing |

---

## Cấu trúc thư mục

```
src/
├── app/
│   ├── api/          # API routes (categories, transactions, dashboard...)
│   └── dashboard/    # UI pages (home, transactions, budget, categories)
├── components/       # Shared components (TransactionForm, Navbar)
└── lib/              # Business logic (validators, pace-line, auth, db, seed)
migrations/           # D1 schema migrations
docs/                 # Tài liệu dự án
```
