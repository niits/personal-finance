import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

test.beforeAll(async () => {
  // Start with no categories — tests create from scratch
  await resetTestData("minimal");
});

test.describe("Categories — empty state", () => {
  test("shows empty state when no categories exist", async ({ page }) => {
    await page.goto("/dashboard/categories");
    await expect(page.getByText(/Chưa có danh mục|Trống/i).or(
      page.getByText(/Thêm danh mục/i)
    )).toBeVisible();
  });
});

test.describe("Categories — CRUD", () => {
  test("creates a level-1 expense category", async ({ page }) => {
    await page.goto("/dashboard/categories");

    // Open the add form
    const addBtn = page.getByRole("button", { name: /Thêm|Tạo mới|\+/i }).first();
    await addBtn.click();

    // Fill name
    const nameInput = page.locator("input[placeholder*='tên']").or(
      page.locator("input[placeholder*='Tên']").or(
        page.locator("input[type='text']").first()
      )
    );
    await nameInput.fill("Ăn uống");

    // Save
    await page.getByRole("button", { name: /Lưu|Tạo|Thêm/i }).last().click();

    await expect(page.getByText("Ăn uống")).toBeVisible();
  });

  test("creates a level-2 child category under Ăn uống", async ({ page }) => {
    await page.goto("/dashboard/categories");

    // Click Ăn uống to expand / find its add-child button
    const parentRow = page.locator("text=Ăn uống").locator("..");
    await parentRow.getByRole("button", { name: /Thêm con|Thêm danh mục con|\+/i }).click();

    const nameInput = page.locator("input[type='text']").first();
    await nameInput.fill("Cơm trưa");

    await page.getByRole("button", { name: /Lưu|Tạo/i }).last().click();

    await expect(page.getByText("Cơm trưa")).toBeVisible();
  });

  test("edits an existing category name", async ({ page }) => {
    await page.goto("/dashboard/categories");

    // Find the edit button on "Ăn uống"
    const row = page.locator("text=Ăn uống").locator("..");
    await row.getByRole("button", { name: /Sửa|Edit/i }).click();

    const nameInput = page.locator("input[type='text']").first();
    await nameInput.clear();
    await nameInput.fill("Ăn & Uống");

    await page.getByRole("button", { name: /Lưu|Cập nhật/i }).last().click();

    await expect(page.getByText("Ăn & Uống")).toBeVisible();
  });

  test("cannot delete a category that has children", async ({ page }) => {
    await page.goto("/dashboard/categories");

    // Try to delete the parent (Ăn & Uống) which has child "Cơm trưa"
    const row = page.locator("text=Ăn & Uống").locator("..");
    await row.getByRole("button", { name: /Xoá|Xóa|Delete/i }).click();

    // Confirm if there's a confirm dialog
    const confirmBtn = page.getByRole("button", { name: /Xác nhận|Xoá|OK/i }).last();
    if (await confirmBtn.isVisible()) await confirmBtn.click();

    // Error message or category still visible
    await expect(
      page.getByText(/có danh mục con|không thể xoá|lỗi/i).or(
        page.getByText("Ăn & Uống")
      )
    ).toBeVisible();
  });

  test("deletes a leaf category", async ({ page }) => {
    await page.goto("/dashboard/categories");

    // Delete "Cơm trưa" (leaf)
    const row = page.locator("text=Cơm trưa").locator("..");
    await row.getByRole("button", { name: /Xoá|Xóa|Delete/i }).click();

    const confirmBtn = page.getByRole("button", { name: /Xác nhận|Xoá/i }).last();
    if (await confirmBtn.isVisible()) await confirmBtn.click();

    await expect(page.getByText("Cơm trưa")).not.toBeVisible();
  });
});
