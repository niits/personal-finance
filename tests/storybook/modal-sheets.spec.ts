import { expect, test } from "@playwright/test";

test("Category rename remains wide, traps focus, and restores focus", async ({ page }) => {
  await page.goto("/iframe.html?id=templates-categoriestemplate--default&viewMode=story");
  await page.getByRole("button", { name: /Thao tác cho Nhà cửa/ }).click();
  const trigger = page.getByRole("button", { name: "Đổi tên", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const panel = dialog.locator("section");
  const bounds = await panel.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(375);
  expect(bounds!.width).toBeLessThanOrEqual(480);
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  await expect(page.locator("body")).toHaveCSS("position", "fixed");
  await dialog.getByRole("button", { name: "Chọn emoji" }).click();
  const option = dialog.getByRole("button", { name: "💳", exact: true }).first();
  await option.click();
  await expect(dialog.getByRole("button", { name: "Chọn emoji" })).toHaveText("💳");
  const input = dialog.getByLabel("Tên danh mục");
  await input.fill("Ăn uống");
  const save = dialog.getByRole("button", { name: "Lưu thay đổi" });
  await save.focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Chọn emoji" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Thao tác cho Nhà cửa/ })).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
});

test("New category aligns the emoji control with the name input", async ({ page }) => {
  await page.goto("/iframe.html?id=templates-categoriestemplate--create-category&viewMode=story");
  const input = page.getByLabel("Tên danh mục");
  await expect(input).toBeVisible();
  const inputBounds = await input.boundingBox();
  const emojiBounds = await page.getByRole("button", { name: "Chọn emoji" }).boundingBox();
  expect(Math.abs(inputBounds!.y - emojiBounds!.y)).toBeLessThanOrEqual(1);
});

test("Finance dialogs block mode changes and show errors inside the form", async ({ page }) => {
  await page.goto("/iframe.html?id=templates-creditcardstemplate--group-save-error&viewMode=story");
  const dialog = page.getByRole("dialog", { name: "Nhóm thẻ mới" });
  await expect(dialog.getByRole("alert")).toContainText("Không thể lưu nhóm thẻ.");
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  await expect(page.getByRole("tab", { name: "Chi thẻ", exact: true, includeHidden: true })).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thêm nhóm thẻ" })).toBeFocused();
  await page.getByRole("tab", { name: "Tiền gửi", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Finance account editing fits the available viewport above a keyboard", async ({ page }) => {
  await page.goto("/iframe.html?id=templates-creditcardstemplate--edit-finance-account&viewMode=story");
  const dialog = page.getByRole("dialog", { name: "Sửa thông tin" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Ghi chú").focus();
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport, "height", { configurable: true, value: 350 });
    Object.defineProperty(viewport, "offsetTop", { configurable: true, value: 44 });
    viewport.dispatchEvent(new Event("resize"));
  });
  await expect(dialog).toHaveCSS("height", "350px");
  await expect(dialog).toHaveCSS("top", "44px");
  const save = dialog.getByRole("button", { name: "Lưu", exact: true });
  await save.scrollIntoViewIfNeeded();
  const bounds = await save.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(44);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(394);
  await save.click();
  await expect(dialog).toHaveCount(0);
});

test("Pending sheets remain open when Escape is pressed", async ({ page }) => {
  await page.goto("/iframe.html?id=organisms-modalsheet--pending&viewMode=story");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hủy" })).toBeDisabled();
});
