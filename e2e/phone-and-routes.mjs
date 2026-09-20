// Phase 4/5 — Jamaican phone on Signup + full route regression across roles.
//   node e2e/phone-and-routes.mjs
import { chromium } from "@playwright/test";
import fs from "fs";
const BASE = "http://localhost:5000";
const SHOT = "/tmp/claude-1000/-home-runner-workspace/a0bc9e91-0a72-4c57-9899-404673d94818/scratchpad/shots";
fs.mkdirSync(SHOT, { recursive: true });
const say = (m) => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const failed = [];
const check = (name, ok, detail = "") => { if (ok) { pass++; say(`  ✅ ${name}${detail ? " — " + detail : ""}`); } else { failed.push(name); say(`  ❌ ${name}${detail ? " — " + detail : ""}`); } };

const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const IGNORE = [/Google Maps|places|maps\.googleapis/i, /favicon/i, /ResizeObserver loop/i, /React DevTools/i, /Future Flag/i, /stripe|Stripe|hcaptcha|errors\.stripe/i, /ERR_BLOCKED_BY_CLIENT/];
let consoleErrors = []; let netFailures = [];
page.on("console", (m) => { if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text()))) consoleErrors.push(m.text().slice(0, 160)); });
page.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && u.startsWith(BASE) && !IGNORE.some((x) => x.test(u))) netFailures.push(`${r.status()} ${u.replace(BASE, "").slice(0, 80)}`); });
const reset = () => { consoleErrors = []; netFailures = []; };
const logout = async () => { await page.goto(`${BASE}/about`, { waitUntil: "domcontentloaded" }); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await ctx.clearCookies(); };
const uiLogin = async (email, password, path = "/login") => {
  await logout(); await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await sleep(1500);
  if (path === "/login") { await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', password); await page.click('button[type="submit"]'); }
  else { await page.fill('input[placeholder="Email address"]', email); await page.fill('input[placeholder="Password"]', password); await page.click("button#login"); }
  await sleep(3500);
};
const visit = async (path, ms = 2500) => { reset(); await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await sleep(ms); return page.evaluate(() => document.body.innerText); };
const rendered = (b) => b.trim().length > 150 && !/Something went wrong|Unexpected Application Error/i.test(b);
const routeCheck = async (label, paths, ms) => {
  for (const p of paths) {
    const body = await visit(p, ms);
    const ok = rendered(body) && !consoleErrors.length && !netFailures.length;
    check(`${label} ${p}`, ok, ok ? "" : [!rendered(body) && "blank/error boundary", consoleErrors[0] && `console: ${consoleErrors[0]}`, netFailures[0] && `net: ${netFailures[0]}`].filter(Boolean).join("; "));
  }
};

// ── 4.1 Signup accepts 7 Jamaican digits ──
say("\n== 4.1 phone on Signup ==");
await logout();
await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" }); await sleep(2500);
const tel = page.locator("input[type=tel]").first();
const dialBtn = page.locator("input[type=tel]").first().locator("xpath=../div/button");
await dialBtn.click(); await sleep(300);
await page.fill('input[placeholder="Search country..."]', "Jamaica"); await sleep(300);
await page.locator("text=Jamaica").first().click(); await sleep(300);
const dial = await dialBtn.innerText();
check("4.1 Jamaica selected shows +1876", /\+1876/.test(dial), dial.replace(/\n/g, " "));
check("4.1 placeholder hints the 7-digit local format", /555 1234/.test(await tel.getAttribute("placeholder")), await tel.getAttribute("placeholder"));
await tel.fill("55512"); await tel.blur(); await sleep(400);
let err = await page.locator("p.text-red-400").filter({ hasText: /digit/ }).first().innerText().catch(() => "");
check("4.1 5 digits rejected with the +1876 hint", /Enter the 7-digit number after \+1876/.test(err), err);
await tel.fill("5551234"); await tel.blur(); await sleep(400);
err = await page.locator("p.text-red-400").filter({ hasText: /digit/ }).count();
check("4.1 7 digits accepted", err === 0);
await tel.fill("8765551234"); await tel.blur(); await sleep(400);
err = await page.locator("p.text-red-400").filter({ hasText: /digit/ }).count();
check("4.1 re-typed 876 prefix accepted (normalised)", err === 0);
await page.screenshot({ path: `${SHOT}/P4-signup-phone.png` });

// ── 5.1 routes ──
say("\n== 5.1 public routes ==");
await logout();
await routeCheck("public", ["/", "/forwarders", "/about", "/contact", "/faqs", "/terms", "/privacy", "/help", "/cookie-policy", "/refund-policy", "/prepacked-barrel", "/login", "/signup", "/type", "/forgot", "/account-setup?token=x"], 2200);
say("\n== 5.1 customer routes ==");
await uiLogin("e2e-user@vership.test", "Test@1234");
await routeCheck("customer", ["/", "/quotes-shipown", "/quotes", "/history", "/profile", "/edit", "/support", "/notifications", "/cards", "/chat"], 3000);
say("\n== 5.1 forwarder routes ==");
await uiLogin("e2e-provider@vership.test", "Test@1234");
await routeCheck("forwarder", ["/request", "/history", "/earning", "/businessProfile", "/businessedit", "/businessuploadnext", "/current", "/delivered", "/notifications"], 3000);
say("\n== 5.1 admin routes ==");
await uiLogin("e2e-admin@vership.test", "AdminTest123!", "/admin/login");
await routeCheck("admin", ["/admin/dashboard", "/admin/payouts", "/admin/pricing", "/admin/providerlist", "/admin/activeridelist", "/admin/bookingcompleted", "/admin/userlist", "/admin/prepackedorders"], 3500);

await browser.close();
say(`\n${pass} passed, ${failed.length} failed${failed.length ? ": " + failed.join("; ") : ""}`);
process.exit(failed.length ? 1 : 0);
