import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

test.describe("Debts — placeholder page", () => {
  test("renders the placeholder from the Nợ tab", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText("Theo dõi nợ")).toBeVisible();
  });
});

test.describe("Debts API — auth guard", () => {
  test("GET /api/debts returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/debts");
    expect(res.status()).toBe(401);
  });

  test("POST /api/debts returns 401 without auth", async ({ request }) => {
    const res = await request.post("/api/debts", {
      data: { type: "lend", party: "Minh", amount: 100000 },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Debts API — CRUD", () => {
  test.beforeAll(async () => {
    await resetTestData("minimal");
  });

  test("creates a lend debt", async ({ page, request }) => {
    // authenticate via the browser session cookie
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
    const body = await res.json() as { debt: { type: string; party: string; amount: number; remaining: number; status: string } };
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

  test("logs a repayment and auto-settles on full repayment", async ({ page, request }) => {
    await page.goto("/");
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.startsWith("better-auth"));
    const headers: Record<string, string> = sessionCookie
      ? { Cookie: `${sessionCookie.name}=${sessionCookie.value}` }
      : {};

    // Create a small debt
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
    const partialBody = await partial.json() as { debt: { remaining: number; status: string } };
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

    // Create and fully settle a debt
    const createRes = await request.post("/api/debts", {
      headers,
      data: { type: "lend", party: "Bạn B", amount: 50000 },
    });
    const { debt } = await createRes.json() as { debt: { id: string } };
    await request.post(`/api/debts/${debt.id}/repayments`, {
      headers,
      data: { amount: 50000 },
    });

    // Try repaying again
    const res = await request.post(`/api/debts/${debt.id}/repayments`, {
      headers,
      data: { amount: 10000 },
    });
    expect(res.status()).toBe(400);
  });
});
