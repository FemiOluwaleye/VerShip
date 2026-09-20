// Phase 1 visual acceptance — real browser against :5000 (built site) + Stripe test mode.
//   A. un-onboarded forwarder appears in quotes
//   C. forwarder profile "Held for you $X" + "Set up payouts to collect"
//   D. onboarding completes → auto-transfer → profile shows Transferred
//   E. Collect funds button (held > 0 with a connected account) → real transfer
//   F. admin /admin/payouts totals + rows + retry on a forced failure
//   node e2e/payouts.mjs
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import fs from "fs";
const require = createRequire(import.meta.url);
process.chdir("/home/runner/workspace/server");
const db = require("/home/runner/workspace/server/models");
const { env } = require("/home/runner/workspace/server/helper/envConfig");
const stripe = require("/home/runner/workspace/server/node_modules/stripe")(env("STRIPE_SECRET_KEY"));
const { onPaymentIntentSucceeded, onAccountUpdated } = require("/home/runner/workspace/server/helper/stripeWebhook");

const BASE = "http://localhost:5000";
const SHOT = "/tmp/claude-1000/-home-runner-workspace/a0bc9e91-0a72-4c57-9899-404673d94818/scratchpad/shots";
fs.mkdirSync(SHOT, { recursive: true });
const PROVIDER_ID = 417;
const say = (m) => console.log(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0; const failed = [];
const check = (name, ok, detail = "") => { if (ok) { pass++; say(`  ✅ ${name}${detail ? " — " + detail : ""}`); } else { failed.push(name); say(`  ❌ ${name}${detail ? " — " + detail : ""}`); } };

const api = async (path, { method = "GET", token, body } = {}) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const login = async (email, password) => (await api("/website/login", { method: "POST", body: { email, password } })).body?.authtoken;

// Pay a held deposit for provider 417 via the API and ledger it (webhook path).
async function makeHeldPayment(customerToken) {
  const req = await api("/website/save-booking-request", { method: "POST", token: customerToken, body: {
    origin: "Pittsburgh, PA", destination: "Kingston, Jamaica", parish: "Kingston",
    pickup_date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), delivery_date: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10),
    items: [{ item_type: "Barrel", sub_type: "Ship Your Own Barrel", quantity: 1 }], origin_lat: "40.4387", origin_long: "-79.9972", destination_lat: "18.0179", destination_long: "-76.8099" } });
  const cb = await api("/website/create-booking", { method: "POST", token: customerToken, body: {
    booking_request_id: req.body.id, providerIds: [PROVIDER_ID], barrel_type: "own",
    primary_firstName: "Elvis", primary_lastName: "Livingston", primary_phone_number: "5551234", primary_country_code: "+1876", primary_email: "elvis@example.com", primary_address: "15 Molynes Road", primary_city: "Kingston 10", primary_state: "Kingston",
    shiper_firstName: "Jane", shiper_lastName: "Doe", shiper_email: "jane@example.com", shiper_phone_number: "4125550123", shiper_country_code: "+1", shiper_address: "100 Grant St", shiper_city: "Pittsburgh", shiper_state: "PA", shiper_lat: "40.4406", shiper_lng: "-79.9959",
    consignee_firstName: "Elvis", consignee_lastName: "Livingston", consignee_email: "elvis@example.com", consignee_phone_number: "5551234", consignee_country_code: "+1876", consignee_address: "15 Molynes Road", consignee_city: "Kingston 10", consignee_state: "Kingston", consignee_lat: "18.0179", consignee_lng: "-76.8099" } });
  const booking = cb.body.bookings[0];
  const pi = await api("/website/charge-intent", { method: "POST", token: customerToken, body: { bookingId: booking.id } });
  await stripe.paymentIntents.confirm(pi.paymentIntentId, { payment_method: "pm_card_visa", return_url: `${BASE}/history` });
  const full = await stripe.paymentIntents.retrieve(pi.paymentIntentId, { expand: ["latest_charge"] });
  await onPaymentIntentSucceeded(full);
  return { booking, intent: full, mode: pi.payoutMode };
}

const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error" && !/favicon|maps|places|ResizeObserver/i.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); });

const uiLogin = async (email, password) => {
  await ctx.clearCookies(); await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]'); await sleep(3500);
  return page.evaluate(() => localStorage.getItem("token"));
};

// ── reset fixture: 417 has no Stripe account ──
const savedAcct = (await db.users.findByPk(PROVIDER_ID)).accountId; // test Custom account from the API test, if any
await db.users.update({ accountId: "", hashAccount: "0" }, { where: { id: PROVIDER_ID } });
await db.forwarder_payouts.destroy({ where: { provider_id: PROVIDER_ID } });
// ── A. un-onboarded forwarder quoted ──
say("\n== A. quotes ==");
// Single-session auth: a UI login rotates the JWT, so take the API token from the browser session.
const customerToken = await uiLogin("e2e-user@vership.test", "Test@1234");
await api("/website/save-booking-request", { method: "POST", token: customerToken, body: { origin: "Pittsburgh, PA", destination: "Kingston, Jamaica", parish: "Kingston", pickup_date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), delivery_date: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), items: [{ item_type: "Barrel", sub_type: "Ship Your Own Barrel", quantity: 1 }], origin_lat: "40.4387", origin_long: "-79.9972", destination_lat: "18.0179", destination_long: "-76.8099" } });
await page.goto(`${BASE}/quotes-shipown`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const quoteText = await page.evaluate(() => document.body.innerText);
const quoted = await api("/website/get-available-quotes", { token: customerToken });
const ids = quoted.body.providers.map((p) => p.provider.id);
check("A. un-onboarded forwarder 417 in the quote list", ids.includes(PROVIDER_ID), ids.join(", "));
check("A. quotes page renders the cards", /Best Quote/.test(quoteText));
await page.screenshot({ path: `${SHOT}/P1-A-quotes-with-unonboarded-forwarder.png`, fullPage: true });

// ── C. held payment → forwarder profile ──
say("\n== C. held payment on the forwarder profile ==");
const p1 = await makeHeldPayment(customerToken);
check("C. deposit routed as held", p1.mode === "held", p1.mode);
await uiLogin("e2e-provider@vership.test", "Test@1234");
await page.goto(`${BASE}/businessProfile`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const heldText = await page.locator('[data-testid="payouts-held"]').innerText().catch(() => "");
const row = await db.forwarder_payouts.findOne({ where: { provider_id: PROVIDER_ID, status: "owed" } });
check("C. profile shows Held for you", heldText === `$${(row.amount_owed_cents / 100).toFixed(2)}`, `${heldText} vs ledger $${row.amount_owed_cents / 100}`);
check("C. CTA is Set up payouts to collect", await page.locator('button:has-text("Set up payouts to collect")').count() === 1);
await page.locator('[data-testid="payouts-card"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${SHOT}/P1-C-profile-held.png` });
await page.goto(`${BASE}/earning`, { waitUntil: "domcontentloaded" }); await sleep(3500);
check("C. earnings page shows the same card", (await page.locator('[data-testid="payouts-held"]').innerText().catch(() => "")) === heldText);
await page.screenshot({ path: `${SHOT}/P1-C-earnings-held.png` });

// ── D. onboarding completes → auto transfer ──
say("\n== D. onboarding completes ==");
let acctId = savedAcct && savedAcct.startsWith("acct_") ? savedAcct : null;
if (acctId) { try { const a = await stripe.accounts.retrieve(acctId); if (a.capabilities?.transfers !== "active") acctId = null; } catch { acctId = null; } }
if (!acctId) {
  const acct = await stripe.accounts.create({ type: "custom", country: "US", email: "e2e-provider@vership.test", business_type: "individual", capabilities: { transfers: { requested: true } },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: "127.0.0.1" },
    individual: { first_name: "E2E", last_name: "Provider", email: "e2e-provider@vership.test", phone: "0000000000", dob: { day: 1, month: 1, year: 1990 }, ssn_last_4: "0000", address: { line1: "address_full_match", city: "Pittsburgh", state: "PA", postal_code: "15222", country: "US" } },
    business_profile: { mcc: "4214", product_description: "Freight forwarding (test)" },
    external_account: { object: "bank_account", country: "US", currency: "usd", routing_number: "110000000", account_number: "000123456789" } });
  acctId = acct.id;
  for (let i = 0; i < 20; i++) { const a = await stripe.accounts.retrieve(acctId); if (a.capabilities?.transfers === "active") break; await sleep(1500); }
}
await db.users.update({ accountId: acctId }, { where: { id: PROVIDER_ID } });
const live = await stripe.accounts.retrieve(acctId);
const upd = await onAccountUpdated(live);
check("D. webhook auto-transferred the held amount", upd.collected?.transferred?.length === 1, JSON.stringify(upd.collected?.failed?.map((f) => f.failure_reason)));
await page.goto(`${BASE}/businessProfile`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const cardText = await page.locator('[data-testid="payouts-card"]').innerText().catch(() => "");
check("D. profile shows $0 held and the transfer", /\$0\.00/.test(cardText) && /transferred/i.test(cardText), cardText.replace(/\n/g, " | ").slice(0, 140));
check("D. CTA switched to Collect funds (disabled, nothing to collect)", await page.locator('[data-testid="collect-funds"][disabled]').count() === 1);
await page.locator('[data-testid="payouts-card"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${SHOT}/P1-D-profile-transferred.png` });

// ── E. Collect funds: a payment ledgered while the account was detached, then collected by the button ──
say("\n== E. Collect funds ==");
await db.users.update({ accountId: "", hashAccount: "0" }, { where: { id: PROVIDER_ID } });
const p2 = await makeHeldPayment(customerToken);
await db.users.update({ accountId: acctId, hashAccount: "1" }, { where: { id: PROVIDER_ID } });
await page.goto(`${BASE}/businessProfile`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const btn = page.locator('[data-testid="collect-funds"]');
check("E. Collect button enabled with amount", (await btn.count()) === 1 && !(await btn.isDisabled()) && /Collect \$/.test(await btn.innerText()), await btn.innerText().catch(() => ""));
await page.screenshot({ path: `${SHOT}/P1-E-collect-before.png` });
await btn.click(); await sleep(6000);
const rowE = await db.forwarder_payouts.findOne({ where: { payment_intent_id: p2.intent.id } });
check("E. clicking Collect transferred it", rowE?.status === "transferred" && !!rowE?.transfer_id, `${rowE?.status} ${rowE?.transfer_id || ""}`);
await page.screenshot({ path: `${SHOT}/P1-E-collect-after.png` });

// ── F. admin payouts page (+ a forced failure to retry) ──
say("\n== F. admin ==");
await db.users.update({ accountId: "", hashAccount: "0" }, { where: { id: PROVIDER_ID } });
const p3 = await makeHeldPayment(customerToken);
const rowF = await db.forwarder_payouts.findOne({ where: { payment_intent_id: p3.intent.id } });
await rowF.update({ status: "failed", failure_reason: "balance_insufficient: simulated for the retry test" });
await db.users.update({ accountId: acctId, hashAccount: "1" }, { where: { id: PROVIDER_ID } });
await ctx.clearCookies(); await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" }); await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" }); await sleep(2000);
await page.fill('input[placeholder="Email address"]', "e2e-admin@vership.test");
let adminOk = false;
for (const pw of ["AdminTest123!", "Test@1234"]) {
  await page.fill('input[placeholder="Password"]', pw); await page.click("button#login"); await sleep(3500);
  if (!/\/admin\/?(login)?$/.test(page.url())) { adminOk = true; break; }
}
check("F. admin logged in", adminOk, page.url().replace(BASE, ""));
await page.goto(`${BASE}/admin/payouts`, { waitUntil: "domcontentloaded" }); await sleep(4000);
const hint = await page.locator('[data-testid="min-balance-hint"]').innerText().catch(() => "");
const failedTotal = await page.locator('[data-testid="total-failed"]').innerText().catch(() => "");
check("F. minimum-balance hint shows the held total", /Keep at least \$\d/.test(hint), hint.slice(0, 80));
check("F. failed total reflects the forced failure", failedTotal === `$${(rowF.amount_owed_cents / 100).toFixed(2)}`, failedTotal);
check("F. rows table rendered", (await page.locator('[data-testid="payout-rows"] tbody tr').count()) >= 3);
await page.screenshot({ path: `${SHOT}/P1-F-admin-payouts.png`, fullPage: true });
const failedRow = page.locator('[data-testid="payout-rows"] tbody tr', { hasText: "simulated for the retry test" });
await failedRow.locator('button:has-text("Retry")').click(); await sleep(6000);
await page.locator(".swal2-confirm").click().catch(() => {}); await sleep(3000);
await rowF.reload();
check("F. Retry transferred the failed row", rowF.status === "transferred" && !!rowF.transfer_id, `${rowF.status} ${rowF.transfer_id || ""}`);
await page.screenshot({ path: `${SHOT}/P1-F-admin-after-retry.png`, fullPage: true });

check("no console errors across the run", consoleErrors.length === 0, consoleErrors[0] || "");
await browser.close();
say(`\n${pass} passed, ${failed.length} failed${failed.length ? ": " + failed.join("; ") : ""}\nscreenshots: ${SHOT}/P1-*.png`);
process.exit(failed.length ? 1 : 0);
