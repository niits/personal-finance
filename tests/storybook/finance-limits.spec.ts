import { expect, test } from "@playwright/test";

// Contract: docs/product/behavior/transactions.md, per-account reduction ceilings.
for (const scenario of [
  { story: "receive-repayment", amount: "2500001", ceiling: "2.500.000₫" },
  { story: "pay-debt", amount: "1000001", ceiling: "1.000.000₫" },
  { story: "withdraw-savings", amount: "150000001", ceiling: "150.000.000₫" },
]) {
  test(`${scenario.story} blocks values above the remaining balance`, async ({ page }) => {
    await page.goto(`/iframe.html?id=organisms-transactionform--${scenario.story}&viewMode=story`);
    const input = page.getByRole("textbox", { name: "Số tiền", exact: true });
    await input.fill(scenario.amount);
    await expect(page.getByRole("alert")).toContainText(scenario.ceiling);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    await input.fill(String(Number(scenario.amount) - 1));
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("editing a funding movement cannot invalidate related withdrawals", async ({ page }) => {
  await page.goto("/iframe.html?id=organisms-transactionform--edit-related-savings&viewMode=story");
  await page.getByRole("textbox", { name: "Số tiền", exact: true }).fill("300000");
  await expect(page.getByRole("alert")).toContainText("các giao dịch liên quan");
  await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "Số tiền", exact: true }).fill("500000");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeEnabled();
});
