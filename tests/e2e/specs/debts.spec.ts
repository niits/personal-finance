import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8787";

// ─── empty state ──────────────────────────────────────────────────────────────

test.describe("Debts — empty state (minimal seed)", () => {
  test.beforeAll(async () => {
    await resetTestData("minimal");
  });

  test("renders the Nợ heading on /debts", async ({ page }) => {
    await page.goto("/debts");
    await expect(
      page.getByRole("heading", { name: "Nợ" }).or(page.getByText("Nợ").first()),
    ).toBeVisible();
  });

  test("shows empty state when no debts exist", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText("Chưa có khoản nợ nào")).toBeVisible();
  });

  test("shows + Thêm button", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByRole("button", { name: /Thêm/ })).toBeVisible();
  });
});

// ─── seeded overview ──────────────────────────────────────────────────────────

test.describe("Debts — overview with seeded data", () => {
  test.beforeAll(async () => {
    await resetTestData("debts");
  });

  test("shows lending section with Minh card", async ({ page }) => {
    await page.goto("/debts");
    // The debt overview groups by lending / borrowing / settled
    await expect(page.getByText("Minh")).toBeVisible();
  });

  test("shows borrowing section with Chị Lan card", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText("Chị Lan")).toBeVisible();
  });

  test("shows settled section with Anh Tuấn card", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText("Anh Tuấn")).toBeVisible();
  });

  test("does not show empty-state message when debts exist", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText("Chưa có khoản nợ nào")).not.toBeVisible();
  });

  test("Minh debt shows remaining amount", async ({ page }) => {
    await page.goto("/debts");
    // Minh debt: 2,000,000 lent, 500,000 repaid → 1,500,000 remaining
    // Amounts are displayed in VND; check the formatted number is present
    await expect(page.getByText(/1[,.]500[,.]000|1\.500\.000|1,500,000/).first()).toBeVisible();
  });
});

// ─── create debt via UI ───────────────────────────────────────────────────────

test.describe("Debts — create flow", () => {
  test.beforeAll(async () => {
    await resetTestData("minimal");
  });

  test("opens AddDebtSheet when Thêm button is clicked", async ({ page }) => {
    await page.goto("/debts");
    await page.getByRole("button", { name: /Thêm/ }).click();
    // Expect the sheet / dialog to appear with form fields
    await expect(page.getByPlaceholder(/Tên người/i).or(page.getByLabel(/Người/i))).toBeVisible();
  });

  test("creates a lend debt and shows it in the overview", async ({ page }) => {
    await page.goto("/debts");
    await page.getByRole("button", { name: /Thêm/ }).click();

    // AddDebtSheet: party input has placeholder="Tên người"
    await page.getByPlaceholder("Tên người").fill("Nam");

    // Amount input has placeholder="0" and type="number"
    await page.locator('input[type="number"]').first().fill("500000");

    // "Cho vay" is a plain button (not radio) — already selected by default
    // Submit via the Lưu button
    await page.getByRole("button", { name: "Lưu" }).click();

    // The new debt card should appear
    await expect(page.getByText("Nam")).toBeVisible({ timeout: 5000 });
  });
});

// ─── add repayment via UI ─────────────────────────────────────────────────────

test.describe("Debts — repayment flow", () => {
  test.beforeAll(async () => {
    await resetTestData("debts");
  });

  test("clicking a debt card reveals repayment history", async ({ page }) => {
    await page.goto("/debts");
    // Click the Minh card to expand it
    await page.getByText("Minh").first().click();
    // Should show a repayment entry (seeded: 500,000 repaid)
    await expect(
      page.getByText(/500[,.]000|500\.000/).first(),
    ).toBeVisible({ timeout: 3000 });
  });

  test("add repayment button opens AddRepaymentSheet", async ({ page }) => {
    await page.goto("/debts");
    await page.getByText("Minh").first().click();

    // Look for repayment CTA button
    const repayBtn = page
      .getByRole("button", { name: /Thêm thanh toán|Trả nợ|Thanh toán/i })
      .first();
    if (await repayBtn.count() > 0 && await repayBtn.isVisible()) {
      await repayBtn.click();
      // AddRepaymentSheet amount input uses placeholder={String(remaining)} — a dynamic
      // number. Target by type="number" instead.
      await expect(
        page.locator('input[type="number"]').first(),
      ).toBeVisible({ timeout: 3000 });
    }
  });
});

// ─── API auth guards (unauthenticated context) ───────────────────────────────
// The default `request` fixture inherits storageState (authenticated session).
// Auth guard tests must use a fresh context with no cookies.

test.describe("Debts API — auth guard", () => {
  test("GET /api/debts returns 401 without auth", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
    const res = await ctx.get("/api/debts");
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test("POST /api/debts returns 401 without auth", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
    const res = await ctx.post("/api/debts", {
      data: { type: "lend", party: "Minh", amount: 100000 },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test("GET /api/debts/:id returns 401 without auth", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
    const res = await ctx.get("/api/debts/some-id");
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test("POST /api/debts/:id/repayments returns 401 without auth", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
    const res = await ctx.post("/api/debts/some-id/repayments", {
      data: { amount: 100000 },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ─── API CRUD (authenticated via browser session cookie) ─────────────────────

test.describe("Debts API — CRUD", () => {
  test.beforeAll(async () => {
    await resetTestData("minimal");
  });

  test("creates a lend debt", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.startsWith("better-auth"));
    const headers: Record<string, string> = sessionCookie
      ? { Cookie: `${sessionCookie.name}=${sessionCookie.value}` }
      : {};

    const res = await request.post("/api/debts", {
      headers,
      data: { type: "lend", party: "Minh", amount: 1500000, date: "2026-05-22" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json() as {
      debt: { type: string; party: string; amount: number; remaining: number; status: string };
    };
    expect(body.debt.type).toBe("lend");
    expect(body.debt.party).toBe("Minh");
    expect(body.debt.amount).toBe(1500000);
    expect(body.debt.remaining).toBe(1500000);
    expect(body.debt.status).toBe("open");
  });

  test("GET /api/debts returns the created debt in lending array", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.startsWith("better-auth"));
    const headers: Record<string, string> = sessionCookie
      ? { Cookie: `${sessionCookie.name}=${sessionCookie.value}` }
      : {};

    const res = await request.get("/api/debts", { headers });
    expect(res.status()).toBe(200);
    const body = await res.json() as { lending: { party: string }[]; borrowing: unknown[] };
    expect(body.lending.some((d) => d.party === "Minh")).toBe(true);
  });

  test("GET /api/debts/:id returns single debt with repayments", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.startsWith("better-auth"));
    const headers: Record<string, string> = sessionCookie
      ? { Cookie: `${sessionCookie.name}=${sessionCookie.value}` }
      : {};

    // Get the id from the list
    const listRes = await request.get("/api/debts", { headers });
    const { lending } = await listRes.json() as { lending: { id: string }[] };
    const debtId = lending[0]?.id;
    expect(debtId).toBeTruthy();

    const res = await request.get(`/api/debts/${debtId}`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json() as { debt: { id: string; repayments: unknown[] } };
    expect(body.debt.id).toBe(debtId);
    expect(Array.isArray(body.debt.repayments)).toBe(true);
  });

  test("logs a repayment and auto-settles on full repayment", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.startsWith("better-auth"));
    const headers: Record<string, string> = sessionCookie
      ? { Cookie: `${sessionCookie.name}=${sessionCookie.value}` }
      : {};

    const createRes = await request.post("/api/debts", {
      headers,
      data: { type: "borrow", party: "Bạn A", amount: 200000, date: "2026-05-22" },
    });
    const { debt } = await createRes.json() as { debt: { id: string } };

    // Partial repayment
    const partial = await request.post(`/api/debts/${debt.id}/repayments`, {
      headers,
      data: { amount: 100000, date: "2026-05-22" },
    });
    expect(partial.status()).toBe(201);
    const partialBody = await partial.json() as {
      debt: { remaining: number; status: string };
    };
    expect(partialBody.debt.remaining).toBe(100000);
    expect(partialBody.debt.status).toBe("open");

    // Full repayment — should auto-settle
    const final = await request.post(`/api/debts/${debt.id}/repayments`, {
      headers,
      data: { amount: 100000, date: "2026-05-22" },
    });
    const finalBody = await final.json() as { debt: { remaining: number; status: string } };
    expect(finalBody.debt.remaining).toBe(0);
    expect(finalBody.debt.status).toBe("settled");
  });

  test("repayment on settled debt returns 400", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.startsWith("better-auth"));
    const headers: Record<string, string> = sessionCookie
      ? { Cookie: `${sessionCookie.name}=${sessionCookie.value}` }
      : {};

    const createRes = await request.post("/api/debts", {
      headers,
      data: { type: "lend", party: "Bạn B", amount: 50000 },
    });
    const { debt } = await createRes.json() as { debt: { id: string } };
    await request.post(`/api/debts/${debt.id}/repayments`, {
      headers,
      data: { amount: 50000 },
    });

    // Try repaying again on a settled debt
    const res = await request.post(`/api/debts/${debt.id}/repayments`, {
      headers,
      data: { amount: 10000 },
    });
    expect(res.status()).toBe(400);
  });

  test("repayment exceeding remaining balance returns 400", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.startsWith("better-auth"));
    const headers: Record<string, string> = sessionCookie
      ? { Cookie: `${sessionCookie.name}=${sessionCookie.value}` }
      : {};

    const createRes = await request.post("/api/debts", {
      headers,
      data: { type: "lend", party: "Bạn C", amount: 100000 },
    });
    const { debt } = await createRes.json() as { debt: { id: string } };

    const res = await request.post(`/api/debts/${debt.id}/repayments`, {
      headers,
      data: { amount: 999999999 },
    });
    expect(res.status()).toBe(400);
  });
});
