import { test, expect } from "./fixtures";

test.describe("Dashboard — authenticated flow", () => {
  test("redirects unauthenticated users to the home page", async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/^\//); // should be redirected to home
    await page.close();
  });

  test("shows the dashboard after sign-in", async ({ page }) => {
    // The fixture navigates /test-signin → /dashboard.
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("shows a month label in the header", async ({ page }) => {
    // The dashboard shows "Tháng M/YYYY" as the current budget month.
    const header = page.locator("text=/Tháng \\d+\\/\\d{4}/");
    await expect(header).toBeVisible();
  });

  test("shows Đăng xuất button in the navbar", async ({ page }) => {
    await expect(page.locator("text=Đăng xuất")).toBeVisible();
  });
});

test.describe("Dashboard — navigation", () => {
  test("can navigate to previous month and back", async ({ page }) => {
    // Grab the initial month label text.
    const monthLabel = page.locator("text=/Tháng \\d+\\/\\d{4}/").first();
    const initial = await monthLabel.textContent();

    // Click the ‹ (previous month) button.
    await page.locator("button", { hasText: "‹" }).click();
    const prev = await monthLabel.textContent();
    expect(prev).not.toBe(initial);

    // Click › (next month) to go back.
    await page.locator("button", { hasText: "›" }).click();
    expect(await monthLabel.textContent()).toBe(initial);
  });

  test("navigates to /dashboard/budget via bottom nav", async ({ page }) => {
    await page.locator("a[href='/dashboard/budget']").click();
    await expect(page).toHaveURL(/\/dashboard\/budget/);
  });

  test("navigates to /dashboard/categories via bottom nav", async ({ page }) => {
    await page.locator("a[href='/dashboard/categories']").click();
    await expect(page).toHaveURL(/\/dashboard\/categories/);
  });
});
