import { expect, test } from "@playwright/test";

async function openFreshPage(page) {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
}

test("loads page and core controls", async ({ page }) => {
  await openFreshPage(page);

  await expect(page.locator("#hero-cat")).toBeVisible();
  await expect(page.locator("#fortune-btn")).toBeVisible();
  await expect(page.locator("#laser-btn")).toBeVisible();
  await expect(page.locator("#chaos-btn")).toBeVisible();
  await expect(page.locator("#sticker-gallery")).toBeVisible();
});

test("petting cat increments treat counter", async ({ page }) => {
  await openFreshPage(page);

  const treatCount = page.locator("#treat-count");
  await expect(treatCount).toHaveText("0");

  await page.locator("#hero-cat").click();
  await expect(treatCount).toHaveText("1");
});

test("fortune button unlocks oracle sticker", async ({ page }) => {
  await openFreshPage(page);

  const oracleCard = page.locator('[data-sticker="oracle"]');
  await expect(oracleCard).toHaveClass(/locked/);

  await page.locator("#fortune-btn").click();

  await expect(page.locator("#fortune-box")).not.toHaveText("The oracle cat waits for your question.");
  await expect(oracleCard).not.toHaveClass(/locked/);
});

test("chaos toggle updates aria and body class", async ({ page }) => {
  await openFreshPage(page);

  const chaosButton = page.locator("#chaos-btn");
  await expect(chaosButton).toHaveAttribute("aria-pressed", "false");

  await chaosButton.click();

  await expect(chaosButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveClass(/chaos-mode/);
});

test("laser game starts and ends with button re-enabled", async ({ page }) => {
  await openFreshPage(page);

  const laserButton = page.locator("#laser-btn");
  const laserDot = page.locator("#laser-dot");

  await laserButton.click();
  await expect(laserDot).toBeVisible();
  await expect(laserButton).toBeDisabled();

  await expect(laserButton).toBeEnabled({ timeout: 8000 });
  await expect(page.locator("#laser-status")).toContainText(/Dot escaped|Laser mastered/);
});

test("state persists across reload via localStorage", async ({ page }) => {
  await openFreshPage(page);

  const treatCount = page.locator("#treat-count");
  await page.locator("#hero-cat").click();
  await page.locator("#hero-cat").click();
  await expect(treatCount).toHaveText("2");

  await page.reload();

  await expect(treatCount).toHaveText("2");
});

test("typing meow unlocks secret sticker", async ({ page }) => {
  await openFreshPage(page);

  const secretCard = page.locator('[data-sticker="secret"]');
  await expect(secretCard).toHaveClass(/locked/);

  await page.keyboard.type("meow");

  await expect(secretCard).not.toHaveClass(/locked/);
});
