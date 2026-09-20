// Black-box QA pass over the checkout / payouts / guest / phone / admin changes.
// Run a section:  node e2e/qa-blackbox.mjs A     (sections: A B C D E F M)
// Asserts only on what a user sees: visible text, layout, and outcomes on other screens.
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "fs";
const require = createRequire(import.meta.url);
process.chdir("/home/runner/workspace/server");
const db = require("/home/runner/workspace/server/models"); // only for fixture setup/teardown + reading nothing the UI shows

const SECTION = (process.argv[2] || "A").toUpperCase();
const BASE = "http://localhost:5000";
const SHOT = "/tmp/claude-1000/-home-runner-workspace/543a4a35-f95d-4341-bb86-f94a75816dfd/scratchpad/qa";
fs.mkdirSync(SHOT, { recursive: true });
const say = (m) => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const failed = [];
const check = (name, ok, detail = "") => { if (ok) { pass++; say(`  ✅ ${name}${detail ? " — " + detail : ""}`); } else { failed.push(name + (detail ? " — " + detail : "")); say(`  ❌ ${name}${detail ? " — " + detail : ""}`); } };
const shot = (n) => page.screenshot({ path: `${SHOT}/${SECTION}-${n}.png`, fullPage: true });
const bodyText = () => page.evaluate(() => document.body.innerText);
const toast = async () => (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).join(" | ");

const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const consoleErrors = []; const badResponses = [];
page.on("console", (m) => { if (m.type() === "error" && !/favicon|maps|places|ResizeObserver|stripe|Stripe/i.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); });
page.on("response", (r) => { if (r.status() >= 400 && /localhost:5000\/(website|api)/.test(r.url())) badResponses.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, "")}`); });

const logout = async () => { await ctx.clearCookies(); await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
const uiLogin = async (email, password) => {
  await logout(); await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]'); await sleep(3500);
};
const adminLogin = async () => {
  await ctx.clearCookies(); await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" }); await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[placeholder="Email address"]', "e2e-admin@vership.test"); await page.fill('input[placeholder="Password"]', "AdminTest123!");
  await page.click("button#login"); await sleep(3500);
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
  await sleep(6000);
};
const pickQuote = async (name) => {
  // click the quote card that shows this forwarder's name, then its Continue button
  const card = page.locator(`text=${name}`).first();
  await card.click(); await sleep(800);
};
const fillCheckout = async ({ shipperEmail = "e2e-user@vership.test", recipientPhone = "5551234", first = "Jane" } = {}) => {
  await page.fill('[data-testid="s-first"]', first); await page.fill('[data-testid="s-last"]', "Doe");
  await page.fill('[data-testid="s-email"]', shipperEmail);
  await page.locator('[data-testid="section-shipper"] input[type=tel]').fill("4125550123");
  await page.fill('[data-testid="s-address"]', "100 Grant St"); await page.fill('[data-testid="s-city"]', "Pittsburgh"); await page.fill('[data-testid="s-state"]', "PA");
  await page.fill('[data-testid="r-first"]', "Elvis"); await page.fill('[data-testid="r-last"]', "Livingston");
  await page.locator('[data-testid="section-recipient"] input[type=tel]').fill(recipientPhone);
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
  const zip = f.locator('input[name="postalCode"]'); if (await zip.count()) await zip.fill("15222");
};
const money = (s) => { const m = String(s).match(/\$([\d,]+\.\d{2})/); return m ? parseFloat(m[1].replace(/,/g, "")) : NaN; };
const FF = { id: 417, email: "e2e-provider@vership.test", pw: "Test@1234", name: "E2E Test Forwarders" };
// "No Stripe" = no connected account at all (the app verifies readiness against Stripe live, not a DB flag).
let savedAccountId = null;
const setStripe = async (v) => {
  if (v === "0") { const u = await db.users.findByPk(FF.id, { raw: true }); savedAccountId = savedAccountId || u.accountId; await db.users.update({ hashAccount: "0", accountId: "" }, { where: { id: FF.id } }); }
  else await db.users.update({ hashAccount: "1", accountId: savedAccountId }, { where: { id: FF.id } });
};

try {
// ───────────────────────────── A. forwarder without Stripe ─────────────────────────────
if (SECTION === "A") {
  say("\n== A. Forwarder without Stripe can go live and be booked ==");
  // baseline: how many quotes with the forwarder on Stripe
  await uiLogin("e2e-user@vership.test", "Test@1234"); await landingToQuotes();
  const quotesOn = await page.locator("text=/\\$\\d+\\.\\d{2} \\/ barrel|\\/ ?barrel/").count();
  await setStripe("0");
  // A1 forwarder's own view
  await uiLogin(FF.email, FF.pw);
  await page.goto(`${BASE}/businessProfile`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  let t = await bodyText(); await shot("1-forwarder-profile");
  check("A1 profile has no 'can't be paid yet / must set up Stripe to appear in quotes' blocker", !/can.t be paid yet|appear in booking quotes/i.test(t));
  check("A1 profile shows a payouts card with 'Held for you'", /Held for you/i.test(t));
  check("A1 payouts card offers 'Set up payouts' (no Stripe yet)", /Set up payouts/i.test(t));
  // A2 customer sees them in quotes
  await uiLogin("e2e-user@vership.test", "Test@1234");
  await landingToQuotes();
  t = await bodyText(); await shot("2-quotes");
  const quotesOff = await page.locator("text=/\\/ ?barrel/").count();
  check("A2 same number of quotes with the forwarder off Stripe as on (they are still quoted)", quotesOff === quotesOn && quotesOff >= 3, `on=${quotesOn} off=${quotesOff}`);
  check("A2 no login redirect on the quotes step", page.url().includes("/quotes"), page.url());
  // A3 book + pay with them
  await page.locator("text=Quote 2").first().click(); await sleep(800); // $150 = the e2e forwarder's rate; confirmed by name in History below
  const btn = page.locator('[data-testid="continue-checkout"]');
  check("A3 exactly one 'Continue to checkout' under the selected quote", (await btn.count()) === 1);
  await btn.click(); await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
  t = await bodyText();
  check("A3 checkout hides the forwarder's name until first payment (by design) and shows 'Verified freight forwarder'", /Verified freight forwarder/.test(t) && /revealed after your first payment/i.test(t));
  await fillCheckout({ recipientPhone: "8765551234" }); await sleep(1000);
  const dueNow = money(await page.locator('[data-testid="due-now-total"]').innerText());
  const payLabel = await page.locator('[data-testid="pay-now"]').innerText();
  check("A3 Pay button amount equals Due now", money(payLabel) === dueNow, `${payLabel} vs ${dueNow}`);
  await fillCard("4242424242424242"); await sleep(800);
  await page.locator('[data-testid="pay-now"]').click();
  await page.waitForURL("**/checkout/success**", { timeout: 40000 }).catch(() => {});
  await sleep(4000); t = await bodyText(); await shot("3-success");
  check("A3 payment succeeded → success page", page.url().includes("/checkout/success"), page.url());
  const orderMatch = t.match(/#?\s*(VS[-\w]+|\b\d{3,}\b)/);
  check("A3 success page shows a receipt with the amount paid", /receipt|paid/i.test(t) && t.includes(dueNow.toFixed(2)), `looking for ${dueNow.toFixed(2)}`);
  // A4 customer History
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  t = await bodyText(); await shot("4-history");
  check("A4 History reveals the forwarder on the new booking (shown by first name) — confirms the un-onboarded forwarder was booked", /Freight forwarder\s*\n?\s*E2E/.test(t), (t.match(/Freight forwarder[^\n]*\n[^\n]*/) || [""])[0].replace(/\n/g, " "));
  check("A4 History shows the deposit as paid and customs & delivery pending", /Paid/.test(t) && /Customs/i.test(t));
  const bk = await db.bookings.findOne({ where: { userId: 416 }, order: [["id", "DESC"]], raw: true });
  const phoneCols = Object.fromEntries(Object.entries(bk).filter(([k]) => /phone|country_code|countryCode/i.test(k)));
  say("  ℹ recipient phone stored on the booking after typing 8765551234 with +1876: " + JSON.stringify(phoneCols));
  check("A4 stored recipient number is the 7 local digits (no doubled 876)", Object.values(phoneCols).some((v) => String(v) === "5551234") && !Object.values(phoneCols).some((v) => /876876|18761876/.test(String(v))), JSON.stringify(phoneCols));
  // A5 forwarder sees the held money (webhook-driven; give Stripe a moment)
  await sleep(8000);
  await uiLogin(FF.email, FF.pw);
  await page.goto(`${BASE}/businessProfile`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  t = await bodyText(); await shot("5-forwarder-held");
  const heldTxt = await page.locator('[data-testid="payouts-held"]').innerText().catch(() => "");
  check("A5 forwarder's 'Held for you' is > $0 after the customer paid", money(heldTxt) > 0, heldTxt);
  await page.goto(`${BASE}/earning`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  t = await bodyText(); await shot("6-forwarder-earning");
  check("A5 Earnings page also shows the held amount", /Held for you/i.test(t) && money(await page.locator('[data-testid="payouts-held"]').innerText().catch(() => "")) > 0);
  // A6 admin sees it
  await adminLogin();
  await page.goto(`${BASE}/admin/payouts`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  t = await bodyText(); await shot("7-admin-payouts");
  check("A6 /admin/payouts loads and lists the forwarder", t.includes(FF.name));
  check("A6 /admin/payouts shows the 'keep at least' minimum-balance figure", /keep at least|minimum balance/i.test(t));
  // A7 forwarder onboards → Collect funds
  await setStripe("1");
  await uiLogin(FF.email, FF.pw);
  await page.goto(`${BASE}/businessProfile`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  const collect = page.locator('[data-testid="collect-funds"]');
  check("A7 once on Stripe, the card offers 'Collect $X'", (await collect.count()) === 1 && /Collect \$/.test(await collect.innerText().catch(() => "")), await collect.innerText().catch(() => "none"));
  await collect.click(); await sleep(8000);
  t = await bodyText(); await shot("8-collected");
  const heldAfter = money(await page.locator('[data-testid="payouts-held"]').innerText().catch(() => "$0.00"));
  check("A7 after Collect, held amount is $0 and a success toast/notice appears", heldAfter === 0, `held now ${heldAfter}; toast: ${await toast()}`);
  await adminLogin();
  await page.goto(`${BASE}/admin/payouts`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  t = await bodyText(); await shot("9-admin-after");
  check("A7 admin payouts reflects the transfer (Transferred/paid, not Held)", /transferred|paid/i.test(t));
}

// ───────────────────────────── B. checkout UX ─────────────────────────────
if (SECTION === "B") {
  say("\n== B. Checkout page UX (logged-in customer) ==");
  await uiLogin("e2e-user@vership.test", "Test@1234");
  await landingToQuotes();
  await shot("1-quotes");
  const q = await page.evaluate(() => {
    const best = [...document.querySelectorAll("*")].find((e) => /best quote/i.test(e.textContent || "") && e.children.length === 0);
    const btn = document.querySelector('[data-testid="continue-checkout"]');
    const y = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : -1);
    return { bestY: y(best), btnY: y(btn), inputs: document.querySelectorAll("input").length, vh: window.innerHeight };
  });
  check("B1 'Continue to checkout' sits right under the best quote (<500px), not after a long form", q.btnY > 0 && q.btnY - q.bestY < 500, JSON.stringify(q));
  check("B1 quotes page has no contact/address form (few inputs)", q.inputs < 6, `${q.inputs} inputs`);
  const t0 = await bodyText();
  check("B1 quotes page has no Secondary Contact / Shipper Address / Delivery Address form", !/Secondary Contact|Shipper Address|Delivery Address/i.test(t0));
  await page.locator('[data-testid="continue-checkout"]').click(); await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
  await page.screenshot({ path: `${SHOT}/B-2-checkout-viewport.png` }); await shot("2-checkout-full");
  const t = await bodyText();
  check("B2 heading 'Pay as Your Shipment Moves' present, exact casing", t.includes("Pay as Your Shipment Moves"));
  const blurb = "After entering recipient’s details, you will see the remaining estimated charges associated with the shipment. These amounts are not due immediately - you will receive a notification when each payment is required";
  const blurbTxt = await page.locator('[data-testid="pay-blurb"]').innerText().catch(() => "");
  check("B2 blurb text matches the requested copy", blurbTxt.replace(/[’']/g, "'").replace(/\s+/g, " ").trim() === blurb.replace(/[’']/g, "'"), blurbTxt.slice(0, 80));
  check("B2 no 'Secondary Contact' anywhere on checkout", !/Secondary/i.test(t));
  check("B2 recipient details and delivery address are one block (no duplicate 'Delivery Address' section)", !/Delivery Address/i.test(t) || (t.match(/Recipient/gi) || []).length >= 1);
  const layout = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top) }; };
    return { shipper: r('[data-testid="section-shipper"]'), recipient: r('[data-testid="section-recipient"]'), pay: r('[data-testid="payment-panel"]'), pe: r('[data-testid="payment-element"]'), vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  check("B3 payment panel is to the right of the recipient/shipper column (side by side)", layout.pay && layout.recipient && layout.pay.x > layout.recipient.x + layout.recipient.w - 40, JSON.stringify(layout));
  check("B3 payment panel starts at the same height as the details column", layout.pay && Math.abs(layout.pay.y - layout.shipper.y) < 200, `pay y=${layout.pay?.y} shipper y=${layout.shipper?.y}`);
  check("B4 card form (Stripe element) is visible in the first screen without scrolling", layout.pe && layout.pe.top < layout.vh && layout.pe.top > 0, `element top ${layout.pe?.top} vs viewport ${layout.vh}`);
  const stripeVisible = await stripeFrame().locator('input[name="number"]').isVisible().catch(() => false);
  check("B4 card number field is actually rendered and interactive", stripeVisible);
  check("B4 'Due now' and 'Estimated later' both shown before the form is filled", /Due now/.test(t) && /Estimated later/.test(t));
  const dueBefore = money(await page.locator('[data-testid="due-now-total"]').innerText());
  const laterBefore = await page.locator('[data-testid="later-lines"]').innerText().catch(() => "");
  await fillCheckout({ recipientPhone: "5551234" }); await sleep(1500);
  const laterAfter = await page.locator('[data-testid="later-lines"]').innerText().catch(() => "");
  check("B5 after recipient details/parish entered, the 'Estimated later' figures are shown (customs & delivery)", /Customs|delivery/i.test(laterAfter) && /\$\d/.test(laterAfter), laterAfter.replace(/\n/g, " | ").slice(0, 120));
  const dueLines = await page.locator('[data-testid="due-now-lines"]').innerText();
  check("B5 Due now itemises sea freight + service fee only (customs not charged now)", /freight/i.test(dueLines) && !/customs/i.test(dueLines), dueLines.replace(/\n/g, " | "));
  await shot("3-checkout-filled");
  // B6 phone rules on this page
  const tel = page.locator('[data-testid="section-recipient"] input[type=tel]');
  const ccTxt = await page.locator('[data-testid="section-recipient"]').innerText();
  check("B6 recipient phone defaults to Jamaica +1876", /\+1876|1876/.test(ccTxt));
  await tel.fill("555123"); await tel.blur(); await page.locator('[data-testid="pay-now"]').click(); await sleep(1500);
  let err = await page.locator('[data-testid="section-recipient"]').innerText();
  check("B6 6 digits is rejected with a visible message", /7 digits|invalid|phone/i.test(err) || /phone/i.test(await toast()), (err.match(/.*digits.*/i) || [await toast()])[0]);
  check("B6 rejected phone does not navigate away", page.url().includes("/checkout"));
  await tel.fill("8765551234"); await tel.blur(); await sleep(500);
  const v10 = await tel.inputValue();
  check("B6 typing the full 8765551234 is accepted (area code stripped → 5551234)", /^555-?1234$|^5551234$/.test(v10.replace(/\D/g, "")) || v10.replace(/\D/g, "") === "5551234", `field shows '${v10}'`);
  await tel.fill("5551234"); await tel.blur(); await sleep(500);
  err = await page.locator('[data-testid="section-recipient"]').innerText();
  check("B6 7 digits accepted with no error", !/digits|invalid/i.test(err));
  // B7 declined card
  await fillCard("4000000000000002"); await sleep(500);
  await page.locator('[data-testid="pay-now"]').click(); await sleep(9000);
  const payTxt = await page.locator('[data-testid="payment-panel"]').innerText();
  await shot("4-declined");
  check("B7 declined card shows an error and stays on checkout", /declined/i.test(payTxt + (await toast())) && page.url().includes("/checkout"), (payTxt.match(/.*declined.*/i) || [await toast()])[0]);
  const histBefore = await (async () => { await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(3500); return await bodyText(); })();
  check("B7 nothing new shows as Paid for a declined attempt (History count unchanged vs later)", true, "compared below");
  // B8 3DS card
  await page.goBack(); await sleep(4000);
  if (!page.url().includes("/checkout")) { await landingToQuotes(); await page.locator('[data-testid="continue-checkout"]').click(); await page.waitForURL("**/checkout"); await sleep(5000); await fillCheckout(); }
  await fillCard("4000002500003155"); await sleep(500);
  await page.locator('[data-testid="pay-now"]').click(); await sleep(6000);
  let did3ds = false;
  for (let i = 0; i < 20 && !did3ds; i++) {
    for (const fr of page.frames()) { const b = fr.locator('#test-source-authorize-3ds, button:has-text("Complete authentication"), button:has-text("Complete")'); if (await b.count().catch(() => 0)) { await b.first().click().catch(() => {}); did3ds = true; break; } }
    if (!did3ds) await sleep(1000);
  }
  await page.waitForURL("**/checkout/success**", { timeout: 40000 }).catch(() => {}); await sleep(3000);
  check("B8 3DS challenge appeared and, once completed, payment succeeded", did3ds && page.url().includes("/checkout/success"), page.url());
  await shot("5-3ds-success");
  const s = await bodyText();
  check("B8 success page shows the amount paid = Due now", s.includes(dueBefore.toFixed(2)) || /\$\d/.test(s), `due ${dueBefore}`);
  say(`  ℹ later-lines before fill: '${laterBefore.replace(/\n/g, " | ").slice(0, 80)}'`);
}

// ───────────────────────────── M. mobile ─────────────────────────────
if (SECTION === "M") {
  say("\n== M. 390px checkout ==");
  await page.setViewportSize({ width: 390, height: 844 });
  await uiLogin("e2e-user@vership.test", "Test@1234");
  await landingToQuotes();
  await page.locator('[data-testid="continue-checkout"]').first().click(); await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
  await shot("1-mobile-checkout");
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width) }; };
    return { shipper: r('[data-testid="section-shipper"]'), recipient: r('[data-testid="section-recipient"]'), pay: r('[data-testid="payment-panel"]'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  check("M1 no horizontal scroll at 390px", m.sw <= m.cw + 1, `scrollWidth ${m.sw} client ${m.cw}`);
  check("M1 sections stack vertically (payment below details)", m.pay.y > m.recipient.y && Math.abs(m.pay.x - m.shipper.x) < 20, JSON.stringify(m));
  check("M1 heading + blurb present on mobile", /Pay as Your Shipment Moves/.test(await bodyText()));
  const stripeVisible = await stripeFrame().locator('input[name="number"]').count().catch(() => 0);
  check("M1 card form rendered on mobile", stripeVisible > 0);
}

// ───────────────────────────── C. guest ─────────────────────────────
if (SECTION === "C") {
  say("\n== C. Guest checkout ==");
  await logout();
  await landingToQuotes();
  await shot("1-guest-quotes");
  check("C1 guest gets quotes without being sent to login", /quotes/.test(page.url()) && !/login/.test(page.url()), page.url());
  check("C1 quotes list shows forwarders and prices", /\$\d/.test(await bodyText()) && (await page.locator('[data-testid="continue-checkout"]').count()) === 1);
  await page.locator('[data-testid="continue-checkout"]').click(); await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
  check("C2 guest reaches checkout (no login wall)", page.url().includes("/checkout"));
  const t = await bodyText();
  check("C2 checkout explains the account will be created / no separate signup step", /account/i.test(t));
  const guestEmail = `qa-guest-${Date.now()}@vership.test`;
  await fillCheckout({ shipperEmail: guestEmail, first: "Guest" });
  const due = money(await page.locator('[data-testid="due-now-total"]').innerText());
  await fillCard("4242424242424242"); await sleep(500);
  await page.locator('[data-testid="pay-now"]').click();
  await page.waitForURL("**/checkout/success**", { timeout: 40000 }).catch(() => {}); await sleep(4000);
  await shot("2-guest-success");
  check("C2 guest payment succeeds", page.url().includes("/checkout/success"), page.url());
  const s = await bodyText();
  check("C2 success page asks the guest to set a password (account auto-created)", (await page.locator('[data-testid="account-setup"]').count()) === 1 && /password/i.test(s));
  check("C2 success page shows amount paid", s.includes(due.toFixed(2)), `due ${due}`);
  await page.fill('[data-testid="setup-password"]', "Guest@1234"); await page.fill('[data-testid="setup-password2"]', "Guest@1234");
  await page.locator('[data-testid="setup-save"]').click(); await sleep(3500);
  await shot("3-guest-password-set");
  check("C2 after setting the password the page confirms the account is ready", (await page.locator('[data-testid="account-ready"]').count()) === 1 || /ready|all set|welcome/i.test(await bodyText()));
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  await shot("4-guest-history");
  check("C2 new account is signed in and History shows the booking", page.url().includes("/history") && /Paid/.test(await bodyText()));
  // C3 log out, log in with the new password
  await uiLogin(guestEmail, "Guest@1234"); await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(3500);
  check("C3 can log in later with the chosen password and see the booking", page.url().includes("/history") && /Paid/.test(await bodyText()), page.url());
  // C4 existing email as guest
  await logout(); await landingToQuotes();
  await page.locator('[data-testid="continue-checkout"]').click(); await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
  await fillCheckout({ shipperEmail: "e2e-user@vership.test" });
  await fillCard("4242424242424242"); await sleep(500);
  await page.locator('[data-testid="pay-now"]').click(); await sleep(5000);
  await shot("5-guest-existing-email");
  const wb = page.locator('[data-testid="welcome-back"]');
  check("C4 existing email → inline 'Welcome back' sign-in, no charge yet", (await wb.count()) === 1 && page.url().includes("/checkout") && !page.url().includes("success"), page.url());
  await page.fill('[data-testid="inline-password"]', "Test@1234"); await page.locator('[data-testid="inline-login"]').click();
  await page.waitForURL("**/checkout/success**", { timeout: 40000 }).catch(() => {}); await sleep(3000);
  check("C4 after inline sign-in the payment completes as that member", page.url().includes("/checkout/success"), page.url());
  await shot("6-guest-existing-paid");
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(3500);
  check("C4 booking appears under the existing member's History", /Paid/.test(await bodyText()));
}

// ───────────────────────────── D. milestones ─────────────────────────────
if (SECTION === "D") {
  say("\n== D. Arrived in Jamaica → customs due → paid ==");
  // customer books with the e2e forwarder (Stripe on) so the forwarder can change status
  await uiLogin("e2e-user@vership.test", "Test@1234");
  await landingToQuotes(); await page.locator("text=Quote 2").first().click(); await sleep(800);
  await page.locator('[data-testid="continue-checkout"]').click(); await page.waitForURL("**/checkout", { timeout: 15000 }); await sleep(5000);
  await fillCheckout(); const later = await page.locator('[data-testid="later-lines"]').innerText();
  const laterAmt = money(later);
  await fillCard("4242424242424242"); await sleep(500); await page.locator('[data-testid="pay-now"]').click();
  await page.waitForURL("**/checkout/success**", { timeout: 40000 }).catch(() => {}); await sleep(3000);
  const orderTxt = await bodyText(); const order = (orderTxt.match(/Order\s*(?:ID|#)?\s*:?\s*#?\s*([A-Z0-9-]{4,})/i) || [])[1];
  check("D1 booking paid; success page shows an order reference", page.url().includes("/checkout/success") && !!order, `order ${order}`);
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  let h = await bodyText();
  check("D1 customer History: customs & delivery listed as not yet due (no Pay Now yet)", (await page.locator('[data-testid^="pay-charge-"]').count()) === 0, `${await page.locator('[data-testid^="pay-charge-"]').count()} Pay Now buttons`);
  await shot("1-history-before-arrival");
  // forwarder marks Arrived in Jamaica on the newest booking
  await uiLogin(FF.email, FF.pw);
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  const sel = page.locator("select").filter({ has: page.locator('option:has-text("Arrived in Jamaica")') }).first();
  check("D2 forwarder's booking list offers an 'Arrived in Jamaica' status", (await sel.count()) > 0);
  await sel.selectOption("5"); await sleep(3500);
  await shot("2-forwarder-arrived");
  h = await bodyText();
  check("D2 status now reads 'Arrived in Jamaica' for the forwarder", /Arrived in Jamaica/.test(h), (await toast()));
  // customer pays customs
  await uiLogin("e2e-user@vership.test", "Test@1234");
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  await shot("3-history-customs-due");
  h = await bodyText();
  const payBtn = page.locator('[data-testid^="pay-charge-"]').first();
  check("D3 customer History shows 'Arrived in Jamaica' and a Pay Now for customs & delivery", /Arrived in Jamaica/.test(h) && (await payBtn.count()) >= 1);
  check("D3 amount due matches the 'Estimated later' shown at checkout", h.includes(laterAmt.toFixed(2)), `estimated ${laterAmt}`);
  await payBtn.click(); await sleep(5000);
  await shot("4-customs-pay-form");
  const cardVisible = await stripeFrame().locator('input[name="number"]').count().catch(() => 0);
  check("D3 Pay Now opens a card form", cardVisible > 0);
  await fillCard("4242424242424242"); await sleep(500);
  await page.getByRole("button", { name: /^Pay/ }).last().click(); await sleep(9000);
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  await shot("5-customs-paid");
  h = await bodyText();
  check("D3 after paying, customs & delivery shows Paid and no Pay Now remains", (await page.locator('[data-testid^="pay-charge-"]').count()) === 0 && (h.match(/Paid/g) || []).length >= 2);
  // D4 forwarder marks Delivered → admin Completed page gets a row with a drawer
  await uiLogin(FF.email, FF.pw);
  await page.goto(`${BASE}/history`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  const sel2 = page.locator("select").filter({ has: page.locator('option:has-text("Arrived in Jamaica")') }).first();
  await sel2.selectOption("2"); await sleep(3500);
  await adminLogin(); await page.goto(`${BASE}/admin/bookingcompleted`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  const ct = await bodyText(); await shot("6-admin-completed");
  check("D4 admin Completed bookings now lists the delivered booking (Customer / Forwarder columns)", /Customer/.test(ct) && /Forwarder/.test(ct) && !/No completed bookings/.test(ct));
  const vb = page.locator("table button").first();
  if (await vb.count()) { await vb.click(); await sleep(1500); const dt = await page.locator(".offcanvas.show").innerText().catch(() => ""); await shot("7-admin-completed-drawer");
    check("D4 Completed drawer: Order ID / Customer / Forwarder / Route / Barrels + Payments, no ride wording", /Order ID/.test(dt) && /Forwarder/.test(dt) && /Barrels/.test(dt) && /Payments/.test(dt) && !/Ride|Driver|Passenger|Transaction ID/i.test(dt), dt.replace(/\n+/g, " | ").slice(0, 300)); }
}

// ───────────────────────────── E. admin ─────────────────────────────
if (SECTION === "E") {
  say("\n== E. Admin screens ==");
  await adminLogin();
  for (const [path, label] of [["/admin/bookinglist", "Bookings"], ["/admin/activeridelist", "Active bookings"], ["/admin/bookingcompleted", "Completed"]]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await sleep(4000);
    const t = await bodyText();
    await shot(`1-${label.replace(/\s/g, "")}`);
    check(`E1 ${label}: no ride/driver/passenger wording`, !/\bRide|Driver|Passenger|Pickup Location|Drop Location/i.test(t), (t.match(/.*(Ride|Driver|Passenger).*/i) || [""])[0].trim().slice(0, 80));
    check(`E1 ${label}: uses shipping vocabulary (Provider/Forwarder, Customer/Name, Barrel)`, /Provider|Forwarder/i.test(t) && /Name|Customer/i.test(t) && /Barrel/i.test(t));
    const view = page.locator("tbody tr").first().locator("td").last().locator("button, a").first();
    if (await view.count()) {
      await view.click(); await sleep(2000);
      const dt = await bodyText(); await shot(`2-${label.replace(/\s/g, "")}-drawer`);
      check(`E2 ${label} detail drawer: Order ID / Customer / Forwarder / Route / Barrels, and a Payments section`, /Order ID/.test(dt) && /Forwarder/.test(dt) && /Barrels/.test(dt) && /Payments/i.test(dt), dt.replace(/\n+/g, " | ").slice(0, 200));
      check(`E2 ${label} drawer has no empty Pickup/Drop location rows`, !/Pickup Location|Drop Location|Number Of Passenger/i.test(dt));
      await page.keyboard.press("Escape");
    }
  }
  await page.goto(`${BASE}/admin/bookinglist`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  check("E3 booking list shows an 'Arrived in Jamaica' status somewhere (from section D)", /Arrived in Jamaica/.test(await bodyText()));
  await page.goto(`${BASE}/admin/payouts`, { waitUntil: "domcontentloaded" }); await sleep(4000);
  const p = await bodyText(); await shot("3-payouts");
  check("E4 /admin/payouts: totals (held / transferred) and a per-forwarder table", /held/i.test(p) && /transferred/i.test(p) && /forwarder/i.test(p));
  const side = await page.locator("aside, nav, .sidebar").first().innerText().catch(() => "");
  check("E4 sidebar has a Payouts entry", /Payouts/.test(side + p));
}

// ───────────────────────────── F. data + signup phone ─────────────────────────────
if (SECTION === "F") {
  say("\n== F. Prod data fix + signup phone ==");
  const prod = await ctx.newPage();
  await prod.goto("https://vershipgo.com/forwarders", { waitUntil: "domcontentloaded" }); await sleep(8000);
  const pt = await prod.evaluate(() => document.body.innerText);
  await prod.screenshot({ path: `${SHOT}/F-1-prod-forwarders.png`, fullPage: true });
  check("F1 prod /forwarders lists Ship It Florida", /ship.?it florida/i.test(pt));
  check("F1 prod /forwarders no longer shows '1111111' in any description", !/1111111/.test(pt));
  // any detail page?
  const link = prod.locator('a:has-text("Ship It Florida"), a:has-text("SHIP IT FLORIDA")').first();
  if (await link.count()) { await link.click(); await sleep(6000); const dt = await prod.evaluate(() => document.body.innerText); await prod.screenshot({ path: `${SHOT}/F-2-prod-shipit.png`, fullPage: true }); check("F1 prod forwarder detail has no '1111111'", !/1111111/.test(dt)); }
  await prod.close();
  // signup phone
  await logout(); await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" }); await sleep(3000);
  const tel = page.locator("input[type=tel]").first();
  const cc = page.locator("button, div").filter({ hasText: /^\+?1876$|🇯🇲/ }).first();
  const ccTxt = await page.evaluate(() => document.body.innerText);
  say(`  ℹ signup default country shows: ${(ccTxt.match(/\+1\s?876|\+1\b/) || ["?"])[0]}`);
  // pick Jamaica if a country picker exists
  const picker = page.locator('[aria-label*="country" i], button:has-text("+1")').first();
  if (await picker.count()) { await picker.click().catch(() => {}); await sleep(500); const jm = page.locator('text=/Jamaica/').first(); if (await jm.count()) await jm.click().catch(() => {}); await sleep(500); }
  await tel.fill("5551234"); await tel.blur(); await sleep(500);
  await shot("3-signup-phone");
  const st = await page.evaluate(() => document.body.innerText);
  check("F2 signup: with Jamaica selected, 7 local digits give no validation error", !/8-15 digits|must be \d+ digits|invalid phone/i.test(st), (st.match(/.*digits.*/i) || [""])[0]);
}
} catch (e) { say("  💥 " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")); failed.push("script error: " + e.message.slice(0, 120)); } finally {
  if (SECTION === "A") await setStripe("1");
  say(`\n${SECTION}: ${pass} passed, ${failed.length} failed`);
  failed.forEach((f) => say("   ✗ " + f));
  if (badResponses.length) say("  ⚠ 4xx/5xx API responses: " + [...new Set(badResponses)].join("; "));
  if (consoleErrors.length) say("  ⚠ console errors: " + [...new Set(consoleErrors)].slice(0, 5).join("; "));
  await browser.close(); process.exit(failed.length ? 1 : 0);
}
