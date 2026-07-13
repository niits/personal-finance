import { test, expect, type Page } from "@playwright/test";
import { resetTestData } from "../helpers";

// ─── Auth cookie helper ───────────────────────────────────────────────────────

async function authHeaders(page: Page): Promise<Record<string, string>> {
  await page.goto("/");
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.startsWith("better-auth"));
  return session ? { Cookie: `${session.name}=${session.value}` } : {};
}

// Read-only: reset to "full" so this is independent of file execution order
test.describe("Budget — existing budget view", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("shows monthly budget amount", async ({ page }) => {
    await page.goto("/budget");
    await expect(page.getByText("5.000.000₫").first()).toBeVisible();
  });

  test("shows adjust budget button", async ({ page }) => {
    await page.goto("/budget");
    await expect(page.getByRole("button", { name: /Điều chỉnh ngân sách/ })).toBeVisible();
  });
});

// Mutating: each test needs a "categories" seed (no budget yet so create form shows)
test.describe("Budget — monthly budget creation", () => {
  test.beforeEach(async () => {
    await resetTestData("categories");
  });

  test("shows create form when no monthly budget exists", async ({ page }) => {
    await page.goto("/budget");
    await expect(page.getByText("Chưa đặt ngân sách")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("textbox")).toBeVisible();
  });

  test("creates monthly budget with a preset amount", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: "5tr" }).click();
    await page.getByRole("button", { name: "Xác nhận ngân sách" }).click();
    await expect(page.getByText("5.000.000₫").first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Custom budget helpers ─────────────────────────────────────────────────────

async function createCustomBudget(page: Page, name: string, amount: number): Promise<number> {
  const headers = await authHeaders(page);
  const res = await page.request.post("/api/custom-budgets", { headers, data: { name, amount } });
  expect(res.status()).toBe(201);
  const { custom_budget } = await res.json() as { custom_budget: { id: number } };
  return custom_budget.id;
}

async function linkExpenseToCustomBudget(page: Page, customBudgetId: number, amount: number): Promise<void> {
  const headers = await authHeaders(page);
  const catRes = await page.request.get("/api/categories", { headers });
  const { categories } = await catRes.json() as { categories: { id: number; type: string }[] };
  const categoryId = categories.find((c) => c.type === "expense")!.id;

  const res = await page.request.post("/api/transactions", {
    headers,
    data: {
      amount,
      type: "expense",
      category_id: categoryId,
      date: new Date().toISOString().slice(0, 10),
      custom_budget_ids: [customBudgetId],
    },
  });
  expect(res.status()).toBe(201);
}

// ─── Custom budget — delete guard ──────────────────────────────────────────────

test.describe("Budget — custom budget delete guard", () => {
  test.beforeEach(async () => { await resetTestData("budget"); });

  test("delete is disabled for a custom budget with a linked transaction", async ({ page }) => {
    const id = await createCustomBudget(page, "Du lịch", 3_000_000);
    await linkExpenseToCustomBudget(page, id, 500_000);

    await page.goto("/budget");
    await expect(page.getByText("Du lịch")).toBeVisible();
    await expect(page.getByRole("button", { name: "✕" })).toBeDisabled();
  });

  test("delete succeeds for a custom budget with no linked transactions", async ({ page }) => {
    await createCustomBudget(page, "Mua sắm", 2_000_000);

    await page.goto("/budget");
    await expect(page.getByText("Mua sắm")).toBeVisible();
    const deleteBtn = page.getByRole("button", { name: "✕" });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();
    // exact: true — the empty-state placeholder text ("...du lịch, mua sắm...")
    // otherwise satisfies a case-insensitive substring match on "Mua sắm".
    await expect(page.getByText("Mua sắm", { exact: true })).not.toBeVisible();
  });
});

// ─── Custom budget — edit flow ──────────────────────────────────────────────────

test.describe("Budget — custom budget edit", () => {
  test.beforeEach(async () => { await resetTestData("budget"); });

  test("edit flow persists after reload", async ({ page }) => {
    await createCustomBudget(page, "Ăn ngoài", 1_000_000);

    await page.goto("/budget");
    await expect(page.getByText("Ăn ngoài")).toBeVisible();
    await page.getByRole("button", { name: "Sửa" }).click();

    await page.getByLabel("Tên ngân sách").fill("Ăn ngoài cuối tuần");
    await page.getByLabel("Mục tiêu").fill("2000000");
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Ăn ngoài cuối tuần")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Ăn ngoài cuối tuần")).toBeVisible();
    await expect(page.getByText("2.000.000₫", { exact: false })).toBeVisible();
  });
});

// ─── Custom budget — close button ───────────────────────────────────────────────

test.describe("Budget — close budget button", () => {
  test.beforeEach(async () => { await resetTestData("budget"); });

  test("Đóng ngân sách button is prominent and toggles state", async ({ page }) => {
    await createCustomBudget(page, "Khẩn cấp", 5_000_000);

    await page.goto("/budget");
    await expect(page.getByText("Khẩn cấp")).toBeVisible();

    await expect(page.getByRole("button", { name: "Đóng ngân sách" })).toBeVisible();
    await page.getByRole("button", { name: "Đóng ngân sách" }).click();

    await expect(page.getByRole("button", { name: "Mở lại" })).toBeVisible();
    await page.getByRole("button", { name: "Mở lại" }).click();

    await expect(page.getByRole("button", { name: "Đóng ngân sách" })).toBeVisible();
  });
});
