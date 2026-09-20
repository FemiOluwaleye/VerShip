// Phase 3 visual acceptance — guest checkout in a real browser (Stripe test mode).
//   A. logged-out visitor gets quotes
//   B. guest pays → account created (pending password) → sets password on the success page → can log in
//   C. guest with an existing email → inline "Welcome back" sign-in → booking lands on that account
//   D. guest skips the password → receipt email carries a working 24h link; expired link errors
// Server must run with MAIL_PREVIEW_DIR set so the receipt email lands on disk.
//   node e2e/guest.mjs
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "fs";
const require = createRequire(import.meta.url);
process.chdir("/home/runner/workspace/server");
const db = require("/home/runner/workspace/server/models");

const BASE = "http://localhost:5000";
const SHOT = "/tmp/claude-1000/-home-runner-workspace/a0bc9e91-0a72-4c57-9899-404673d94818/scratchpad/shots";
const MAIL = process.env.MAIL_PREVIEW_DIR || "/tmp/claude-1000/-home-runner-workspace/a0bc9e91-0a72-4c57-9899-404673d94818/scratchpad/mail";
fs.mkdirSync(SHOT, { recursive: true });
const say = (m) => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const failed = [];
const check = (name, ok, detail = "") => { if (ok) { pass++; say(`  ✅ ${name}${detail ? " — " + detail : ""}`); } else { failed.push(name); say(`  ❌ ${name}${detail ? " — " + detail : ""}`); } };

const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const logout = async () => { await page.goto(`${BASE}/about`, { waitUntil: "domcontentloaded" }); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await ctx.clearCookies(); };
const setDate = async (label, iso) => page.locator(`input[aria-label="${label}"]`).evaluate((el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
}, iso);
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const landingToQuotes = async () => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }); await sleep(2500);
  await page.click('button[aria-label="Select origin"]'); await page.click('ul[aria-label="Origin"] button:has-text("Pittsburgh, PA")');
  await page.click('button[aria-label="Select destination"]'); await page.click('ul[aria-label="Destination"] button:has-text("St. Andrew")');
  await page.fill('input[aria-label="Number of barrels"]', "1");
  await setDate("Pickup date", d(3)); await setDate("Delivery date", d(20));
  await page.locator("#booking-form").getByRole("button", { name: "Get quotes" }).click();
  await page.waitForURL("**/quotes-shipown", { timeout: 20000 }); await sleep(4000);
};
const fillCheckout = async (email) => {
  await page.fill('[data-testid="s-first"]', "Guest"); await page.fill('[data-testid="s-last"]', "Shipper");
  await page.fill('[data-testid="s-email"]', email);
  await page.locator('[data-testid="section-shipper"] input[type=tel]').fill("4125550199");
  await page.fill('[data-testid="s-address"]', "100 Grant St"); await page.fill('[data-testid="s-city"]', "Pittsburgh"); await page.fill('[data-testid="s-state"]', "PA");
  await page.fill('[data-testid="r-first"]', "Elvis"); await page.fill('[data-testid="r-last"]', "Livingston");
  await page.locator('[data-testid="section-recipient"] input[type=tel]').fill("5551234");
  await page.fill('[data-testid="r-address"]', "15 Molynes Road"); await page.fill('[data-testid="r-city"]', "Kingston 10");
  await page.selectOption('[data-testid="r-parish"]', "St. Andrew"); await sleep(1500);
};
const fillCard = async (number) => {
  const f = page.frameLocator('iframe[title="Secure payment input frame"]').first();
  await f.locator('input[name="number"]').fill(number); await f.locator('input[name="expiry"]').fill("12 / 34"); await f.locator('input[name="cvc"]').fill("123");
  const zip = f.locator('input[name="postalCode"]'); if (await zip.count()) await zip.fill("15222");
};
const toastText = async () => (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).join(" | ");

// ── A ──
say("\n== A. guest quotes ==");
await logout();
await landingToQuotes();
check("A. logged-out visitor lands on quotes, not /login", page.url().includes("/quotes-shipown"));
check("A. quote cards rendered", (await page.locator('[data-testid^="quote-card-"]').count()) >= 1);
await page.screenshot({ path: `${SHOT}/P3-A-guest-quotes.png`, fullPage: true });

// ── B ──
say("\n== B. guest pays and secures the account ==");
const emailB = `guest-${Date.now()}@vership.test`;
await page.locator('[data-testid="continue-checkout"]').click();
await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
check("B. guest note under the pay button", /create your VerShip account/.test(await page.evaluate(() => document.body.innerText)));
await fillCheckout(emailB);
await page.screenshot({ path: `${SHOT}/P3-B1-guest-checkout.png`, fullPage: true });
await fillCard("4242424242424242");
await page.locator('[data-testid="pay-now"]').click();
await page.waitForURL("**/checkout/success", { timeout: 60000 }).catch(() => {});
await sleep(3000);
check("B. guest payment → success page", page.url().includes("/checkout/success"), await toastText());
const userB = await db.users.findOne({ where: { email: emailB } });
const bookingB = userB ? await db.bookings.findOne({ where: { userId: userB.id } }) : null;
const depB = bookingB ? await db.booking_charges.findOne({ where: { booking_id: bookingB.id, kind: "deposit" } }) : null;
check("B. account created pending_password with the booking attached", userB?.account_state === "pending_password" && !!bookingB && depB?.status === "paid", `${userB?.account_state} ${depB?.status}`);
check("B. shipper phone stored normalised", userB?.phoneNumber === "4125550199" && userB?.countryCode === "+1", `${userB?.countryCode} ${userB?.phoneNumber}`);
check("B. success page offers Secure your account", (await page.locator('[data-testid="account-setup"]').count()) === 1);
await page.screenshot({ path: `${SHOT}/P3-B2-guest-success.png`, fullPage: true });
await page.fill('[data-testid="setup-password"]', "GuestPass123!"); await page.fill('[data-testid="setup-password2"]', "GuestPass123!");
await page.locator('[data-testid="setup-save"]').click(); await sleep(3000);
check("B. password saved confirmation", (await page.locator('[data-testid="account-ready"]').count()) === 1);
await userB.reload();
check("B. account active + email verified", userB.account_state === "active" && userB.otpVerify === "1");
await logout();
await page.goto(`${BASE}/login`); await page.fill('input[name="email"]', emailB); await page.fill('input[name="password"]', "GuestPass123!"); await page.click('button[type="submit"]'); await sleep(4000);
check("B. can log in with the new password", !page.url().endsWith("/login"), page.url().replace(BASE, ""));
await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
check("B. History shows the guest's booking", (await page.locator(`[data-testid="booking-card-${bookingB.id}"]`).count()) === 1);
await page.screenshot({ path: `${SHOT}/P3-B3-guest-history.png`, fullPage: true });

// ── C ──
say("\n== C. existing email → inline sign-in ==");
await logout();
await landingToQuotes();
await page.locator('[data-testid="continue-checkout"]').click();
await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
await fillCheckout("e2e-user@vership.test");
await fillCard("4242424242424242");
await page.locator('[data-testid="pay-now"]').click(); await sleep(5000);
check("C. Welcome back prompt shown, nothing charged", (await page.locator('[data-testid="welcome-back"]').count()) === 1 && page.url().includes("/checkout"));
await page.screenshot({ path: `${SHOT}/P3-C1-welcome-back.png` });
const before = await db.bookings.count({ where: { userId: (await db.users.findOne({ where: { email: "e2e-user@vership.test" } })).id } });
await page.fill('[data-testid="inline-password"]', "Test@1234");
await page.locator('[data-testid="inline-login"]').click();
await page.waitForURL("**/checkout/success", { timeout: 60000 }).catch(() => {});
await sleep(3000);
const after = await db.bookings.count({ where: { userId: (await db.users.findOne({ where: { email: "e2e-user@vership.test" } })).id } });
check("C. signed in and paid; booking on the existing account", page.url().includes("/checkout/success") && after === before + 1, `${before} → ${after} ${await toastText()}`);
check("C. no account-setup prompt for the member", (await page.locator('[data-testid="account-setup"]').count()) === 0);
await page.screenshot({ path: `${SHOT}/P3-C2-member-success.png` });

// ── D ──
say("\n== D. skipped password → email link ==");
await logout();
const emailD = `guest-${Date.now()}-d@vership.test`;
await landingToQuotes();
await page.locator('[data-testid="continue-checkout"]').click();
await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
await fillCheckout(emailD);
await fillCard("4242424242424242");
await page.locator('[data-testid="pay-now"]').click();
await page.waitForURL("**/checkout/success", { timeout: 60000 }).catch(() => {});
await sleep(4000);
const userD = await db.users.findOne({ where: { email: emailD } });
const mailFile = fs.readdirSync(MAIL).map((f) => `${MAIL}/${f}`).filter((f) => f.endsWith(".html") && fs.readFileSync(f, "utf8").includes(`to: ${emailD}`)).pop();
check("D. receipt email generated for the guest", !!mailFile, mailFile || "none");
const link = mailFile ? (fs.readFileSync(mailFile, "utf8").match(/href="([^"]*account-setup\?token=[^"]+)"/) || [])[1] : null;
check("D. receipt contains a set-password link", !!link, (link || "").slice(0, 60));
await logout();
await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "domcontentloaded" }); await sleep(2500);
await page.fill('[data-testid="setup-password"]', "LinkPass123!"); await page.fill('[data-testid="setup-password2"]', "LinkPass123!");
await page.locator('[data-testid="setup-save"]').click(); await sleep(4000);
await userD.reload();
check("D. link sets the password and signs the user in", userD.account_state === "active" && page.url().includes("/history"), page.url().replace(BASE, ""));
await page.screenshot({ path: `${SHOT}/P3-D1-link-setup.png` });
await logout();
await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "domcontentloaded" }); await sleep(2000);
await page.fill('[data-testid="setup-password"]', "Again123!"); await page.fill('[data-testid="setup-password2"]', "Again123!");
await page.locator('[data-testid="setup-save"]').click(); await sleep(3000);
check("D. reused/expired link shows a clear error", /expired|no longer valid|already has a password/i.test(await page.locator('[data-testid="setup-error"]').innerText().catch(() => "")));
await page.screenshot({ path: `${SHOT}/P3-D2-link-expired.png` });

await browser.close();
say(`\n${pass} passed, ${failed.length} failed${failed.length ? ": " + failed.join("; ") : ""}\nscreenshots: ${SHOT}/P3-*.png`);
process.exit(failed.length ? 1 : 0);
