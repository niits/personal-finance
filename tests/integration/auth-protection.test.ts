/**
 * Comprehensive auth protection test — every protected API endpoint must return
 * 401 when called without a valid session, and 200/2xx when called with one.
 *
 * This prevents auth regressions where a new route is added but its
 * requireSession() guard is accidentally omitted.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import {
  applyMigrations,
  seedUser,
  createTestSession,
  seedCategory,
  seedMonthlyBudget,
  seedCustomBudget,
  authHeaders,
} from "./helpers";

let cookie: string;
let userId: string;
let categoryId: number;
let budgetId: number;
let customBudgetId: number;
let transactionId: number;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser({ id: "auth-prot-user", email: "authprot@example.com" });
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Ăn uống", null, 1);
  const budget = await seedMonthlyBudget(userId, "2026-05", 10_000_000);
  budgetId = budget.id;
  customBudgetId = await seedCustomBudget(userId, "Ăn ngoài", 2_000_000);

  // Create a transaction to test PATCH/DELETE /:id
  const res = await SELF.fetch("http://localhost/api/transactions", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({
      amount: 50_000,
      type: "expense",
      category_id: categoryId,
      date: "2026-05-10",
    }),
  });
  const body = await res.json<{ transaction: { id: number } }>();
  transactionId = body.transaction.id;
});

// ─── Helper ────────────────────────────────────────────────────────────────

async function expect401(method: string, path: string, body?: unknown) {
  const res = await SELF.fetch(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  expect(res.status, `${method} ${path} should return 401 without auth`).toBe(401);
}

async function expect2xx(method: string, path: string, body?: unknown) {
  const res = await SELF.fetch(`http://localhost${path}`, {
    method,
    headers: authHeaders(cookie),
    body: body ? JSON.stringify(body) : undefined,
  });
  expect(res.status, `${method} ${path} should succeed with auth`).toBeGreaterThanOrEqual(200);
  expect(res.status, `${method} ${path} should succeed with auth`).toBeLessThan(300);
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

describe("GET /api/dashboard", () => {
  it("returns 401 without auth", () => expect401("GET", "/api/dashboard"));
  it("returns 200 with auth", () => expect2xx("GET", "/api/dashboard?month=2026-05"));
});

// ─── Transactions ───────────────────────────────────────────────────────────

describe("GET /api/transactions", () => {
  it("returns 401 without auth", () => expect401("GET", "/api/transactions"));
  it("returns 200 with auth", () => expect2xx("GET", "/api/transactions?month=2026-05"));
});

describe("POST /api/transactions", () => {
  it("returns 401 without auth", () =>
    expect401("POST", "/api/transactions", {
      amount: 10_000,
      type: "expense",
      category_id: categoryId,
      date: "2026-05-10",
    }));
});

describe("PATCH /api/transactions/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 20_000 }),
    });
    expect(res.status).toBe(401);
  });
  it("returns 2xx with auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 20_000 }),
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });
});

describe("DELETE /api/transactions/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/transactions/${transactionId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});

// ─── Categories ─────────────────────────────────────────────────────────────

describe("GET /api/categories", () => {
  it("returns 401 without auth", () => expect401("GET", "/api/categories"));
  it("returns 200 with auth", () => expect2xx("GET", "/api/categories"));
});

describe("POST /api/categories", () => {
  it("returns 401 without auth", () =>
    expect401("POST", "/api/categories", { name: "Test", level: 1 }));
  it("returns 2xx with auth", () =>
    expect2xx("POST", "/api/categories", { name: "Chi tiêu khác", level: 1 }));
});

describe("PATCH /api/categories/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/categories/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/categories/${categoryId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});

// ─── Monthly Budgets ────────────────────────────────────────────────────────

describe("GET /api/monthly-budgets", () => {
  it("returns 401 without auth", () => expect401("GET", "/api/monthly-budgets"));
  it("returns 200 with auth", () => expect2xx("GET", "/api/monthly-budgets"));
});

describe("POST /api/monthly-budgets", () => {
  it("returns 401 without auth", () =>
    expect401("POST", "/api/monthly-budgets", { month: "2026-06", amount: 5_000_000 }));
});

describe("PATCH /api/monthly-budgets/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/monthly-budgets/${budgetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 8_000_000 }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Custom Budgets ─────────────────────────────────────────────────────────

describe("GET /api/custom-budgets", () => {
  it("returns 401 without auth", () => expect401("GET", "/api/custom-budgets"));
  it("returns 200 with auth", () => expect2xx("GET", "/api/custom-budgets"));
});

describe("POST /api/custom-budgets", () => {
  it("returns 401 without auth", () =>
    expect401("POST", "/api/custom-budgets", { name: "Cà phê", amount: 500_000 }));
});

describe("PATCH /api/custom-budgets/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/custom-budgets/${customBudgetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 600_000 }),
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/custom-budgets/:id", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/custom-budgets/${customBudgetId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});

// ─── Budget Config ───────────────────────────────────────────────────────────

describe("GET /api/budget-config", () => {
  it("returns 401 without auth", () => expect401("GET", "/api/budget-config"));
  it("returns 200 with auth", () => expect2xx("GET", "/api/budget-config"));
});

describe("PUT /api/budget-config", () => {
  it("returns 401 without auth", () =>
    expect401("PUT", "/api/budget-config", { default_amount: 5_000_000 }));
});

// ─── Pace Line ───────────────────────────────────────────────────────────────

describe("GET /api/pace-line", () => {
  it("returns 401 without auth", () => expect401("GET", "/api/pace-line"));
  it("returns 200 with auth", () => expect2xx("GET", "/api/pace-line?month=2026-05"));
});

// ─── Data isolation — user A cannot access user B's resources ────────────────

describe("User isolation", () => {
  let userBCookie: string;

  beforeAll(async () => {
    const userBId = await seedUser({ id: "user-b-isolation", email: "userb@example.com" });
    userBCookie = await createTestSession(userBId);
  });

  it("user B cannot PATCH user A's transaction", async () => {
    const res = await SELF.fetch(`http://localhost/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: authHeaders(userBCookie),
      body: JSON.stringify({ amount: 999_999 }),
    });
    expect(res.status).toBe(404);
  });

  it("user B cannot DELETE user A's transaction", async () => {
    const res = await SELF.fetch(`http://localhost/api/transactions/${transactionId}`, {
      method: "DELETE",
      headers: { Cookie: userBCookie },
    });
    expect(res.status).toBe(404);
  });

  it("user B cannot PATCH user A's category", async () => {
    const res = await SELF.fetch(`http://localhost/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: authHeaders(userBCookie),
      body: JSON.stringify({ name: "Hijacked" }),
    });
    expect(res.status).toBe(404);
  });

  it("user B cannot PATCH user A's monthly budget", async () => {
    const res = await SELF.fetch(`http://localhost/api/monthly-budgets/${budgetId}`, {
      method: "PATCH",
      headers: authHeaders(userBCookie),
      body: JSON.stringify({ amount: 1 }),
    });
    expect(res.status).toBe(404);
  });

  it("user B cannot DELETE user A's custom budget", async () => {
    const res = await SELF.fetch(`http://localhost/api/custom-budgets/${customBudgetId}`, {
      method: "DELETE",
      headers: { Cookie: userBCookie },
    });
    expect(res.status).toBe(404);
  });

  it("user B gets empty transactions list (not user A's)", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions?month=2026-05", {
      headers: { Cookie: userBCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ transactions: unknown[] }>();
    expect(body.transactions).toHaveLength(0);
  });
});

// ─── Expired session ─────────────────────────────────────────────────────────

describe("Expired session", () => {
  it("returns 401 for an expired session token", async () => {
    const { env } = await import("cloudflare:test");
    const expiredToken = "expired-token-auth-prot";
    const now = Math.floor(Date.now() / 1000);
    const pastExpiry = now - 60;
    await env.DB.prepare(
      "INSERT OR IGNORE INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind("session-expired-prot", expiredToken, userId, pastExpiry, now - 120, now - 120)
      .run();

    const res = await SELF.fetch("http://localhost/api/dashboard", {
      headers: { Cookie: `better-auth.session_token=${expiredToken}` },
    });
    expect(res.status).toBe(401);
  });
});
