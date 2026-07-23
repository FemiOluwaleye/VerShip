import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000";
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const SHOT = (n) => `/tmp/claude-1000/-home-runner-workspace/fae0fc25-8cd1-4387-8536-9e190ba93d7f/scratchpad/${n}.png`;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await browser.newPage();
let fails = 0;
const check = (name, ok, extra = "") => { console.log((ok ? "PASS" : "FAIL") + " — " + name + (extra ? " (" + extra + ")" : "")); if (!ok) fails++; };

// 1. open page, pick the barrel
await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: "networkidle" });
const orderBtn = page.locator("button, a").filter({ hasText: /order|choose|select/i }).first();
await orderBtn.click().catch(() => {});
await page.waitForTimeout(800);

// 2. fill the order form
await page.fill('input[name="firstName"]', "E2E");
await page.fill('input[name="lastName"]', "PayFlow");
await page.fill('input[name="email"]', `e2e-payflow-${Date.now()}@vership.test`);
await page.fill('input[name="phone"]', "4155550123");
await page.fill('input[name="recipient_name"]', "Test Recipient");
await page.fill('input[name="recipient_phone"]', "8765550123");
await page.fill('input[name="delivery_street"]', "1 Test Street");
await page.fill('input[name="delivery_town"]', "Kingston");
await page.selectOption('select[name="delivery_parish"]', "Kingston");
await page.click('form button[type="submit"]');

// 3. payment step should appear with the Stripe PaymentElement iframe
await page.waitForSelector("text=/complete payment/i", { timeout: 15000 }).catch(() => {});
const body = await page.textContent("body");
check("payment step shown (not instant success)", /complete payment/i.test(body) && !/your order is in/i.test(body));
check("order summary on payment step", /ORD-PP-/.test(body) && /899/.test(body));
const iframe = await page.waitForSelector('iframe[src*="stripe"], iframe[name^="__privateStripe"]', { timeout: 20000 }).catch(() => null);
check("Stripe PaymentElement iframe loaded", !!iframe);
const payBtn = await page.locator("button", { hasText: /^Pay \$/ }).count();
check("Pay button rendered with amount", payBtn > 0);
await page.screenshot({ path: SHOT("prepacked-payment-step"), fullPage: true });

await browser.close();
console.log(fails === 0 ? "ALL PASS" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
