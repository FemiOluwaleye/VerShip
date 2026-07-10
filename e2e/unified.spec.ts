import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5000";

test("public site renders without admin code, admin isolates correctly", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // Track which JS chunks the browser downloads.
  const chunks: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.endsWith(".js")) chunks.push(u.split("/").pop() || u);
  });

  // --- 1. Public site at / ---
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const title = await page.title();
  // No Bootstrap/admin vendor CSS should be present on the public site.
  const adminCssOnPublic = await page.locator('link[data-admin-asset="true"]').count();
  // The admin chunk must NOT have been downloaded for the public route.
  const adminChunkLoadedOnPublic = chunks.some((c) => c.startsWith("AdminApp"));
  const bodyText = (await page.locator("body").innerText()).slice(0, 120);

  console.log("PUBLIC title:", JSON.stringify(title));
  console.log("PUBLIC admin-css links:", adminCssOnPublic, "| admin chunk loaded:", adminChunkLoadedOnPublic);
  console.log("PUBLIC body starts:", JSON.stringify(bodyText.replace(/\n/g, " ")));

  expect(adminCssOnPublic, "no admin vendor CSS on public site").toBe(0);
  expect(adminChunkLoadedOnPublic, "admin chunk NOT loaded on public route").toBeFalsy();

  // --- 2. Admin at /admin/login ---
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // let AdminAssetsLoader inject vendor scripts

  const jqueryReady = await page.evaluate(() => typeof (window as any).jQuery === "function");
  const fancyboxReady = await page.evaluate(
    () => !!((window as any).jQuery && (window as any).jQuery.fn && (window as any).jQuery.fn.fancybox)
  );
  const bootstrapCssInjected = await page.locator('link[data-admin-asset="true"]').count();
  const adminChunkLoaded = chunks.some((c) => c.startsWith("AdminApp"));
  const hasPasswordInput = await page.locator('input[type="password"]').count();
  const adminRoot = await page.locator(".admin-root").count();

  console.log("ADMIN jQuery ready:", jqueryReady, "| fancybox registered:", fancyboxReady);
  console.log("ADMIN vendor CSS injected:", bootstrapCssInjected, "| admin chunk loaded:", adminChunkLoaded);
  console.log("ADMIN password inputs:", hasPasswordInput, "| .admin-root present:", adminRoot);

  expect(adminChunkLoaded, "admin chunk loaded on /admin route").toBeTruthy();
  expect(jqueryReady, "jQuery global set for admin").toBeTruthy();
  expect(fancyboxReady, "fancybox plugin registered on jQuery").toBeTruthy();
  expect(bootstrapCssInjected, "admin vendor CSS injected under /admin").toBeGreaterThan(0);
  expect(adminRoot, ".admin-root wrapper present").toBeGreaterThan(0);

  // --- 3. Navigate back to public: vendor CSS must be removed (no bleed) ---
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const adminCssAfterReturn = await page.locator('link[data-admin-asset="true"]').count();
  console.log("AFTER-RETURN admin-css links (should be 0):", adminCssAfterReturn);

  console.log("PAGE ERRORS:", pageErrors.length ? JSON.stringify(pageErrors) : "none");
});
