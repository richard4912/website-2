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
  await expect(page.locator("#sticker-gallery")).toBeHidden();
  await expect(page.locator("#fortune-box")).toBeHidden();
  await expect(page.locator("#laser-game")).toBeHidden();
  await page.locator(".album summary").click();
  await expect(page.locator("#sticker-gallery")).toBeVisible();
});

test("petting cat increments treats and progresses from pleased to asleep", async ({ page }) => {
  await openFreshPage(page);

  const treatCount = page.locator("#treat-count");
  await expect(treatCount).toHaveText("0");

  await page.locator("#hero-cat").click();
  await expect(treatCount).toHaveText("1");
  await expect(page.locator("#speech")).toHaveText("yes. this is acceptable.");
  for (let pets = 1; pets < 10; pets += 1) {
    await page.locator("#hero-cat").press("Enter");
    if (pets === 3) {
      await expect(page.locator("#speech")).toHaveText("you may continue.");
    }
    if (pets === 6) {
      await expect(page.locator("#speech")).toHaveText("we have discussed personal space.");
    }
  }
  await expect(treatCount).toHaveText("10");
  await expect(page.locator("#speech")).toHaveText("the exhibition is now closed. zzz.");
});

test("fortune button unlocks oracle sticker", async ({ page }) => {
  await openFreshPage(page);

  const oracleCard = page.locator('[data-sticker="oracle"]');
  await expect(oracleCard).toHaveClass(/locked/);

  await page.locator("#fortune-btn").click();

  await expect(page.locator("#fortune-box")).toBeVisible();
  await expect(page.locator("#fortune-text")).not.toHaveText("The oracle cat waits for your question.");
  await expect(oracleCard).not.toHaveClass(/locked/);
  await page.getByRole("button", { name: "Close the fortune" }).click();
  await expect(page.locator("#fortune-box")).toBeHidden();
  await expect(page.locator("#fortune-btn")).toBeFocused();
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
  await expect(page.locator("#laser-status")).toContainText(/appointments|distinguished/);
  await page.getByRole("button", { name: "Put the laser away" }).click();
  await expect(page.locator("#laser-game")).toBeHidden();
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

test("the first visit fits a phone and the collection stays in two columns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshPage(page);
  const initialSize = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight
  }));
  expect(initialSize.width).toBe(390);
  expect(initialSize.height).toBe(844);
  await page.locator(".album summary").click();
  const first = await page.locator(".gallery-item").nth(0).boundingBox();
  const second = await page.locator(".gallery-item").nth(1).boundingBox();
  expect(first?.y).toBe(second?.y);
  expect(second?.x).toBeGreaterThan(first?.x ?? 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("laser supports keyboard play and can be put away mid-game", async ({ page }) => {
  await openFreshPage(page);
  await page.locator("#laser-btn").click();
  await page.locator("#laser-dot").press("Enter");
  await expect(page.locator("#laser-score")).toHaveText("Score: 1");
  await page.locator("#laser-close").click();
  await expect(page.locator("#laser-game")).toBeHidden();
  await expect(page.locator("#laser-btn")).toBeEnabled();
  await page.locator("#laser-btn").click();
  await expect(page.locator("#laser-score")).toHaveText("Score: 0");
});
