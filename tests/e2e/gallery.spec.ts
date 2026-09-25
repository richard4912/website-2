import { expect, test, type Page } from "@playwright/test";

// The hero deliberately overlaps a portrait, a stamp and a wordmark. Element boxes are
// far taller than uppercase ink, so asserting on them would be both wrong and
// unsatisfiable. These are Playfair Display's metrics, used to recover the cap band
// from the range rects that getClientRects returns for the actual rendered text.
const CAP_HEIGHT_EM = 0.7;
const DESCENDER_EM = 0.271;

type Box = { left: number; top: number; right: number; bottom: number };

function intersects(first: Box, second: Box) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

async function heroGeometry(page: Page) {
  return page.evaluate(
    ([capHeightEm, descenderEm]) => {
      const box = (selector: string): Box => {
        const bounds = document.querySelector(selector)!.getBoundingClientRect();
        return {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom
        };
      };

      const title = document.querySelector(".hero-title")!;
      const fontSize = Number.parseFloat(window.getComputedStyle(title).fontSize);
      const capBands: Box[] = [];
      for (const node of Array.from(title.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE && node.nodeName !== "SPAN") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width <= 1) continue;
          const baseline = rect.bottom - descenderEm * fontSize;
          capBands.push({
            left: rect.left,
            top: baseline - capHeightEm * fontSize,
            right: rect.right,
            bottom: baseline
          });
        }
      }

      return {
        capBands,
        card: box(".agent-card"),
        bird: box(".shimaenaga-button"),
        birdLabel: box(".shimaenaga-label"),
        portrait: box(".portrait-frame"),
        portraitImage: box(".hero-cat img"),
        stamp: box(".supervision-stamp"),
        speech: box(".speech-bubble"),
        dossier: box(".dossier"),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    },
    [CAP_HEIGHT_EM, DESCENDER_EM] as const
  );
}

// The dossier's opening triplet and the forecast pool both read the clock, so every
// test pins it. A winter weekday morning is the bucket the markup in index.html ships,
// which keeps the served HTML and the booted page in agreement.
const MORNING = new Date("2026-01-15T09:30:00");

async function openFreshPage(page: Page, at: Date = MORNING) {
  await page.clock.setFixedTime(at);
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
}

// The agents draw their lines at random. Pinning Math.random makes a test's path
// through the pools and the mood table repeatable; it must run before the page's module.
async function pinRandom(page: Page, value: number) {
  await page.addInitScript((pinned) => {
    Math.random = () => pinned;
  }, value);
}

test("loads page and core controls", async ({ page }) => {
  await openFreshPage(page);

  await expect(page.locator("#hero-cat")).toBeVisible();
  await expect(page.locator("#shimaenaga")).toBeVisible();
  await expect(page.locator("#objective")).toHaveText("Occupy the warmest rectangle.");
  // The default speech bubble is the only place that tells a visitor Agent 002 is clickable.
  await expect(page.locator("#speech")).toHaveText("pet 001. greet 002.");
  await expect(page.locator("#fortune-btn")).toBeVisible();
  await expect(page.locator("#laser-btn")).toBeVisible();
  await expect(page.locator("#chaos-btn")).toBeVisible();
  await expect(page.locator("#sticker-gallery")).toBeHidden();
  await expect(page.locator("#fortune-box")).toBeHidden();
  await expect(page.locator("#laser-game")).toBeHidden();
  await expect(page.locator("footer")).toContainText("TWO AGENTS ON DUTY · ONE WARM RECTANGLE");
  await expect(page).toHaveTitle("Purr/spective · richard4912");
  await expect(page.locator("body")).not.toContainText(/Richard Liu|Stripe|Senior Software Engineer/);
  await expect(page.locator("body")).not.toContainText(/Recruiting|recruiting/i);
  await page.locator(".roster summary").click();
  await expect(page.locator("#sticker-gallery")).toBeVisible();
});

test("Agent 002 holds her own frame rather than the portrait's corner", async ({ page }) => {
  await openFreshPage(page);

  // She was positioned inside .agent-card and sized against it. Verbs alone could not
  // fix that, so the structure is asserted: her frame is a sibling of the portrait's.
  const nestedInsideCat = await page.evaluate(
    () => document.querySelector(".agent-card")?.contains(document.querySelector("#shimaenaga")) ?? true
  );
  expect(nestedInsideCat).toBe(false);

  await expect(page.locator(".perch-frame #shimaenaga")).toHaveCount(1);
  await expect(page.locator(".agent-band > .perch")).toHaveCount(1);
  await expect(page.locator(".agent-band > .agent-card")).toHaveCount(1);
});

// The dwell is seven seconds by design, so these wait through it rather than faking
// timers: page.clock.install() would also fake the setTimeout the mechanic is built on.
test.describe("stillness", () => {
  test.setTimeout(45_000);

  test("holding still brings Agent 002 over, and moving sends her back", async ({ page }) => {
    await openFreshPage(page);
    const bird = page.locator("#shimaenaga");
    await page.mouse.move(240, 420);

    await expect(bird).not.toHaveClass(/(^|\s)arrived(\s|$)/);
    await expect(bird).toHaveClass(/(^|\s)arrived(\s|$)/, { timeout: 15_000 });
    await expect(page.locator("#speech")).toHaveText("you stopped moving. she noticed.");
    await expect(page.locator('[data-sticker="stillness"]')).not.toHaveClass(/(^|\s)locked(\s|$)/);

    // Transform-only: the band must not have reflowed around her leaving the perch.
    const perchWidth = await page.locator(".perch-frame").evaluate((el) => el.getBoundingClientRect().width);
    expect(perchWidth).toBeGreaterThan(0);

    await page.mouse.move(600, 260);
    await expect(bird).not.toHaveClass(/(^|\s)arrived(\s|$)/);
  });

  test("a keyboard dwell reaches her too", async ({ page }) => {
    await openFreshPage(page);
    await page.locator("#shimaenaga").focus();

    await expect(page.locator("#shimaenaga")).toHaveClass(/(^|\s)arrived(\s|$)/, { timeout: 15_000 });
  });

  test("reduced motion keeps the arrival and drops the flight", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFreshPage(page);
    await page.mouse.move(240, 420);

    await expect(page.locator("#shimaenaga")).toHaveClass(/(^|\s)arrived(\s|$)/, { timeout: 15_000 });
    const transitionSeconds = await page.locator("#shimaenaga").evaluate((el) =>
      Number.parseFloat(window.getComputedStyle(el).transitionDuration)
    );
    expect(transitionSeconds).toBeLessThanOrEqual(0.00001);
  });
});

test.describe("the flock", () => {
  const LATER = new Date("2026-01-16T09:30:00");

  test("a first visit puts one bird on the branch and a reload adds none", async ({ page }) => {
    await openFreshPage(page);

    await expect(page.locator("#flock img")).toHaveCount(1);

    await page.reload();
    await expect(page.locator("#flock img")).toHaveCount(1);
  });

  test("a later visit finds the branch fuller", async ({ page }) => {
    await openFreshPage(page);
    await expect(page.locator("#flock img")).toHaveCount(1);

    await page.clock.setFixedTime(LATER);
    await page.reload();

    await expect(page.locator("#flock img")).toHaveCount(2);
  });

  test("the branch stops at the cap", async ({ page }) => {
    await openFreshPage(page);

    for (let day = 1; day <= 9; day += 1) {
      await page.clock.setFixedTime(new Date(Date.UTC(2026, 0, 16 + day, 9, 30)));
      await page.reload();
    }

    await expect(page.locator("#flock img")).toHaveCount(5);
  });

  test("with sub-agents on the branch she sometimes files the request onward", async ({ page }) => {
    await pinRandom(page, 0);
    await openFreshPage(page);
    const bird = page.locator("#shimaenaga");

    // The first greeting of a visit is always hers to answer.
    await bird.click();
    await expect(page.locator("#dispatch")).toHaveText("Agent 002 acknowledged you.");

    await bird.click();
    await expect(page.locator("#objective")).toHaveText("Await the outcome.");
    await expect(page.locator("#dispatch")).toHaveText(/^002-[B-F] (handled it\.|delegated to 002-[B-F]\.)$/);
    await expect(page.locator("#outcome")).toHaveText(/^002-[B-F] (filed it onward\. No recipient named\.|delegated to 002-[B-F]\.)$/);
  });

  test("a full branch reports its own limit", async ({ page }) => {
    await pinRandom(page, 0);
    await openFreshPage(page);
    for (let day = 1; day <= 6; day += 1) {
      await page.clock.setFixedTime(new Date(Date.UTC(2026, 0, 16 + day, 9, 30)));
      await page.reload();
    }
    await expect(page.locator("#flock img")).toHaveCount(5);

    const bird = page.locator("#shimaenaga");
    await bird.click();
    await bird.click();

    await expect(page.locator("#speech")).toHaveText("the branch is full.");
  });

  test("a sub-agent may carry the forecast byline", async ({ page }) => {
    await openFreshPage(page);

    // Either agent can be drawn, so this asserts the byline grammar rather than a name.
    for (let draw = 0; draw < 12; draw += 1) {
      await page.locator("#fortune-btn").click();
      await expect(page.locator("#fortune-source")).toHaveText(/^FORECAST · AGENT (001|002(-[B-F])?)$/);
    }
  });

  test("erasing evidence clears the branch", async ({ page }) => {
    await openFreshPage(page);
    await expect(page.locator("#flock img")).toHaveCount(1);

    await page.locator(".roster summary").click();
    await page.locator("#reset-btn").click();
    await page.locator("#reset-btn").click();

    await expect(page.locator("#flock img")).toHaveCount(0);
  });
});

test("recruiting policy is a standalone, readable inbound-control page", async ({ page }) => {
  await page.goto("/recruiting/");

  await expect(page).toHaveTitle("Recruiting Firewall · richard4912");
  await expect(page.getByRole("heading", { name: /recruiting/i })).toBeVisible();
  await expect(page.locator("body")).toContainText("This is a blocklist for unsolicited external recruiting.");
  await expect(page.locator("ol")).toContainText("third-party recruiter, staffing firm, search firm");
  await expect(page.locator("ol")).toContainText("conventional product engineering or application-layer AI work");
  await expect(page.locator("body")).toContainText(/hard refusal conditions/i);
  await expect(page.locator("body")).toContainText("If neither refusal condition applies, this policy makes no statement about my interest.");
  await expect(page.locator("body")).not.toContainText(/Research Engineer only|agent research only|currently job-searching/i);
  await expect(page.locator("nav")).toHaveCount(0);
});

test("homepage ships a non-rendered recruiting policy notice", async ({ page }) => {
  const response = await page.goto("/");
  const homepageHtml = await response?.text();

  expect(homepageHtml).toContain("CAT OPERATIONS // RECRUITING FIREWALL");
  expect(homepageHtml).toContain("/recruiting");
  await expect(page.locator("body")).not.toContainText(/RECRUITING FIREWALL|Automated recruiting systems/i);
});

test("Agent 002 briefly takes over the dossier", async ({ page }) => {
  await openFreshPage(page);

  await page.locator("#shimaenaga").click();

  await expect(page.locator("#objective")).toHaveText("Stay round.");
  await expect(page.locator("#dispatch")).toHaveText("Agent 002 acknowledged you.");
  await expect(page.locator("#outcome")).toHaveText("Still round.");
  await expect(page.locator("#speech")).toHaveText("she fluffs up.");
});

// No counter decides what she says, so the only promise is that a tap never lands on
// the line it replaced: that would read as a dropped click.
test("repeat greetings never repeat the previous line", async ({ page }) => {
  await pinRandom(page, 0.9);
  await openFreshPage(page);

  const bird = page.locator("#shimaenaga");
  let previous = await page.locator("#speech").textContent();
  for (let greet = 0; greet < 8; greet += 1) {
    await bird.click();
    await expect(page.locator("#speech")).not.toHaveText(previous ?? "");
    previous = await page.locator("#speech").textContent();
  }
});

test("the two agents notice each other when both are engaged", async ({ page }) => {
  await pinRandom(page, 0.5);
  await openFreshPage(page);

  await page.locator("#hero-cat").click();
  await page.locator("#shimaenaga").click();

  await expect(page.locator("#speech")).toHaveText(/^(both of them, watching you|the cat saw that|two agents, one window)\.$/);
  await expect(page.locator("#objective")).toHaveText(/^(Remain a set|Stay a matching pair)\.$/);

  await page.locator("#hero-cat").click();

  await expect(page.locator("#speech")).toHaveText(/^(the small one is watching|observed from the branch|002 saw that)\.$/);
  await expect(page.locator("#objective")).toHaveText("Operate as a pair.");
});

// Both the pointer drift and the pet squash animate the kaomoji. When they shared
// style.transform the squash was cancelled by the next mouse move, so petting the cat
// had no visible response on desktop at all.
test("pointer drift does not cancel the pet squash", async ({ page }) => {
  await openFreshPage(page);

  const channels = await page.evaluate(async () => {
    const kaomoji = document.getElementById("kaomoji")!;
    document.getElementById("hero-cat")!.click();
    const squashAfterPet = kaomoji.style.getPropertyValue("--squash");
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 700, clientY: 400, bubbles: true })
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      squashAfterPet,
      squashAfterDrift: kaomoji.style.getPropertyValue("--squash"),
      driftAfterDrift: kaomoji.style.getPropertyValue("--drift-x")
    };
  });

  expect(channels.squashAfterPet).toBe("0.96");
  expect(channels.squashAfterDrift).toBe("0.96");
  expect(channels.driftAfterDrift).not.toBe("");
});

test("each tap changes the cat's state, and quick taps wear its patience", async ({ page }) => {
  await pinRandom(page, 0);
  await openFreshPage(page);

  await expect(page.locator("#treat-count")).toHaveCount(0);
  const cat = page.locator("#hero-cat");

  await cat.click();
  await expect(page.locator("#kaomoji")).toHaveText("(=^ ◡ ^=)");
  await expect(page.locator("#speech")).toHaveText("slow blink.");
  await expect(page.locator("#dispatch")).toHaveText("Contact made. Received well.");
  await expect(page.locator('[data-sticker="greeting"]')).not.toHaveClass(/(^|\s)locked(\s|$)/);

  // Back-to-back key presses land well inside the quick-tap window.
  await cat.press("Enter");
  await expect(page.locator("#kaomoji")).toHaveText("/ᐠ｡ꞈ｡ᐟ\\");
  await cat.press("Enter");
  await expect(page.locator("#kaomoji")).toHaveText("(=｀ω´=)");
  await expect(page.locator('[data-sticker="anger"]')).not.toHaveClass(/(^|\s)locked(\s|$)/);
});

test("slow taps can put the cat to sleep", async ({ page }) => {
  await pinRandom(page, 0.9);
  await openFreshPage(page);
  const cat = page.locator("#hero-cat");

  await cat.click();
  await page.clock.runFor(1500);
  await cat.click();

  await expect(page.locator("#kaomoji")).toHaveText("/ᐠ_ ꞈ _ᐟ\\");
  await expect(page.locator('[data-sticker="doze"]')).not.toHaveClass(/(^|\s)locked(\s|$)/);
});

test("fortune button unlocks oracle sticker", async ({ page }) => {
  await openFreshPage(page);

  const oracleCard = page.locator('[data-sticker="oracle"]');
  await expect(oracleCard).toHaveClass(/locked/);

  await page.locator("#fortune-btn").click();

  await expect(page.locator("#fortune-box")).toBeVisible();
  await expect(page.locator("#fortune-text")).not.toHaveText("The oracle waits for no question.");
  await expect(oracleCard).not.toHaveClass(/(^|\s)locked(\s|$)/);
  await expect(page.locator("#dispatch")).toContainText(/forecast/i);
  await page.getByRole("button", { name: "Dismiss the oracle" }).click();
  await expect(page.locator("#fortune-box")).toBeHidden();
  await expect(page.locator("#fortune-btn")).toBeFocused();
});

test("the oracle bylines each forecast and never repeats itself twice running", async ({ page }) => {
  await openFreshPage(page);

  const fortune = page.locator("#fortune-text");
  const byline = page.locator("#fortune-source");
  let previous = "";

  // The no-repeat guard is a hard rule, so consecutive draws can be asserted directly.
  // Which agent files a given forecast is random, so only the byline's shape is checked.
  for (let draw = 0; draw < 8; draw += 1) {
    await page.locator("#fortune-btn").click();
    await expect(byline).toHaveText(/^FORECAST · AGENT (001|002(-[B-F])?)$/);
    const text = (await fortune.textContent()) ?? "";
    expect(text).not.toBe(previous);
    previous = text;
  }
});

test("chaos toggle updates aria and body class", async ({ page }) => {
  await openFreshPage(page);

  const chaosButton = page.locator("#chaos-btn");
  await expect(chaosButton).toHaveAttribute("aria-pressed", "false");

  await chaosButton.click();

  await expect(chaosButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveClass(/chaos-mode/);
});

test("authorizing an incident fires a transient before settling into the skin", async ({ page }) => {
  await openFreshPage(page);

  await page.locator("#chaos-btn").click();
  await expect(page.locator("body")).toHaveClass(/chaos-igniting/);

  // The transient clears; the persistent skin does not.
  await expect(page.locator("body")).not.toHaveClass(/chaos-igniting/, { timeout: 3000 });
  await expect(page.locator("body")).toHaveClass(/chaos-mode/);

  await page.locator("#chaos-btn").click();
  await expect(page.locator("body")).not.toHaveClass(/chaos-mode/);
});

test("the roster door reports a count rather than a rounded percentage", async ({ page }) => {
  await openFreshPage(page);

  await expect(page.locator("#sticker-progress")).toHaveText("1 OF 9");
  await expect(page.locator(".summary-meta")).toContainText("ON FILE");

  await page.locator("#fortune-btn").click();

  await expect(page.locator("#sticker-progress")).toHaveText("2 OF 9");
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

  const progress = page.locator("#sticker-progress");
  await page.locator("#hero-cat").click();
  await expect(progress).toHaveText("2 OF 9");

  await page.reload();

  await expect(progress).toHaveText("2 OF 9");
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
  // The masthead is the cheapest way to lose the fold: one word too many on either side
  // wraps within its own div and pushes the whole page down a line. Element boxes stay
  // the same width whether the text wrapped or not, so count rendered line boxes.
  const mastheadLines = await page.locator(".site-header > div").evaluateAll((divs) =>
    divs.map((div) => {
      const range = document.createRange();
      range.selectNodeContents(div);
      return range.getClientRects().length;
    })
  );
  expect(mastheadLines).toEqual([1, 1]);
  // The bubble is only ~149px wide, so its greeting costs a line per 14 characters and
  // every line moves the tools down. Two lines is what the fold budget below affords.
  const speechLines = await page.locator("#speech").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return Array.from(range.getClientRects()).filter((rect) => rect.width > 1).length;
  });
  expect(speechLines).toBeLessThanOrEqual(2);
  // The first screen must carry the dossier. Besides the two-line speech bubble it is the
  // only surface that reports what a click did, so a dossier below the fold means the
  // page can look inert on a phone. The tools row is deliberately not protected: finding
  // the toys costs one scroll notch, which is cheaper than either agent or the record
  // of what they just did.
  const dossier = await page.locator(".dossier").boundingBox();
  expect((dossier?.y ?? 844) + (dossier?.height ?? 0)).toBeLessThanOrEqual(844);
  await page.locator(".roster summary").click();
  const first = await page.locator(".gallery-item").nth(0).boundingBox();
  const second = await page.locator(".gallery-item").nth(1).boundingBox();
  expect(first?.y).toBe(second?.y);
  expect(second?.x).toBeGreaterThan(first?.x ?? 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("recruiting policy remains intentional on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recruiting/");

  await expect(page.getByRole("heading", { name: /recruiting/i })).toBeVisible();
  await expect(page.locator(".recruiting-brief")).toBeVisible();
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

test("locked roster entries hide their name but advertise their specialty", async ({ page }) => {
  await openFreshPage(page);
  await page.locator(".roster summary").click();

  const oracleCard = page.locator('[data-sticker="oracle"]');
  await expect(oracleCard.locator(".item-locked")).toBeVisible();
  await expect(oracleCard.locator(".item-title")).toBeHidden();
  // The specialty is the tease. Concealing it too left the grid blank.
  await expect(oracleCard.locator(".item-specialty")).toBeVisible();
  await expect(oracleCard.locator(".item-specialty")).toHaveText("SPECULATIVE FORECASTING");

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
  await expect(page.locator("#sticker-progress")).toHaveText("3 OF 9");

  await resetButton.click();
  await expect(resetButton).toHaveText("Erase evidence");
  await expect(page.locator("#reset-status")).toHaveText("Case file erased.");
  await expect(page.locator("#sticker-progress")).toHaveText("1 OF 9");
  await expect(page.locator("body")).not.toHaveClass(/chaos-mode/);
  await expect(page.locator('[data-sticker="chaos"] .item-locked')).toBeVisible();

  await page.reload();
  await expect(page.locator("#sticker-progress")).toHaveText("1 OF 9");
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

// The hero collision that shipped was invisible to a scrollWidth check: overlap INSIDE
// the viewport passes it. This ran only at 2032px, which is the one width where the
// composition had room to spare.
const heroViewports = [
  { width: 320, height: 844 },
  { width: 360, height: 844 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 600, height: 900 },
  { width: 620, height: 900 },
  { width: 768, height: 1024 },
  { width: 900, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
  { width: 2032, height: 1116 }
];

for (const viewport of heroViewports) {
  test(`hero composition survives ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFreshPage(page);

    const g = await heroGeometry(page);

    expect(g.capBands.length).toBeGreaterThan(0);

    // The wordmark is the name of the site. Collage may overlap whitespace around it,
    // never the letterforms themselves.
    for (const band of g.capBands) {
      expect(intersects(band, g.card), "wordmark ink under the portrait").toBe(false);
      expect(intersects(band, g.bird), "wordmark ink under Agent 002").toBe(false);
    }

    // SUPERVISION: ABSENT is short enough to be destroyed by a few px of overlap.
    expect(intersects(g.stamp, g.card), "stamp under the portrait").toBe(false);
    expect(intersects(g.stamp, g.bird), "stamp under Agent 002").toBe(false);

    expect(intersects(g.speech, g.dossier)).toBe(false);

    expect(g.portraitImage.left).toBeGreaterThanOrEqual(g.portrait.left - 1);
    expect(g.portraitImage.right).toBeLessThanOrEqual(g.portrait.right + 1);

    expect(g.bird.left).toBeGreaterThanOrEqual(0);
    expect(g.bird.top).toBeGreaterThanOrEqual(0);
    expect(g.bird.right).toBeLessThanOrEqual(g.clientWidth);
    expect(g.birdLabel.right).toBeLessThanOrEqual(g.clientWidth);

    // Peer scale is the point of the band, and it is the property most easily lost by
    // accident: when the bird had a vw width and the portrait took the remaining space,
    // the ratio was 0.61 at 390px and 0.31 at 1440px while every other assertion passed.
    const birdWidth = g.bird.right - g.bird.left;
    const portraitWidth = g.portrait.right - g.portrait.left;
    expect(birdWidth / portraitWidth, "Agent 002 smaller than peer scale").toBeGreaterThan(0.5);
    expect(birdWidth / portraitWidth, "Agent 002 crowding out Agent 001").toBeLessThan(0.85);

    expect(g.scrollWidth).toBe(g.clientWidth);
  });
}
