import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test("loads core interactive controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#hero-cat")).toBeVisible();
  await expect(page.locator("#fortune-btn")).toBeVisible();
  await expect(page.locator("#laser-btn")).toBeVisible();
  await expect(page.locator("#chaos-btn")).toBeVisible();
});
