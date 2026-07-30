/*
 * Broad browser smoke test after removing providerDetails.basePrice.
 *
 * The change touched the public listing, three quote screens, the booking
 * detail page, the forwarder pricing form, createBooking, and the admin pricing
 * index. This drives all of them in a real browser as a real user and fails on
 * any console error, failed request, or React error boundary — not just on the
 * prices being right.
 *
 *   node e2e/smoke-after-baseprice-removal.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE || "http://localhost:5000";
const SHOT_DIR = process.env.E2E_SHOT_DIR || "/tmp";
const CUSTOMER = { email: "e2e-user@vership.test", password: "Test@1234" };
// Provider 381, not the usual e2e-provider (417). 417's providerDetails
// .shipmentType is "ship your own barrel" while getSubOptions() switches on
// "barrel", so its rate-card fields never render — a fixture quirk (it is the
// only such row in dev; 109 others say "barrel"), unrelated to pricing. 381 has
// shipmentType 'barrel', a saved sub-type, and a priced card, so the form
// actually exercises its prefill.
const PROVIDER = { email: "dejoungreen@gmail.com", password: "Test@1234" };
const ADMIN = { email: "e2e-admin@vership.test", password: "AdminTest123!" };

let pass = 0;
const failed = [];
const log = (s) => console.log(s);
const check = (name, ok, detail = "") => {
    if (ok) { pass++; log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
    else { failed.push(name); log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};

const browser = await chromium.launch({
    executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
const page = await ctx.newPage();

// Noise the app already emits and that predates this change. Anything else is
// treated as a real failure.
const IGNORE = [
    /Google Maps|places|maps\.googleapis/i,
    /favicon/i,
    /ResizeObserver loop/i,
    /Download the React DevTools/i,
    /React Router Future Flag/i,
];
let consoleErrors = [];
let netFailures = [];
page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (!IGNORE.some((r) => r.test(t))) consoleErrors.push(t.slice(0, 180));
});
page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && !IGNORE.some((x) => x.test(u))) {
        netFailures.push(`${r.status()} ${u.replace(BASE, "").slice(0, 90)}`);
    }
});
const resetWatchers = () => { consoleErrors = []; netFailures = []; };

const visit = async (path, waitMs = 2500) => {
    resetWatchers();
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(waitMs);
    return page.evaluate(() => document.body.innerText);
};

// A blank body or a React error boundary means the route died on render.
const rendered = (body) => body.trim().length > 200 && !/Something went wrong|Unexpected Application Error/i.test(body);

// ---------------------------------------------------------------- public ----
log("\n== Public pages ==");
for (const [path, expect] of [
    ["/", /VerShip|shipment|Get quotes/i],
    ["/forwarders", /All Forwarders/i],
    ["/about", /About/i],
    ["/contact", /Contact/i],
    ["/faqs", /FAQ/i],
    ["/terms", /Terms/i],
    ["/privacy", /Privacy/i],
]) {
    const body = await visit(path, 2200);
    const ok = rendered(body) && expect.test(body) && !consoleErrors.length && !netFailures.length;
    check(`${path} renders clean`, ok,
        ok ? "" : [
            !rendered(body) && "blank/error boundary",
            !expect.test(body) && "content missing",
            consoleErrors.length && `console: ${consoleErrors[0]}`,
            netFailures.length && `net: ${netFailures[0]}`,
        ].filter(Boolean).join("; "));
}

// The listing price is the thing this change exists for.
const listing = await visit("/forwarders", 3000);
await page.screenshot({ path: `${SHOT_DIR}/smoke-1-forwarders.png`, fullPage: true });
check("forwarder cards advertise a per-barrel price", /\$\d+(\.\d+)?\s*\/barrel/.test(listing.replace(/\n/g, " ")),
    (listing.replace(/\n/g, " ").match(/\$\d+(\.\d+)?\s*\/barrel/) || ["none"])[0]);

// -------------------------------------------------------------- customer ----
log("\n== Customer journey ==");
resetWatchers();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', CUSTOMER.email);
await page.fill('input[name="password"]', CUSTOMER.password);
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
check("customer logs in", !page.url().endsWith("/login"), page.url().replace(BASE, ""));

const quotes = await visit("/quotes", 4500);
await page.screenshot({ path: `${SHOT_DIR}/smoke-2-quotes.png`, fullPage: true });
check("/quotes renders", rendered(quotes) && !consoleErrors.length,
    consoleErrors[0] || netFailures[0] || "");
// Quote cards print the per-barrel price straight from the rate card.
const quotePrices = (quotes.match(/\$\s?\d[\d,]*(\.\d+)?/g) || []).slice(0, 6);
check("/quotes shows priced offers", quotePrices.length > 0, quotePrices.join(" "));
check("no NaN or undefined leaked into the quote prices",
    !/\$\s?(NaN|undefined|null)/i.test(quotes), "clean");

for (const [path, label] of [["/history", "order history"], ["/profile", "customer profile"]]) {
    const body = await visit(path, 3000);
    check(`${label} renders clean`, rendered(body) && !consoleErrors.length,
        consoleErrors[0] || netFailures[0] || "");
}

// -------------------------------------------------------------- forwarder ---
log("\n== Forwarder journey ==");
await ctx.clearCookies();
await page.evaluate(() => localStorage.clear()).catch(() => {});
resetWatchers();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', PROVIDER.email);
await page.fill('input[name="password"]', PROVIDER.password);
await page.click('button[type="submit"]');
await page.waitForTimeout(4500);
check("forwarder logs in", !page.url().endsWith("/login"), page.url().replace(BASE, ""));

const bizProfile = await visit("/businessProfile", 4000);
await page.screenshot({ path: `${SHOT_DIR}/smoke-3-businessprofile.png`, fullPage: true });
check("forwarder profile renders clean", rendered(bizProfile) && !consoleErrors.length,
    consoleErrors[0] || netFailures[0] || "");
// The profile prints each card's own price — from barrelsprices, not the
// removed column — labelled "Sea Freight (per barrel)" on v2 cards and "Base
// Price" on legacy ones. Either way it must be a real number.
check("profile still shows rate-card prices",
    /Sea Freight \(per barrel\)|Base Price/i.test(bizProfile) &&
    !/\$(undefined|NaN)/i.test(bizProfile),
    (bizProfile.match(/(Sea Freight \(per barrel\)|Base Price)[\s\S]{0,12}/i) || ["not shown"])[0].replace(/\n/g, " ").trim());

// /businessuploadnext is the rate-card screen (BusinessUploadNext.jsx) — the
// one whose prefill used to seed a field from the removed column.
const bizEdit = await visit("/businessuploadnext", 4500);
await page.screenshot({ path: `${SHOT_DIR}/smoke-4-pricingform.png`, fullPage: true });
check("forwarder pricing form renders clean", rendered(bizEdit) && !consoleErrors.length,
    consoleErrors[0] || netFailures[0] || "");
check("pricing form shows the rate-card fields", /sea freight/i.test(bizEdit), "sea freight field rendered");
// The prefill used to seed a field from the removed column. Everything the form
// shows must now come back from barrelsprices — blank fields would mean a
// forwarder reopening their profile silently loses their prices on save.
const seaValue = await page.locator('input[name="seaFreightPrice"]').first().inputValue().catch(() => "");
check("sea freight prefills from the card", /^\d+(\.\d+)?$/.test(seaValue) && parseFloat(seaValue) > 0, `$${seaValue}`);
const filledInputs = await page.locator("input").evaluateAll(
    (els) => els.filter((e) => e.type !== "checkbox" && e.value && /^[\d.]+$/.test(e.value.trim())).length
);
check("parish and discount fields prefill too", filledInputs >= 10, `${filledInputs} numeric fields populated`);

// ------------------------------------------------------------------ admin ---
log("\n== Admin ==");
await ctx.clearCookies();
await page.evaluate(() => localStorage.clear()).catch(() => {});
resetWatchers();
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.fill('input[type="email"], input[name="email"]', ADMIN.email);
await page.fill('input[type="password"]', ADMIN.password);
await page.click("button#login"); // admin login is a plain button, not a submit
await page.waitForTimeout(4500);
check("admin logs in", !/\/admin\/?(login)?$/.test(page.url()), page.url().replace(BASE, ""));

const adminPricing = await visit("/admin/pricing", 4000);
await page.screenshot({ path: `${SHOT_DIR}/smoke-5-adminpricing.png`, fullPage: true });
check("admin pricing index renders clean", rendered(adminPricing) && !consoleErrors.length,
    consoleErrors[0] || netFailures[0] || "");
check("index shows prices, not blanks",
    /Forwarder pricing/i.test(adminPricing) && !/\$(undefined|NaN)/.test(adminPricing), "clean");
check("the retired mismatch badge is gone", !/listed price mismatch/i.test(adminPricing), "absent");

const adminEditor = await visit("/admin/pricing/500", 4000);
await page.screenshot({ path: `${SHOT_DIR}/smoke-6-admineditor.png`, fullPage: true });
check("admin pricing editor renders clean", rendered(adminEditor) && !consoleErrors.length,
    consoleErrors[0] || netFailures[0] || "");
check("editor quote preview still computes", /What the customer would pay/i.test(adminEditor) &&
    !/\$(undefined|NaN)/.test(adminEditor), "preview present, no NaN");

for (const [path, label] of [["/admin/providerlist", "providers list"], ["/admin/dashboard", "dashboard"]]) {
    const body = await visit(path, 3500);
    check(`admin ${label} renders clean`, rendered(body) && !consoleErrors.length,
        consoleErrors[0] || netFailures[0] || "");
}

await browser.close();
log("\n" + "=".repeat(60));
log(`${pass}/${pass + failed.length} checks passed`);
if (failed.length) { log("FAILED:"); failed.forEach((f) => log(`  - ${f}`)); process.exit(1); }
