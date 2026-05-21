import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

// PR #73/#76/#83/#86: statistics page render, empty state, forecast chart
test.describe("Statistics — page render", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("shows Phân tích chi tiêu heading", async ({ page }) => {
    await page.goto("/statistics");
    await expect(page.getByText("Phân tích chi tiêu")).toBeVisible();
  });

  test("shows month navigation buttons", async ({ page }) => {
    await page.goto("/statistics");
    await expect(page.getByRole("button", { name: "‹" })).toBeVisible();
    await expect(page.getByRole("button", { name: "›" })).toBeVisible();
  });

  test("previous month with no transactions shows empty state", async ({ page }) => {
    await page.goto("/statistics");
    // Navigate back two months to a month with no seeded data
    await page.getByRole("button", { name: "‹" }).click();
    await page.getByRole("button", { name: "‹" }).click();
    await expect(page.getByText(/Không có giao dịch/)).toBeVisible();
  });

  test("current month shows Xem tháng hiện tại link from empty past month", async ({ page }) => {
    await page.goto("/statistics");
    await page.getByRole("button", { name: "‹" }).click();
    await page.getByRole("button", { name: "‹" }).click();
    await expect(page.getByText("Xem tháng hiện tại")).toBeVisible();
    // Clicking it navigates back to the current month
    await page.getByText("Xem tháng hiện tại").click();
    await expect(page.getByText(/Không có giao dịch/)).not.toBeVisible();
  });
});
