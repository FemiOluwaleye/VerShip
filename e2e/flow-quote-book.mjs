import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000";
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const log = (...a) => console.log(...a);
const bad = [];
page.on("response", async (r) => { const u = r.url(); if ((u.includes("/website/") || u.includes("/api/")) && r.status() >= 400) { let b = ""; try { b = (await r.text()).slice(0, 160); } catch {} bad.push(`${r.status()} ${u.replace(BASE, "")} :: ${b}`); } });
page.on("pageerror", (e) => log("  [PAGEERROR]", e.message));

async function setDate(aria, val) {
  await page.$eval(`input[aria-label="${aria}"]`, (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, val);
}
try {
  log("== login customer ==");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "e2e-user@vership.test");
  await page.fill('input[name="password"]', "Test@1234");
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(2500);

  log("== fill + submit Get quotes ==");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.click('button[aria-label="Select origin"]'); await page.waitForTimeout(200);
  await page.click('li[role=option] button:has-text("Pittsburgh, PA")');
  await page.click('button[aria-label="Select destination"]'); await page.waitForTimeout(200);
  await page.click('li[role=option] button:has-text("Kingston, Jamaica")');
  await page.fill('input[aria-label="Barrel quantity"]', "3");
  await setDate("Pickup date", "2026-07-20");
  await setDate("Delivery date", "2026-08-15");
  await page.waitForTimeout(200);
  const gq = page.locator('button', { hasText: "Get quotes" });
  const n = await gq.count();
  for (let i = 0; i < n; i++) { const c = (await gq.nth(i).getAttribute("class")) || ""; if (c.includes("c1a35e")) { await gq.nth(i).click(); break; } }
  await page.waitForTimeout(4000);
  log("  url after submit:", page.url());

  log("== quotes page content ==");
  const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n{2,}/g, "\n");
  log(body.slice(0, 900));
  // look for provider name / price
  const hasProvider = body.includes("E2E Test Forwarders");
  const hasPrice = /\$\s?150|150/.test(body);
  log("\n  >> quote shows 'E2E Test Forwarders':", hasProvider, "| shows price 150:", hasPrice);

  // count quote cards / actionable buttons
  const btns = await page.locator("button:visible, a[href]:visible").allInnerTexts().catch(() => []);
  log("  visible buttons on quotes page:", [...new Set(btns.map(b => b.trim()).filter(Boolean))].slice(0, 25));

  await page.screenshot({ path: "/tmp/claude-1000/-home-runner-workspace/b825b880-a714-437f-a048-5c41f7510c04/scratchpad/quotes.png", fullPage: true });
  log("\n  API failures during flow:", bad.length ? bad : "none");
} catch (e) { log("SCRIPT ERROR:", e.message); } finally { await browser.close(); }
