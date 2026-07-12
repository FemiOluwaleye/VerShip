import { chromium } from "@playwright/test";

const BASE = "http://localhost:5000";
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const log = (...a) => console.log(...a);
const netlog = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) log(`  [console.${m.type()}]`, m.text().slice(0, 300));
});
page.on("pageerror", (e) => log("  [PAGEERROR]", e.message));
page.on("response", async (r) => {
  const u = r.url();
  if (u.includes("/website/") || u.includes("/api/")) {
    let body = "";
    try { body = (await r.text()).slice(0, 400); } catch {}
    netlog.push({ status: r.status(), url: u.replace(BASE, ""), body });
  }
});

async function setDate(aria, val) {
  await page.$eval(
    `input[aria-label="${aria}"]`,
    (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    val
  );
}

const toastFeed = [];
async function toasts() {
  return await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
}

try {
  // ---- 1. REAL LOGIN as customer (role 1) ----
  log("\n=== LOGIN as e2e-user@vership.test (role 1 customer) ===");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "e2e-user@vership.test");
  await page.fill('input[name="password"]', "Test@1234");
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(2500);
  const userLS = await page.evaluate(() => localStorage.getItem("user"));
  log("  localStorage.user set?", !!userLS, "| url:", page.url());
  log("  login toasts:", (await toasts()).filter(Boolean).slice(0, 5));

  // ---- 2. HOME, fill quote form ----
  log("\n=== HOME -> fill Get Quotes form (Ship Your Own Barrel) ===");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.click('button[aria-label="Select origin"]');
  await page.waitForTimeout(300);
  await page.click('li[role=option] button:has-text("Pittsburgh, PA")');
  log("  origin selected: Pittsburgh, PA");

  await page.click('button[aria-label="Select destination"]');
  await page.waitForTimeout(300);
  await page.click('li[role=option] button:has-text("Kingston, Jamaica")');
  log("  destination selected: Kingston, Jamaica");

  await page.fill('input[aria-label="Barrel quantity"]', "3");
  await setDate("Pickup date", "2026-07-20");
  await setDate("Delivery date", "2026-08-15");
  await page.waitForTimeout(300);
  log("  quantity=3, pickup=2026-07-20, delivery=2026-08-15");

  netlog.length = 0;
  log("\n=== CLICK 'Get quotes' (real submit button) ===");
  // poll for toasts appearing then disappearing
  const poller = setInterval(async () => {
    const t = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
    for (const x of t) if (x && !toastFeed.includes(x)) toastFeed.push(x);
  }, 200);
  // enumerate all "Get quotes" buttons
  const gq = page.locator('button', { hasText: "Get quotes" });
  const gqn = await gq.count();
  log(`  found ${gqn} "Get quotes" buttons`);
  for (let i = 0; i < gqn; i++) {
    const cls = (await gq.nth(i).getAttribute("class")) || "";
    const box = await gq.nth(i).boundingBox();
    log(`    #${i}: submit-style=${cls.includes("c1a35e")} box=${box ? `${Math.round(box.y)}` : "null"} txt="${(await gq.nth(i).innerText()).trim()}"`);
  }
  // click the gold submit (the one with c1a35e in class)
  let clicked = false;
  for (let i = 0; i < gqn; i++) {
    const cls = (await gq.nth(i).getAttribute("class")) || "";
    if (cls.includes("c1a35e")) { await gq.nth(i).scrollIntoViewIfNeeded(); await gq.nth(i).click(); clicked = true; log(`  clicked submit button #${i}`); break; }
  }
  if (!clicked) log("  NO submit-style button found!");
  await page.waitForTimeout(4000);
  clearInterval(poller);
  log("  captured toasts during submit:", toastFeed);

  log("  url after click:", page.url());
  log("  toasts:", (await toasts()).filter(Boolean).slice(0, 6));
  log("  network (booking/api):");
  for (const n of netlog) log(`    ${n.status}  ${n.url}\n         body: ${n.body}`);

  // capture visible body text near top for any inline error
  const bodyStart = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
  log("\n  page text (first 500):\n", bodyStart.replace(/\n{2,}/g, "\n"));

  await page.screenshot({ path: "/tmp/claude-1000/-home-runner-workspace/b825b880-a714-437f-a048-5c41f7510c04/scratchpad/getquotes.png", fullPage: false });
} catch (e) {
  log("SCRIPT ERROR:", e.message);
} finally {
  await browser.close();
}
