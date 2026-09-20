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
  await expect(page.locator("#shimaenaga")).toBeVisible();
  await expect(page.locator("#objective")).toHaveText("Occupy the warmest rectangle.");
  await expect(page.locator("#fortune-btn")).toBeVisible();
  await expect(page.locator("#laser-btn")).toBeVisible();
  await expect(page.locator("#chaos-btn")).toBeVisible();
  await expect(page.locator("#sticker-gallery")).toBeHidden();
  await expect(page.locator("#fortune-box")).toBeHidden();
  await expect(page.locator("#laser-game")).toBeHidden();
  await expect(page.locator("footer")).toContainText("NO HUMAN PRESENT · CATS RUNNING FREE");
  await expect(page).toHaveTitle("Purr/spective · richard4912");
  await expect(page.locator("body")).not.toContainText(/Richard Liu|Stripe|Senior Software Engineer/);
  await page.locator(".roster summary").click();
  await expect(page.locator("#sticker-gallery")).toBeVisible();
});

test("Agent 002 briefly takes over the dossier", async ({ page }) => {
  await openFreshPage(page);

  await page.locator("#shimaenaga").click();

  await expect(page.locator("#objective")).toHaveText("Protect the round one.");
  await expect(page.locator("#dispatch")).toHaveText("Agent 002 joined without invitation.");
  await expect(page.locator("#outcome")).toHaveText("Morale increased beyond measurable limits.");
  await expect(page.locator("#speech")).toHaveText("a second opinion has arrived.");
});

test("petting cat increments treats and progresses from pleased to asleep", async ({ page }) => {
  await openFreshPage(page);

  const treatCount = page.locator("#treat-count");
  await expect(treatCount).toHaveText("0");

  await page.locator("#hero-cat").click();
  await expect(treatCount).toHaveText("1");
  await expect(page.locator("#speech")).toHaveText("yes. this is acceptable.");
  await expect(page.locator("#dispatch")).toHaveText("Treat requisition approved by recipient.");
  await expect(page.locator("#outcome")).toHaveText("Compensation accepted without review.");
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
  await expect(oracleCard).not.toHaveClass(/(^|\s)locked(\s|$)/);
  await expect(page.locator("#dispatch")).toHaveText("Forecasting delegated. Oversight bypassed.");
  await page.getByRole("button", { name: "Dismiss the oracle" }).click();
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
  await page.getByRole("button", { name: "Recall the red dot" }).click();
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

  await expect(secretCard).not.toHaveClass(/(^|\s)locked(\s|$)/);
});

test("the first visit exposes the primary experience on a phone and the roster stays in two columns", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshPage(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const lastTool = await page.locator("#chaos-btn").boundingBox();
  expect((lastTool?.y ?? 844) + (lastTool?.height ?? 0)).toBeLessThanOrEqual(844);
  await page.locator(".roster summary").click();
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

test("locked roster entries conceal their identity until discovered", async ({ page }) => {
  await openFreshPage(page);
  await page.locator(".roster summary").click();

  const oracleCard = page.locator('[data-sticker="oracle"]');
  await expect(oracleCard.locator(".item-locked")).toBeVisible();
  await expect(oracleCard.locator(".item-title")).toBeHidden();
  await expect(oracleCard.locator(".item-specialty")).toBeHidden();

  await page.locator("#fortune-btn").click();
  await expect(oracleCard.locator(".item-locked")).toBeHidden();
  await expect(oracleCard.locator(".item-title")).toBeVisible();
  await expect(oracleCard.locator(".item-specialty")).toBeVisible();
});

test("erasing evidence requires confirmation and resets persisted progress", async ({ page }) => {
  await openFreshPage(page);
  await page.locator("#hero-cat").click();
  await page.locator("#chaos-btn").click();
  await page.locator(".roster summary").click();

  const resetButton = page.locator("#reset-btn");
  await resetButton.click();
  await expect(resetButton).toHaveText("Confirm disappearance");
  await expect(page.locator("#treat-count")).toHaveText("1");

  await resetButton.click();
  await expect(resetButton).toHaveText("Erase evidence");
  await expect(page.locator("#reset-status")).toHaveText("Case file erased.");
  await expect(page.locator("#treat-count")).toHaveText("0");
  await expect(page.locator("body")).not.toHaveClass(/chaos-mode/);
  await expect(page.locator('[data-sticker="chaos"] .item-locked')).toBeVisible();

  await page.reload();
  await expect(page.locator("#treat-count")).toHaveText("0");
  await expect(page.locator("body")).not.toHaveClass(/chaos-mode/);
});

test("reduced motion suppresses decorative chaos animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFreshPage(page);
  await page.locator("#chaos-btn").click();

  const animationDurationSeconds = await page.locator(".hero-title").evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).animationDuration)
  );
  expect(animationDurationSeconds).toBeLessThanOrEqual(0.00001);
});

test("wide editorial graphics remain inside their regions", async ({ page }) => {
  await page.setViewportSize({ width: 2032, height: 1116 });
  await openFreshPage(page);

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const bounds = document.querySelector(selector)!.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom
      };
    };
    const overlaps = (first, second) =>
      first.left < second.right &&
      first.right > second.left &&
      first.top < second.bottom &&
      first.bottom > second.top;

    const title = rect(".hero-title");
    const portrait = rect(".portrait-frame");
    const image = rect(".hero-cat img");
    const speech = rect(".speech-bubble");
    const dossier = rect(".dossier");
    const bird = rect(".shimaenaga-button");
    const birdImage = rect(".shimaenaga-button img");

    return {
      titlePortraitOverlap: overlaps(title, portrait),
      speechDossierOverlap: overlaps(speech, dossier),
      imageInsidePortrait:
        image.left >= portrait.left &&
        image.top >= portrait.top &&
        image.right <= portrait.right &&
        image.bottom <= portrait.bottom,
      birdInsideViewport:
        bird.left >= 0 &&
        bird.top >= 0 &&
        bird.right <= document.documentElement.clientWidth,
      birdImageInsideButton:
        birdImage.left >= bird.left &&
        birdImage.top >= bird.top &&
        birdImage.right <= bird.right &&
        birdImage.bottom <= bird.bottom,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    };
  });

  expect(geometry.titlePortraitOverlap).toBe(false);
  expect(geometry.speechDossierOverlap).toBe(false);
  expect(geometry.imageInsidePortrait).toBe(true);
  expect(geometry.birdInsideViewport).toBe(true);
  expect(geometry.birdImageInsideButton).toBe(true);
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
});
