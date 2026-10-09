import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

// Contract: docs/features/ai-organize.md; API integrity is verified in Worker tests.
const preview = {
  new_categories: [], emoji_assignments: [], recategorizations: [], emoji_reassignments: [],
  category_snapshot: [],
  category_merges: [{ source_category_id: 902, source_category_name: "Chi phí khám chữa bệnh và chăm sóc sức khỏe định kỳ", target_category_id: 901, target_category_name: "Y tế và sức khỏe", transaction_count: 125, reason: "Hợp nhất hai danh mục cùng ý nghĩa sử dụng." }],
  category_moves: [{ category_id: 903, category_name: "Học tập và phát triển chuyên môn", parent_category_id: 904, parent_category_name: "Sinh hoạt", sort_order: 1, reason: "Sắp xếp lại nhóm chi phí." }],
};

for (const width of [375, 1280]) {
  test(`AI Organize preserves selection after retry and announces merge counts at ${width}px`, async ({ page }) => {
    await resetTestData("full");
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/api/ai/organize", (route) => route.fulfill({ json: preview }));
    let attempts = 0;
    await page.route("**/api/ai/organize/apply", async (route) => {
      const selection = route.request().postDataJSON();
      expect(selection.category_merges).toEqual(preview.category_merges);
      expect(selection.category_moves).toEqual([]);
      attempts++;
      await route.fulfill(attempts === 1
        ? { status: 500, json: { error: "Không thể áp dụng đề xuất." } }
        : { json: { merged_categories: 1, reorganized_categories: 0, created_categories: 0, emoji_updated: 0, transactions_moved: 125 } });
    });
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "AI tổ chức danh mục và giao dịch" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Xem lại đề xuất tổ chức" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/125 giao dịch sẽ được chuyển/)).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Áp dụng nhóm thay đổi cấu trúc" }).uncheck();
    await dialog.getByRole("button", { name: "Áp dụng", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "Áp dụng nhóm thay đổi cấu trúc" })).not.toBeChecked();
    await dialog.getByRole("button", { name: "Áp dụng", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("status")).toContainText("Đã hợp nhất 1 danh mục");
    await expect(page.getByRole("status")).toContainText("chuyển 125 giao dịch");
    await expect(trigger).toBeFocused();
  });
}

test("AI Organize allows retry after preview failure", async ({ page }) => {
  await resetTestData("full");
  let attempts = 0;
  await page.route("**/api/ai/organize", async (route) => {
    attempts++;
    await route.fulfill(attempts === 1
      ? { status: 502, json: { error: "Không thể tạo đề xuất. Vui lòng thử lại." } }
      : { json: preview });
  });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "AI tổ chức danh mục và giao dịch" });
  await trigger.click();
  await expect(page.getByRole("alert").filter({ hasText: "Không thể tạo đề xuất" })).toContainText("Không thể tạo đề xuất");
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Xem lại đề xuất tổ chức" })).toBeVisible();
});
