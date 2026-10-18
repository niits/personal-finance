import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

// Read-only: seed "categories" and assert list renders
test.describe("Categories — list", () => {
  test.beforeAll(async () => {
    await resetTestData("categories");
  });

  test("shows seeded categories", async ({ page }) => {
    await page.goto("/account/categories");
    await expect(page.getByText("Ăn uống").first()).toBeVisible();
    await page.getByRole("button", { name: /Thu nhập/ }).click();
    await expect(page.getByText("Lương").first()).toBeVisible();
  });

  test("returns to the settings main screen", async ({ page }) => {
    await page.goto("/account/categories");

    await page.getByRole("link", { name: "Cài đặt" }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible();
  });
});

// Separate state for empty-state check
test.describe("Categories — empty state", () => {
  test.beforeAll(async () => {
    await resetTestData("minimal");
  });

  test("shows empty state when no categories exist", async ({ page }) => {
    await page.goto("/account/categories");
    await expect(page.getByRole("button", { name: "Thêm", exact: true })).toBeVisible();
    await expect(page.getByText("Ăn uống")).not.toBeVisible();
  });
});

// Mutating: each test gets a clean "categories" seed
test.describe("Categories — create", () => {
  test.beforeEach(async () => {
    await resetTestData("categories");
  });

  test("creates a new expense category", async ({ page }) => {
    await page.goto("/account/categories");
    await page.getByRole("button", { name: "Thêm", exact: true }).click();

    await page.getByRole("textbox", { name: "Tên danh mục" }).fill("Sức khỏe");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Sức khỏe").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Categories — AI tree organization", () => {
  test.beforeEach(async () => {
    await resetTestData("categories");
  });

  test("retries analysis, reviews full paths, blocks a stale apply, and announces success", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 });
    let previews = 0;
    let applies = 0;
    const proposal = {
      snapshot: "a".repeat(64),
      nodes: [{ id: 1, parent_id: null, sort_order: 1, reason: "Place this category after the housing group." }],
      changes: [{
        id: 1, name: "Nhà cửa và các khoản sinh hoạt định kỳ",
        before: "Nhà cửa và các khoản sinh hoạt định kỳ · Vị trí 1",
        after: "Nhà cửa và các khoản sinh hoạt định kỳ · Vị trí 2",
        reason: "Đặt nhóm nhà ở sau nhóm chi tiêu thường xuyên.", parent_id: null, level: 1, sort_order: 1,
      }],
    };
    await page.route("**/api/categories/organize", async (route) => {
      previews++;
      await route.fulfill({
        status: previews === 1 ? 502 : 200,
        json: previews === 1 ? { error: "Không thể đề xuất cây danh mục. Vui lòng thử lại." } : proposal,
      });
    });
    await page.route("**/api/categories/organize/apply", async (route) => {
      applies++;
      expect(route.request().postDataJSON()).toEqual({ snapshot: proposal.snapshot, nodes: proposal.nodes });
      await route.fulfill({
        status: applies === 1 ? 409 : 200,
        json: applies === 1 ? { error: "Danh mục đã thay đổi. Vui lòng đóng và tạo đề xuất mới." } : { updated_categories: 1 },
      });
    });

    await page.goto("/account/categories");
    const organizeButton = page.getByRole("button", { name: "Sắp xếp lại cây danh mục", exact: true });
    await organizeButton.click();
    await expect(page.getByRole("region", { name: "Sắp xếp cây danh mục" }).getByRole("alert")).toHaveText("Không thể đề xuất cây danh mục. Vui lòng thử lại.");
    await organizeButton.click();
    await expect(page.getByRole("heading", { name: "Xem lại cây danh mục" })).toBeVisible();
    await expect(page.getByText(`Đề xuất: ${proposal.changes[0].after}`, { exact: true })).toBeVisible();
    expect(applies).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const applyButton = page.getByRole("button", { name: "Áp dụng cây danh mục", exact: true });
    await applyButton.click();
    await expect(applyButton).toBeDisabled();
    await expect(page.getByRole("region", { name: "Sắp xếp cây danh mục" }).getByRole("alert")).toContainText("Danh mục đã thay đổi");
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await organizeButton.click();
    await applyButton.click();
    await expect(page.getByRole("region", { name: "Sắp xếp cây danh mục" }).getByRole("status")).toHaveText("Đã sắp xếp lại 1 danh mục.");
    await expect(page.getByRole("heading", { name: "Xem lại cây danh mục" })).not.toBeVisible();
  });

  test("shows a no-change proposal and closes it without applying", async ({ page }) => {
    let applies = 0;
    await page.route("**/api/categories/organize", (route) => route.fulfill({ json: { snapshot: "a".repeat(64), nodes: [], changes: [] } }));
    await page.route("**/api/categories/organize/apply", (route) => {
      applies++;
      return route.fulfill({ json: { updated_categories: 0 } });
    });
    await page.goto("/account/categories");
    await page.getByRole("button", { name: "Sắp xếp lại cây danh mục", exact: true }).click();
    await expect(page.getByRole("region", { name: "Sắp xếp cây danh mục" }).getByRole("status")).toContainText("Không có thay đổi được đề xuất");
    await expect(page.getByRole("button", { name: "Áp dụng cây danh mục", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    expect(applies).toBe(0);
  });
});
