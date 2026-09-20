// Admin booking detail shows the Pay-as-you-go charge rows (2.6).
import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000"; const SHOT = "/tmp/claude-1000/-home-runner-workspace/a0bc9e91-0a72-4c57-9899-404673d94818/scratchpad/shots";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await page.goto(`${BASE}/admin/login`); await sleep(1500);
await page.fill('input[placeholder="Email address"]', "e2e-admin@vership.test"); await page.fill('input[placeholder="Password"]', "AdminTest123!"); await page.click("button#login"); await sleep(3500);
await page.goto(`${BASE}/admin/activeridelist`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const btn = page.locator('table tbody tr').first().locator('button[data-bs-target="#view-details"]');
console.log("view button present:", await btn.count());
await btn.evaluate((b) => b.click()); await sleep(2500);
const txt = await page.evaluate(() => document.querySelector("#view-details")?.textContent || "NO OFFCANVAS");
console.log("Payments section present:", /Payments/.test(txt), "| deposit line:", /Deposit \(sea freight/.test(txt), "| customs:", /Customs & delivery/.test(txt), "| status label:", /Arrived in Jamaica|Shipped|Delivered/.test(txt));
await page.screenshot({ path: `${SHOT}/P2-F-admin-booking-detail.png`, fullPage: true });
await browser.close();
