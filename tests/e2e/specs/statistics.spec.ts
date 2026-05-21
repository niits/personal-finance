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

  test("Xem tháng hiện tại navigates forward one month", async ({ page }) => {
    await page.goto("/statistics");
    // Go back one month — button appears because we're no longer on current month
    await page.getByRole("button", { name: "‹" }).click();
    await expect(page.getByText("Xem tháng hiện tại")).toBeVisible();
    // Clicking advances to current month — button disappears (upper bound reached)
    await page.getByText("Xem tháng hiện tại").click();
    await expect(page.getByText("Xem tháng hiện tại")).not.toBeVisible();
  });
});
