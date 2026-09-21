<!--
Reader: coding agents changing this repository.
Question: how do I prove I tested the files in this worktree rather than stale files served by another checkout?
Frame: a causal testing model and the smallest reliable verification paths.
Structure: site model, isolated setup, behavior checks, served-source checks, visual checks, failure diagnosis.
Not about: product requirements, deployment operations, or PR workflow.
-->

# Testing this site

## Site model

This is a static site. There is no compilation or production-build command: the deployed artifact is the repository's HTML, CSS, JavaScript, and assets served from the repository root. Use Node 22, matching CI.

The test layers have different jobs:

- Vitest covers JavaScript state and logic.
- Playwright covers routes, rendered behavior, accessibility, and responsive geometry against a local static server.
- Served-source inspection covers non-rendered requirements such as HTML comments. DOM text assertions cannot prove that source-only content survived.
- Screenshot inspection covers visual composition. Passing DOM and geometry assertions does not prove that a page looks intentional.

## Isolate the bytes under test

Install dependencies separately in every new worktree:

```sh
npm ci
```

Outside CI, Playwright is configured to reuse a server already listening on its target port. That server may belong to another worktree and may serve stale files while every browser command appears healthy. A new route returning 404, or served HTML missing a change that exists on disk, is evidence of this mismatch—not evidence that the implementation failed.

Choose an unused port for each worktree or concurrent agent and pass it through the supported override. `4175` is only an example:

```sh
PLAYWRIGHT_PORT=4175 npm run test:ci
```

Do not kill an unknown server merely because it owns the default port. Select another port. When results contradict the files on disk, inspect the listening process and fetch the served response before changing code.

## Run the right checks

Use the complete local gate before handoff:

```sh
PLAYWRIGHT_PORT=4175 npm run test:ci
git diff --check
```

The first command runs lint, unit tests, and the Playwright suite. During focused iteration, use the narrower scripts in `package.json`, but return to the complete gate before handoff.

For routes, test the public URL through the server, not only the file path. Directory routes use `path/index.html`; verify both redirect behavior and the final successful response where it matters.

For source-only behavior, assert on the HTTP response body or inspect it directly:

```js
const response = await page.goto("/");
const html = await response?.text();
expect(html).toContain("required source marker");
```

Pair that with a rendered-text assertion when the same content must remain invisible:

```js
await expect(page.locator("body")).not.toContainText("source-only text");
```

This distinction is load-bearing for HTML comments, metadata, and other machine-readable notices.

## Verify visual changes

After changing HTML or CSS, inspect full-page desktop and mobile renderings from the same isolated server used for functional verification. Use at least:

- desktop: 1440px wide;
- mobile: 390 × 844;
- an explicit horizontal-overflow check on mobile.

Check hierarchy, wrapping, borders, spacing, and whether the page still belongs to the site's existing editorial CAT OPERATIONS system. If a requirement says an existing page must remain visually unchanged, inspect its diff as well as its rendered page; a non-rendered source change should be the only relevant markup difference.

Stop only the server process you started after visual inspection. Do not leave local browser or static-server processes running.

### Text length is a layout dimension

The page loads Playfair Display and Space Mono from Google Fonts. An agent sandbox often cannot reach them, so the browser falls back to locally installed fonts and every measurement taken there is a measurement of different glyph widths than the ones CI and visitors get. Line counts, and anything downstream of them, can differ.

This matters because the mobile layout is tight: the phone test requires the tools row to stay above 844px on first visit, and a single extra wrapped line costs about 20px. Editing a line of copy is therefore a layout change. When a headline, label, or the speech bubble grows, verify it, and prefer assertions on rendered line boxes over assertions on pixel positions:

```js
const range = document.createRange();
range.selectNodeContents(element);
range.getClientRects().length; // line boxes, whichever font arrived
```

A line-box count is the same answer in both font worlds; a height in pixels is not. To reproduce real metrics locally, fetch the stylesheet and its woff2 files over the network layer that does work, then serve them into the page through request interception.

## Diagnose contradictions before treating them

When browser output disagrees with the working tree, first ask which bytes the browser received. The useful chain is:

1. Confirm the current worktree and branch.
2. Confirm the server port is unique to that worktree.
3. Fetch the route and inspect its status, final URL, and relevant source marker.
4. Only then interpret a browser failure as an implementation defect.

Changing code before resolving that chain risks fixing the current files in response to evidence produced by different files.
