import { test as base, expect } from "@playwright/test";

// Extend base test with an `authedPage` fixture that signs in via the
// test-signin page before each test.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto("/test-signin");
    // Wait until the app redirects to the dashboard (sign-in complete).
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await use(page);
  },
});

export { expect };
