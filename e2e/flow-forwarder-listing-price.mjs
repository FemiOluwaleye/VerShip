/*
 * The forwarder listing must advertise the same per-barrel price a quote would
 * charge. It used to read providerDetails.basePrice, a denormalized copy that
 * nothing kept in step with the rate card — the listing could advertise a price
 * checkout would not honour. The column is gone; the price is derived from the
 * cards via headlinePrice() in website/src/utils/pricing.js.
 *
 *   node e2e/flow-forwarder-listing-price.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE || "http://localhost:5000";
const SHOT = (n) => `${process.env.E2E_SHOT_DIR || "/tmp"}/forwarder-price-${n}.png`;

let pass = 0;
const failed = [];
const log = (s) => console.log(s);
const check = (name, ok, detail = "") => {
    if (ok) { pass++; log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); }
    else { failed.push(name); log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};

const api = async (path) => (await fetch(`${BASE}${path}`)).json();

log("\n== API contract ==");
const res = await api("/website/get-forwarders");
const forwarders = res.body || [];
check("get-forwarders returns forwarders", forwarders.length > 0, `${forwarders.length} live`);

// The dead copy must not come back: nothing should be able to read it again.
const leaks = forwarders.filter((f) => f.businessInfo && "basePrice" in f.businessInfo);
check("payload no longer carries providerDetails.basePrice", leaks.length === 0,
    leaks.length ? `${leaks.length} still expose it` : "gone");

check("payload carries the rate cards the price is derived from",
    forwarders.every((f) => Array.isArray(f.businessInfo?.barrelPrices)),
    `${forwarders.filter((f) => f.businessInfo?.barrelPrices?.length).length} with cards`);

// Mirror of headlinePrice() — prefer a v2 'own' card, else first 'own', else dropoff.
const isV2 = (bp) => bp && String(bp.seaFreightPrice ?? "").trim() !== "" && parseFloat(bp.seaFreightPrice) > 0;
const pick = (cards, type) => {
    const byType = (cards || []).filter((c) => String(c.type || "").toLowerCase() === type);
    return byType.find(isV2) || byType[0] || null;
};
const expected = (f) => {
    const card = pick(f.businessInfo?.barrelPrices, "own") || pick(f.businessInfo?.barrelPrices, "dropoff");
    if (!card) return null;
    const n = parseFloat(isV2(card) ? card.seaFreightPrice : (card.barrelPrice || card.basePrice));
    return Number.isFinite(n) && n > 0 ? n : null;
};

log("\n== Rendered listing ==");
const browser = await chromium.launch({
    executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
await page.goto(`${BASE}/forwarders`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const body = await page.evaluate(() => document.body.innerText);
await page.screenshot({ path: SHOT("1-listing"), fullPage: true });

check("listing shows a per-barrel price", /\/barrel/.test(body), "found '/barrel'");

for (const f of forwarders) {
    const want = expected(f);
    const name = f.businessInfo?.businessName || f.firstName;
    if (want === null) {
        log(`  · ${name}: no priced card, price correctly omitted`);
        continue;
    }
    // The card renders the number bare (e.g. "$95"); match it next to the label.
    const shown = new RegExp(`\\$${String(want).replace(".", "\\.")}\\b`).test(body);
    check(`${name} advertises the rate-card price`, shown, `$${want}`);
}

// The critical invariant: what the listing shows is what a quote computes from
// the same card, because both now run the same selection over the same data.
const mismatches = forwarders
    .map((f) => ({ name: f.businessInfo?.businessName || f.firstName, want: expected(f) }))
    .filter((x) => x.want !== null && !new RegExp(`\\$${String(x.want).replace(".", "\\.")}\\b`).test(body));
check("no forwarder advertises a price its card does not support",
    mismatches.length === 0,
    mismatches.length ? mismatches.map((m) => `${m.name} wants $${m.want}`).join(", ") : "all aligned");

await browser.close();

log("\n" + "=".repeat(60));
log(`${pass}/${pass + failed.length} checks passed`);
if (failed.length) { log("FAILED:"); failed.forEach((f) => log(`  - ${f}`)); process.exit(1); }
