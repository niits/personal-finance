# Testing Strategy

## Overview

Two layers of automated testing:

| Layer | Type | Tool | Scope |
|-------|------|------|-------|
| 1 | Unit | Vitest (Node) | Pure business logic, calculations, validators |
| 2 | Integration | Vitest + `@cloudflare/vitest-pool-workers` | API routes with real D1 binding |

E2E (Playwright) is out of scope for now.

---

## Layer 1 — Unit Tests

**Runner:** Vitest in Node environment (no Workers runtime needed)

**What to test:**

| Module | Cases |
|--------|-------|
| Pace line calculation | Budget ideal line at any day; cumulative sum; over/under pace detection |
| VND formatter | `1500000` → `1.500.000 ₫`; zero; large numbers |
| Date helpers | Days in month (28/29/30/31); month string `YYYY-MM` from Date |
| Business rule validators | Amount > 0; category level ≤ 3; leaf-node check; delta ≠ 0 |
| Savings calculation | `income - expense`; negative result; zero income |

**File location:** `src/__tests__/unit/`

**Example — pace line:**
```ts
// src/__tests__/unit/pace-line.test.ts
import { describe, it, expect } from "vitest";
import { idealBudgetAtDay, isOverPace } from "@/lib/pace-line";

describe("idealBudgetAtDay", () => {
  it("returns 0 at day 0", () => {
    expect(idealBudgetAtDay({ budget: 3_000_000, daysInMonth: 30, day: 0 })).toBe(0);
  });
  it("returns full budget at last day", () => {
    expect(idealBudgetAtDay({ budget: 3_000_000, daysInMonth: 30, day: 30 })).toBe(3_000_000);
  });
  it("returns proportional value mid-month", () => {
    expect(idealBudgetAtDay({ budget: 3_000_000, daysInMonth: 30, day: 15 })).toBe(1_500_000);
  });
});

describe("isOverPace", () => {
  it("returns false when actual < ideal", () => {
    expect(isOverPace({ actual: 800_000, ideal: 1_000_000 })).toBe(false);
  });
  it("returns true when actual > ideal", () => {
    expect(isOverPace({ actual: 1_200_000, ideal: 1_000_000 })).toBe(true);
  });
});
```

---

## Layer 2 — Integration Tests

**Runner:** Vitest + `@cloudflare/vitest-pool-workers`

Tests run inside the actual Workers runtime with an in-memory D1 instance. Migrations are applied before each test file.

**What to test:**

| API | Key cases |
|-----|-----------|
| `POST /api/transactions` | Happy path expense; happy path income; missing monthly budget → 400; invalid amount → 400; auto-links monthly_budget_id |
| `POST /api/monthly-budgets` | Creates successfully; duplicate month → 409 |
| `PATCH /api/monthly-budgets/:id` | Updates amount; creates BudgetAdjustment row; delta = 0 → 400 |
| `POST /api/custom-budgets` | Creates with is_active = true |
| `PATCH /api/custom-budgets/:id` | Toggle active/inactive |
| `DELETE /api/categories/:id` | No transactions → 200; has transactions → 409; has children → 409 |
| `POST /api/categories` | Level 1, 2, 3 valid; level 4 → 400 |

**File location:** `src/__tests__/integration/`

**Setup pattern:**

```ts
// src/__tests__/integration/helpers.ts
import { env } from "cloudflare:test";

export async function applyMigrations() {
  // apply each migration file in order against env.DB
}

export async function seedUser() {
  await env.DB.prepare(
    "INSERT INTO user (id, email, name) VALUES (?, ?, ?)"
  ).bind("user-1", "test@example.com", "Test User").run();
  return "user-1";
}

export async function seedMonthlyBudget(userId: string, month: string, amount: number) {
  const result = await env.DB.prepare(
    "INSERT INTO monthly_budget (user_id, month, amount, created_at) VALUES (?, ?, ?, datetime('now')) RETURNING *"
  ).bind(userId, month, amount).first();
  return result;
}
```

```ts
// src/__tests__/integration/transactions.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, seedUser, seedMonthlyBudget } from "./helpers";

beforeAll(async () => {
  await applyMigrations();
});

describe("POST /api/transactions", () => {
  it("creates expense and links to monthly budget", async () => {
    const userId = await seedUser();
    await seedMonthlyBudget(userId, "2026-05", 5_000_000);

    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 150_000,
        type: "expense",
        category_id: 1,
        date: "2026-05-10",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction.monthly_budget_id).toBeDefined();
  });

  it("returns 400 when monthly budget does not exist for transaction date", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 100_000,
        type: "expense",
        category_id: 1,
        date: "2026-06-01",  // no budget for June
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/budget/i);
  });
});
```

---

## Configuration Files

### `vitest.config.ts` (integration — Workers pool)

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["src/__tests__/integration/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          d1Databases: ["DB"],  // in-memory D1 for tests
        },
      },
    },
  },
});
```

### `vitest.unit.config.ts` (unit — Node)

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/__tests__/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

### `package.json` scripts

```json
{
  "scripts": {
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "test:integration": "vitest run --config vitest.config.ts",
    "test": "npm run test:unit && npm run test:integration"
  }
}
```

---

## Install

```bash
npm install -D vitest @cloudflare/vitest-pool-workers
```

---

## Isolation Strategy

- Each integration test file gets a **fresh in-memory D1** — no state leaks between files.
- `beforeAll` in each file applies all migrations from `migrations/` in order.
- Unit tests have zero external dependencies — run offline, always fast.

---

## What NOT to Test

- Auth flow (better-auth) — tested by the library itself
- UI rendering — covered manually on device
- Pace line chart rendering — covered by unit tests on the calculation logic; chart library rendering is not our code
