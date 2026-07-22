// Browser test: provider onboarding pricing form (v2) — happy + non-happy.
import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000";
const SHOT = (n) => `/tmp/claude-1000/-home-runner-workspace/ad28a58e-5754-43f5-a99f-78212e7c2cdc/scratchpad/pf-${n}.png`;
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const log = (...a) => console.log(...a);
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); log(`  ${ok ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`); };
page.on("pageerror", (e) => log("  [PAGEERROR]", e.message));
const bad = [];
page.on("response", async (r) => { if (r.url().includes("/website/") && r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(BASE, "")}`); });

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "e2e-provider@vership.test");
  await page.fill('input[name="password"]', "Test@1234");
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(2500);
  check("provider login", !page.url().includes("/login"));

  await page.goto(`${BASE}/businessuploadnext`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const body = () => page.locator("body").innerText().then((t) => t.replace(/\n{2,}/g, "\n"));
  let b = await body();
  await page.screenshot({ path: SHOT("form"), fullPage: true });

  check("v2 Pickup section renders", /Pickup Barrel Charge/i.test(b) && /Pickup Radius/i.test(b) && /Extra Mileage/i.test(b));
  check("v2 Sea Freight section renders", /Sea Freight/i.test(b) && /Barrels?\s*1\s*[-–]\s*4/i.test(b) && /5\s*[-–]\s*9/.test(b) && /10\s*\+/.test(b));
  check("two-column parish header", /1 Barrel/i.test(b) && /Additional Barrel/i.test(b));
  const parishCount = ["Kingston", "St. Andrew", "Trelawny", "Westmoreland", "St. Catherine"].filter((p) => b.includes(p)).length;
  check("parish rows present", parishCount === 5, `${parishCount}/5 sampled`);
  check("legacy 25-slot accordion GONE", !/1\s*[-–]\s*25 barrels/i.test(b));
  check("legacy volume-discount toggle GONE", !/volume discount/i.test(b));

  // hydration: sea freight input should show the saved $100
  const seaInput = page.locator("input").filter({ hasNot: page.locator("[type=checkbox]") }).nth(0);
  const seaVal = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input")];
    const el = inputs.find((i) => i.value === "100");
    return el ? "100" : null;
  });
  check("hydrates saved sea freight ($100)", seaVal === "100");
  const parishHydrated = await page.evaluate(() => [...document.querySelectorAll("input")].filter((i) => i.value === "155").length > 0);
  check("hydrates saved parish fee (155)", parishHydrated);

  // Non-happy: clear the sea-freight ($100) input -> save -> expect validation
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("input")].find((i) => i.value === "100");
    if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, ""); el.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  const save = page.locator("button:visible", { hasText: /finish|save|submit|complete|update/i }).last();
  await save.click().catch(() => {});
  await page.waitForTimeout(1500);
  b = await body();
  const stillHere = page.url().includes("businessuploadnext");
  check("empty sea freight blocks save", stillHere && /(required|enter|invalid)/i.test(b), page.url());
  await page.screenshot({ path: SHOT("validation"), fullPage: true });

  // Apply-to-all: fill the two apply inputs and click apply, then check a parish input got the value
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("input")].find((i) => i.value === "");
  });
  const applyBtn = page.locator("button", { hasText: /apply/i }).first();
  if (await applyBtn.count()) {
    // find the apply-to-all inputs: the two inputs immediately before the button in DOM order
    const filled = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const btn = btns.find((x) => /apply/i.test(x.textContent));
      if (!btn) return false;
      const container = btn.closest("div")?.parentElement || btn.closest("div");
      const inputs = [...(container?.querySelectorAll("input") || [])].slice(0, 2);
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      inputs.forEach((i, idx) => { s.call(i, idx === 0 ? "200" : "45"); i.dispatchEvent(new Event("input", { bubbles: true })); });
      return inputs.length;
    });
    await applyBtn.click().catch(() => {});
    await page.waitForTimeout(600);
    const applied = await page.evaluate(() => [...document.querySelectorAll("input")].filter((i) => i.value === "200").length);
    check("apply-to-all fills parishes", applied >= 14, `${applied} inputs = 200 (apply inputs found: ${filled})`);
  } else check("apply-to-all button present", false);
  await page.screenshot({ path: SHOT("applied"), fullPage: true });
} catch (e) {
  log("SCRIPT ERROR:", e.message);
  await page.screenshot({ path: SHOT("error"), fullPage: true }).catch(() => {});
} finally {
  log("API failures:", bad.length ? bad : "none");
  const fails = results.filter((r) => !r.ok);
  log(`\n${results.length - fails.length}/${results.length} passed`);
  if (fails.length) log("FAILED:", fails.map((f) => f.n));
  await browser.close();
}
