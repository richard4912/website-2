import { expect, test } from "@playwright/test";

type IndexEntry = { issue: number; slug: string; date: string; title: string; dek: string };

async function readIndex(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get("/dispatches/index.json");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  return body.dispatches as IndexEntry[];
}

test("the archive index lists every entry in index.json", async ({ page, request }) => {
  const entries = await readIndex(request);
  await page.goto("/dispatches/");

  await expect(page.locator(".dispatch-entry")).toHaveCount(entries.length);
  for (const entry of entries) {
    await expect(page.locator(".dispatch-entry", { hasText: entry.title })).toHaveCount(1);
  }
});

test("the index page carries no per-entry markup of its own", async ({ page, request }) => {
  const entries = await readIndex(request);
  const response = await page.goto("/dispatches/");
  const html = await response?.text();

  // The list is rendered from index.json. Hard-coding entries here is how the archive
  // and its data source drift apart.
  for (const entry of entries) {
    expect(html).not.toContain(entry.dek);
  }
});

test("each dispatch resolves through the server and ships its text in the HTML", async ({ page, request }) => {
  const entries = await readIndex(request);

  for (const entry of entries) {
    const detail = await request.get(`/dispatches/${entry.slug}.json`);
    expect(detail.ok(), `${entry.slug}.json missing`).toBe(true);
    const data = await detail.json();

    // Directory routes need their own index.html; test the public URL, not the path.
    const response = await page.goto(`/dispatches/${entry.slug}`);
    expect(response?.ok(), `/dispatches/${entry.slug} did not resolve`).toBe(true);

    const html = (await response?.text()) ?? "";
    // Served HTML, not JS-injected: a crawler that runs no scripts still gets the text.
    for (const block of data.blocks as string[]) {
      expect(html).toContain(block.slice(0, 40));
    }
    await expect(page.locator("h1")).toHaveText(entry.title);
  }
});

test("rendered dispatch pages agree with the index they are listed in", async ({ page, request }) => {
  const entries = await readIndex(request);

  for (const entry of entries) {
    await page.goto(`/dispatches/${entry.slug}`);
    await expect(page.locator("h1")).toHaveText(entry.title);
    await expect(page.locator(".dispatch-dek")).toHaveText(entry.dek);
    await expect(page.locator(".site-header")).toContainText(`ISSUE ${String(entry.issue).padStart(2, "0")}`);
  }
});

test("the homepage points at the current issue and the archive", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".archive-line a").first()).toHaveAttribute("href", "dispatches/003");
  await page.locator('.archive-line a[href="dispatches/"]').click();
  await expect(page.locator("h1")).toHaveText("Dispatches");
});

test("the archive survives a phone without overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dispatches/");

  await expect(page.locator(".dispatch-entry").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await page.goto("/dispatches/003");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("the recruiting policy is machine-readable and cannot drift from the page", async ({ page, request }) => {
  const response = await request.get("/recruiting/policy.json");
  expect(response.ok()).toBe(true);
  const policy = await response.json();

  expect(policy.version).toEqual(expect.any(Number));
  expect(policy.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(policy.refusalConditions).toHaveLength(2);

  // The JSON and the prose page are two renderings of one policy. Asserting the
  // conditions appear in both is what stops one being edited without the other.
  await page.goto("/recruiting/");
  for (const { condition } of policy.refusalConditions as { condition: string }[]) {
    await expect(page.locator("ol")).toContainText(condition);
  }
  await expect(page.locator("body")).toContainText(policy.onNoMatch);
});

test("llms.txt serves the policy in prose and points at its canonical sources", async ({ request }) => {
  const response = await request.get("/llms.txt");
  expect(response.ok()).toBe(true);
  const text = await response.text();

  expect(text).toContain("https://www.richard4912.us/recruiting");
  expect(text).toContain("/recruiting/policy.json");
  expect(text).toContain("third-party recruiter, staffing firm, search firm");
  expect(text).toContain("application-layer AI");
  expect(text).toContain("prompt-inject");
});
