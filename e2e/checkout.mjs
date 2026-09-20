// Phase 2 visual acceptance — the new one-page checkout in a real browser (Stripe test mode).
//   A. quote → checkout in one click; side-by-side layout; no Secondary Contact; heading + blurb;
//      Due now / Estimated later match the server; pay with 4242 → success page
//   B. 390px: stacked, no horizontal scroll
//   C. 3DS card authenticates; declined card errors and nothing is marked paid
//   D. forwarder marks Arrived → customer History shows customs due → pays → Paid
//   E. forwarder "Additional Cost" still works and shows under Payments
//   node e2e/checkout.mjs
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "fs";
const require = createRequire(import.meta.url);
process.chdir("/home/runner/workspace/server");
const db = require("/home/runner/workspace/server/models");

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
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error" && !/favicon|maps|places|ResizeObserver|stripe|Stripe/i.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); });
const toastText = async () => (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).join(" | ");

const uiLogin = async (email, password) => {
  await ctx.clearCookies(); await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]'); await sleep(3500);
};
const setDate = async (label, iso) => page.locator(`input[aria-label="${label}"]`).evaluate((el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
}, iso);
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const landingToQuotes = async (parish = "Kingston", qty = "1") => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }); await sleep(2500);
  await page.click('button[aria-label="Select origin"]'); await page.click('ul[aria-label="Origin"] button:has-text("Pittsburgh, PA")');
  await page.click('button[aria-label="Select destination"]'); await page.click(`ul[aria-label="Destination"] button:has-text("${parish}")`);
  await page.fill('input[aria-label="Number of barrels"]', qty);
  await setDate("Pickup date", d(3)); await setDate("Delivery date", d(20));
  await page.locator("#booking-form").getByRole("button", { name: "Get quotes" }).click();
  await page.waitForURL("**/quotes-shipown", { timeout: 20000 }); await sleep(4000);
};
const fillCheckout = async ({ shipperEmail = "e2e-user@vership.test" } = {}) => {
  await page.fill('[data-testid="s-first"]', "Jane"); await page.fill('[data-testid="s-last"]', "Doe");
  await page.fill('[data-testid="s-email"]', shipperEmail);
  await page.locator('[data-testid="section-shipper"] input[type=tel]').fill("4125550123");
  await page.fill('[data-testid="s-address"]', "100 Grant St"); await page.fill('[data-testid="s-city"]', "Pittsburgh"); await page.fill('[data-testid="s-state"]', "PA");
  await page.fill('[data-testid="r-first"]', "Elvis"); await page.fill('[data-testid="r-last"]', "Livingston");
  await page.locator('[data-testid="section-recipient"] input[type=tel]').fill("5551234"); // 7 digits with +1876
  await page.fill('[data-testid="r-address"]', "15 Molynes Road"); await page.fill('[data-testid="r-city"]', "Kingston 10");
  await page.selectOption('[data-testid="r-parish"]', "St. Andrew");
  await sleep(1500);
};
const stripeFrame = () => page.frameLocator('iframe[title="Secure payment input frame"]').first();
const fillCard = async (number) => {
  const f = stripeFrame();
  await f.locator('input[name="number"]').fill(number);
  await f.locator('input[name="expiry"]').fill("12 / 34");
  await f.locator('input[name="cvc"]').fill("123");
  const zip = f.locator('input[name="postalCode"]');
  if (await zip.count()) await zip.fill("15222");
};
const complete3DS = async () => {
  // Stripe's test 3DS challenge renders in nested iframes; the button is "Complete".
  for (let i = 0; i < 20; i++) {
    for (const fr of page.frames()) {
      const btn = fr.locator('#test-source-authorize-3ds, button:has-text("Complete authentication"), button:has-text("Complete")');
      if (await btn.count().catch(() => 0)) { await btn.first().click().catch(() => {}); return true; }
    }
    await sleep(1000);
  }
  return false;
};

// ─────────────────────────── A. logged-in happy path ───────────────────────────
say("\n== A. quote → checkout → pay ==");
await uiLogin("e2e-user@vership.test", "Test@1234");
await landingToQuotes("Kingston", "1");
check("A. quotes page has a Continue to checkout under the selected quote", (await page.locator('[data-testid="continue-checkout"]').count()) === 1);
check("A. old form sections are gone from the quotes page", !/Secondary Contact|Add Shipper Address|Recipient Contact Information/.test(await page.evaluate(() => document.body.innerText)));
await page.screenshot({ path: `${SHOT}/P2-A1-quotes.png`, fullPage: true });
await page.locator('[data-testid="continue-checkout"]').click();
await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
const body = await page.evaluate(() => document.body.innerText);
check("A. heading 'Pay as Your Shipment Moves'", /Pay as Your Shipment Moves/.test(body));
check("A. blurb present", /you will receive a notification when each payment is required/.test(body));
check("A. no Secondary Contact anywhere", !/Secondary Contact/i.test(body));
const layout = await page.evaluate(() => {
  const left = document.querySelector('[data-testid="section-shipper"]').getBoundingClientRect();
  const right = document.querySelector('[data-testid="payment-panel"]').getBoundingClientRect();
  const pe = document.querySelector('[data-testid="payment-element"]').getBoundingClientRect();
  return { leftX: left.left, rightX: right.left, rightTop: right.top + window.scrollY, leftTop: left.top + window.scrollY, peTop: pe.top, vh: window.innerHeight };
});
check("A. recipient and payment side by side", layout.rightX > layout.leftX + 300 && Math.abs(layout.rightTop - layout.leftTop) < 400, JSON.stringify(layout));
check("A. Payment Element visible without scrolling", layout.peTop < layout.vh, `top ${Math.round(layout.peTop)} < ${layout.vh}`);
await fillCheckout();
await sleep(1500);
// figures must match the server
const token = await page.evaluate(() => localStorage.getItem("token"));
const reqRow = await db.booking_requests.findOne({ where: { userId: (await db.users.findOne({ where: { email: "e2e-user@vership.test" } })).id }, order: [["id", "DESC"]] });
const pid = await page.evaluate(() => JSON.parse(sessionStorage.getItem("checkout_state")).providerId);
const bd = await (await fetch(`${BASE}/website/quote-breakdown?requestId=${reqRow.id}&providerId=${pid}&parish=St.%20Andrew`, { headers: { Authorization: `Bearer ${token}` } })).json();
const dueNowUi = await page.locator('[data-testid="due-now-total"]').innerText();
const laterUi = (await page.locator('[data-testid="later-lines"]').innerText().catch(() => "")).replace(/\s+/g, " ");
check("A. Due now matches server", dueNowUi === `$${bd.body.dueNow.total.toFixed(2)}`, `${dueNowUi} vs $${bd.body.dueNow.total}`);
check("A. Estimated later matches server", laterUi.includes(`$${bd.body.later.total.toFixed(2)}`), `${laterUi} vs $${bd.body.later.total}`);
check("A. later is customs & delivery only", /Customs & delivery/.test(laterUi) && !/Sea freight/.test(laterUi));
await page.screenshot({ path: `${SHOT}/P2-A2-checkout-filled.png`, fullPage: true });
await fillCard("4242424242424242");
await page.locator('[data-testid="pay-now"]').click();
await page.waitForURL("**/checkout/success", { timeout: 60000 }).catch(() => {});
await sleep(3000);
check("A. landed on success page", page.url().includes("/checkout/success"), page.url().replace(BASE, "") + " " + (await toastText()));
const successText = await page.evaluate(() => document.body.innerText);
const bookingA = await db.bookings.findOne({ where: { booking_request_id: reqRow.id } });
const depA = await db.booking_charges.findOne({ where: { booking_id: bookingA?.id, kind: "deposit" } });
const cdA = await db.booking_charges.findOne({ where: { booking_id: bookingA?.id, kind: "customs_delivery" } });
check("A. deposit paid in DB, customs pending", depA?.status === "paid" && cdA?.status === "pending" && String(bookingA?.payment_status) === "1", `${depA?.status}/${cdA?.status}`);
check("A. success page shows what's paid and what's later", /paid \$/.test(successText) && /Arrives in Jamaica/.test(successText) && /customs & delivery becomes due/.test(successText));
check("A. no account-setup prompt for an existing member", !/Secure your account/.test(successText));
await page.screenshot({ path: `${SHOT}/P2-A3-success.png`, fullPage: true });

// ─────────────────────────── B. mobile ───────────────────────────
say("\n== B. 390px ==");
await page.setViewportSize({ width: 390, height: 844 });
await landingToQuotes("Kingston", "1");
await page.locator('[data-testid="continue-checkout-bottom"]').click();
await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
const mob = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth, vw: window.innerWidth,
  leftX: document.querySelector('[data-testid="section-recipient"]').getBoundingClientRect().left,
  rightTop: document.querySelector('[data-testid="payment-panel"]').getBoundingClientRect().top + window.scrollY,
  leftBottom: document.querySelector('[data-testid="section-recipient"]').getBoundingClientRect().bottom + window.scrollY,
}));
check("B. no horizontal scroll", mob.scrollW <= mob.vw + 1, `${mob.scrollW} vs ${mob.vw}`);
check("B. payment panel stacks below the forms", mob.rightTop > mob.leftBottom - 5);
await page.screenshot({ path: `${SHOT}/P2-B-mobile-top.png` });
await page.locator('[data-testid="payment-panel"]').scrollIntoViewIfNeeded(); await sleep(500);
await page.screenshot({ path: `${SHOT}/P2-B-mobile-payment.png` });
await page.setViewportSize({ width: 1400, height: 1000 });

// ─────────────────────────── C. 3DS + declined ───────────────────────────
say("\n== C. 3DS and declined cards ==");
await landingToQuotes("Kingston", "1");
await page.locator('[data-testid="continue-checkout"]').click();
await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
await fillCheckout();
await fillCard("4000000000009995");
await page.locator('[data-testid="pay-now"]').click(); await sleep(8000);
const declinedToast = await toastText();
check("C. declined card shows an error and stays on checkout", page.url().includes("/checkout") && !page.url().includes("success") && /declin|insufficient/i.test(declinedToast), declinedToast.slice(0, 80));
const reqC = await db.booking_requests.findOne({ where: { userId: bookingA.userId }, order: [["id", "DESC"]] });
const bkC = await db.bookings.findOne({ where: { booking_request_id: reqC.id } });
check("C. nothing marked paid after decline", String(bkC?.payment_status) !== "1");
await page.screenshot({ path: `${SHOT}/P2-C1-declined.png` });
await fillCard("4000002500003155");
await page.locator('[data-testid="pay-now"]').click(); await sleep(6000);
const auth = await complete3DS();
await page.waitForURL("**/checkout/success", { timeout: 60000 }).catch(() => {});
await sleep(3000);
check("C. 3DS challenge shown and completed → success", auth && page.url().includes("/checkout/success"), page.url().replace(BASE, "") + " " + (await toastText()));
await page.screenshot({ path: `${SHOT}/P2-C2-3ds-success.png` });

// ─────────────────────────── D. Arrived → customs due → pay ───────────────────────────
say("\n== D. arrival milestone ==");
// bookingA went to whichever forwarder was the best quote; log in as that one (seeded test accounts share Test@1234).
const fwdUser = await db.users.findByPk(bookingA.driverId);
await uiLogin(fwdUser.email, "Test@1234");
await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const cardEl = page.locator(`[data-testid="booking-card-${bookingA.id}"]`);
await cardEl.scrollIntoViewIfNeeded().catch(() => {});
const sel = cardEl.locator("select");
check("D. forwarder status select offers Arrived in Jamaica", (await sel.locator('option[value="5"]').count()) === 1);
await sel.selectOption("5"); await sleep(3000);
await bookingA.reload();
const cdA2 = await db.booking_charges.findByPk(cdA.id);
check("D. booking status 5 and customs charge due", String(bookingA.status) === "5" && !!cdA2.due_at, `status=${bookingA.status} due_at=${cdA2.due_at}`);
await page.screenshot({ path: `${SHOT}/P2-D1-forwarder-arrived.png`, fullPage: true });
await uiLogin("e2e-user@vership.test", "Test@1234");
await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const payBtn = page.locator(`[data-testid="pay-charge-${cdA.id}"]`);
check("D. customer History shows customs & delivery due with Pay Now", (await payBtn.count()) === 1 && /Due now/.test(await page.locator(`[data-testid="charges-${bookingA.id}"]`).innerText()));
await payBtn.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOT}/P2-D2-customer-due.png` });
await payBtn.click(); await sleep(6000);
await fillCard("4242424242424242");
await page.locator('form button[type="submit"], button:has-text("Pay $")').last().click(); await sleep(10000);
const cdA3 = await db.booking_charges.findByPk(cdA.id);
check("D. customs & delivery paid", cdA3.status === "paid", cdA3.status + " " + (await toastText()));
await page.screenshot({ path: `${SHOT}/P2-D3-customer-paid.png`, fullPage: true });

// ─────────────────────────── E. forwarder extra cost ───────────────────────────
say("\n== E. forwarder extra ==");
await uiLogin(fwdUser.email, "Test@1234");
await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
await page.locator('button:has-text("+ Additional Cost")').first().click(); await sleep(800);
await page.locator('input[placeholder="e.g. 25.00"]').fill("12.50");
await page.locator('[placeholder="e.g. Storage fee — barrels held over 14 days"]').fill("Storage 3 days");
await page.locator('.fixed button.bg-\\[\\#FFC928\\]').last().click(); await sleep(3000);
const extra = await db.booking_charges.findOne({ where: { kind: "extra", description: "Storage 3 days" }, order: [["id", "DESC"]] });
check("E. extra cost created as a booking charge", !!extra && extra.amount_cents === 1250, `${extra?.amount_cents}`);
const histText = await page.evaluate(() => document.body.innerText);
check("E. extra shows under Payments as Unpaid", /Storage 3 days/.test(histText) && /Unpaid/.test(histText));
await page.screenshot({ path: `${SHOT}/P2-E-extra.png`, fullPage: true });

check("no console errors across the run", consoleErrors.length === 0, consoleErrors[0] || "");
await browser.close();
say(`\n${pass} passed, ${failed.length} failed${failed.length ? ": " + failed.join("; ") : ""}\nscreenshots: ${SHOT}/P2-*.png`);
process.exit(failed.length ? 1 : 0);
