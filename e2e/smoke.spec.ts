import { test, expect } from "@playwright/test";

// Setup-phase smoke test: proves the Playwright + Replit-Chromium harness works end to end.
// Later phases add real app-route tests (navigation, forms, state, empty states, viewports).
test("chromium launches and renders a page", async ({ page }) => {
  await page.setContent(
    "<main><h1 id='title'>Replit Playwright OK</h1></main>",
  );
  await expect(page.locator("#title")).toHaveText("Replit Playwright OK");
});
