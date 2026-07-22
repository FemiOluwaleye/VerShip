// Browser test: admin dashboard on its own subdomain with clean URLs.
// Requires the server started with ADMIN_HOST=admin.localhost:5000.
// Chromium resolves *.localhost to 127.0.0.1, so admin.localhost:5000 hits the
// same server with an admin.* hostname — exactly like admin.<domain> in prod.
import { chromium } from "@playwright/test";

const MAIN = "http://localhost:5000";
const ADMIN = "http://admin.localhost:5000";
const SCRATCH = "/tmp/claude-1000/-home-runner-workspace/b053e698-4d65-4944-8bc6-512a42d0754a/scratchpad";
const SHOT = (n) => `${SCRATCH}/sub-${n}.png`;

const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const log = (...a) => console.log(...a);
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); log(`  ${ok ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`); };
const pageErrs = [];
page.on("pageerror", (e) => pageErrs.push(e.message));
const body = () => page.locator("body").innerText().then((t) => t.replace(/\n{2,}/g, "\n"));

try {
  // ---------- 1. Subdomain root -> clean login URL ----------
  await page.goto(`${ADMIN}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("subdomain root -> /login (clean)", page.url() === `${ADMIN}/login`, page.url());
  check("admin login form renders", (await page.locator('input[placeholder="Email address"]').count()) === 1);
  const b1 = await body();
  check("no public navbar on subdomain", !/How it works/i.test(b1));
  await page.screenshot({ path: SHOT("login"), fullPage: false });

  // ---------- 2. Login -> clean /dashboard ----------
  await page.fill('input[placeholder="Email address"]', "e2e-admin@vership.test");
  await page.fill('input[placeholder="Password"]', "Test@1234");
  await page.click('button#login');
  await page.waitForTimeout(3500);
  check("login -> /dashboard (clean URL)", page.url() === `${ADMIN}/dashboard`, page.url());
  const tok = await page.evaluate(() => localStorage.getItem("admin_token"));
  check("admin_token stored", !!tok);
  await page.screenshot({ path: SHOT("dashboard"), fullPage: false });

  // ---------- 3. Sidebar navigation stays clean (verifies the codemod) ----------
  await page.click('a[href="/faqlist"]').catch(async () => {
    await page.locator("a", { hasText: /faq/i }).first().click();
  });
  await page.waitForTimeout(2000);
  check("sidebar nav -> /faqlist (clean)", page.url() === `${ADMIN}/faqlist`, page.url());
  check("faq list renders", /faq/i.test(await body()));

  // ---------- 4. Old-style deep link redirects to clean path ----------
  await page.goto(`${ADMIN}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  check("old /admin/* link on subdomain -> clean", page.url() === `${ADMIN}/dashboard`, page.url());

  // ---------- 5. Main-domain /admin bookmark -> subdomain ----------
  await page.goto(`${MAIN}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  check("main /admin/login -> subdomain /login", page.url() === `${ADMIN}/login`, page.url());

  // ---------- 6. Public site untouched on the main domain ----------
  await page.goto(`${MAIN}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const b2 = await body();
  check("main site homepage renders public chrome", /How it works/i.test(b2) && /Get quotes/i.test(b2));
  await page.goto(`${MAIN}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  check("main site /login is the customer login", (await page.locator('input[name="email"]').count()) === 1, page.url());

  check("no page errors across run", pageErrs.length === 0, pageErrs.join("; "));
} catch (e) {
  log("FATAL:", e.message);
  await page.screenshot({ path: SHOT("fatal"), fullPage: true }).catch(() => {});
  results.push({ n: "fatal", ok: false });
}

const fails = results.filter((r) => !r.ok);
log(`\n${results.length - fails.length}/${results.length} passed${fails.length ? " — FAILURES: " + fails.map((f) => f.n).join(", ") : ""}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
