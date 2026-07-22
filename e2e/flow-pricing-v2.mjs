// Browser e2e for the simplified pricing model (v2) — happy + non-happy paths.
// Provider 417 (e2e-provider): sea $100, 5-9 −$10, 10+ −$25, pickup $65 flat
// (no business lat/lng ⇒ 0 extra miles), parish fees saved as scalars
// (Kingston 150, St. Ann 155, …) ⇒ read as {first: v, additional: 0} = flat.
import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000";
const SHOT = (n) => `/tmp/claude-1000/-home-runner-workspace/ad28a58e-5754-43f5-a99f-78212e7c2cdc/scratchpad/v2-${n}.png`;
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); log(`  ${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); };

async function newPage() {
  const page = await (await browser.newContext()).newPage();
  page.on("pageerror", (e) => log("  [PAGEERROR]", e.message));
  page.bad = [];
  page.on("response", async (r) => { const u = r.url(); if ((u.includes("/website/") || u.includes("/api/")) && r.status() >= 400) { let b = ""; try { b = (await r.text()).slice(0, 120); } catch {} page.bad.push(`${r.status()} ${u.replace(BASE, "")} :: ${b}`); } });
  return page;
}
const setDate = (page, aria, val) => page.$eval(`input[aria-label="${aria}"]`, (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, val);
const text = (page) => page.locator("body").innerText().then((t) => t.replace(/\n{2,}/g, "\n")).catch(() => "");
const money = (body, label) => { const re = new RegExp(label + "[\\s\\S]{0,80}?\\$\\s?([\\d,]+(?:\\.\\d{2})?)", "i"); const m = body.match(re); return m ? parseFloat(m[1].replace(/,/g, "")) : null; };

async function fillByLabel(page, label, value) {
  const input = page.locator(`div:has(> label:text-is("${label}")) input`).first();
  if (await input.count()) { await input.fill(value); return true; }
  return false;
}

// One shared session for all flows — repeated logins trip the rate limiter.
const page = await newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "e2e-user@vership.test");
await page.fill('input[name="password"]', "Test@1234");
await page.click('form button[type="submit"]');
await page.waitForTimeout(2500);

async function runFlow({ qty, parish, expected, tag, testGuard }) {
  try {
    log(`\n===== FLOW ${tag}: qty ${qty}, parish ${parish} =====`);

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.click('button[aria-label="Select origin"]'); await page.waitForTimeout(250);
    await page.click('li[role=option] button:has-text("Fort Lauderdale, FL")');
    await page.click('button[aria-label="Select destination"]'); await page.waitForTimeout(250);
    await page.click('li[role=option] button:has-text("Kingston, Jamaica")');
    await page.fill('input[aria-label="Barrel quantity"]', String(qty));
    await setDate(page, "Pickup date", "2026-07-28");
    await setDate(page, "Delivery date", "2026-08-20");
    await page.waitForTimeout(250);
    const gq = page.locator("button", { hasText: "Get quotes" });
    for (let i = 0; i < (await gq.count()); i++) { const c = (await gq.nth(i).getAttribute("class")) || ""; if (c.includes("c1a35e")) { await gq.nth(i).click(); break; } }
    await page.waitForTimeout(4000);
    check(`${tag}: reached quotes page`, page.url().includes("quotes"), page.url());

    await page.waitForSelector("div.cursor-pointer.rounded-xl", { timeout: 20000 }).catch(() => log("  (no provider cards appeared)"));
    // Select exactly the E2E provider card (single-select toggle; clicking an
    // already-active card would DESELECT it, so only click when inactive).
    // Cards are anonymized ("$80.30 Best Quote" / "$100 Quote 2") — pick ours by
    // its $100 badge (e2e-provider's sea freight price).
    const sel = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("div.cursor-pointer.rounded-xl")];
      const target = cards.find((c) => /\$\s?100(?!\d|\.\d*[1-9])/.test(c.textContent));
      if (!target) return "no-card among " + cards.length;
      if (!target.className.includes("border-white")) target.click();
      return "ok";
    });
    await page.waitForTimeout(600);
    const activeIs100 = await page.evaluate(() => {
      const act = [...document.querySelectorAll("div.cursor-pointer.rounded-xl")].filter((c) => c.className.includes("border-white"));
      return act.length === 1 && /\$\s?100/.test(act[0].textContent);
    });
    check(`${tag}: $100 (E2E) quote card selected`, sel === "ok" && activeIs100, sel);

    // Pre-fill every labeled input with a plausible value, then self-heal on
    // validation errors: click "Review & Order", read red errors, fill, repeat.
    const valueFor = async (labelTxt, el) => {
      const l = labelTxt.toLowerCase();
      if (l.includes("first")) return "Delroy";
      if (l.includes("last")) return "Brown";
      if (l.includes("email")) return "e2e-user@vership.test";
      if (l.includes("phone")) {
        const dial = await el.evaluate((n) => n.closest("div")?.parentElement?.innerText || "");
        return /1876/.test(dial) ? "5551234" : "5551230000";
      }
      if (l.includes("street") || l === "address") return "100 SE 2nd St";
      if (l.includes("city") || l.includes("town")) return "Fort Lauderdale";
      if (l === "state") return "Florida";
      return "";
    };
    const fillAllLabeled = async () => {
      const blocks = page.locator("div:has(> label):has(> input)");
      const n = await blocks.count();
      for (let i = 0; i < n; i++) {
        const b = blocks.nth(i);
        const input = b.locator("> input").first();
        if (!(await input.isVisible().catch(() => false))) continue;
        if (await input.inputValue()) continue;
        const labelTxt = (await b.locator("> label").first().innerText().catch(() => "")).trim();
        if (/optional/i.test(labelTxt)) continue;
        const v = await valueFor(labelTxt, input);
        if (v) await input.fill(v).catch(() => {});
      }
      // Phone inputs live inside nested flag/dial-code wrappers — target any
      // input under a block whose label says Phone, and use 10-digit numbers.
      const phoneBlocks = page.locator('div:has(label:text-is("Phone Number"))');
      for (let i = 0; i < (await phoneBlocks.count()); i++) {
        const blk = phoneBlocks.nth(i);
        const inp = blk.locator("input:visible").last();
        if (!(await inp.count())) continue;
        if (await inp.inputValue().catch(() => "x")) continue;
        const ctx = (await blk.innerText().catch(() => "")) || "";
        await inp.fill(/1876/.test(ctx) ? "8765551234" : "3055551234").catch(() => {});
      }
      // all parish selects on the booking form
      const sels = page.locator("select").filter({ has: page.locator('option:text-is("Select parish")') });
      for (let i = 0; i < (await sels.count()); i++) await sels.nth(i).selectOption(parish).catch(() => {});
    };
    await fillAllLabeled();
    await page.screenshot({ path: SHOT(`${tag}-form`), fullPage: true });

    let body = "";
    for (let round = 0; round < 4; round++) {
      await page.locator("button", { hasText: "Review & Order" }).first().click();
      await page.waitForTimeout(3500);
      if (!page.url().includes("quotes")) break; // navigated away = success
      const errs = await page.locator("p.text-red-400:visible").allInnerTexts().catch(() => []);
      if (!errs.length) break;
      log(`  round ${round} validation errors:`, [...new Set(errs)].join(" | ").slice(0, 300));
      await fillAllLabeled();
    }
    await page.waitForTimeout(2500);
    body = await text(page);
    log("  url:", page.url());
    await page.screenshot({ path: SHOT(`${tag}-checkout`), fullPage: true });

    // ---- Checkout (ShipmentDetailsSection) assertions ----
    const onCheckout = /Review and Pay/i.test(body);
    check(`${tag}: reached checkout`, onCheckout);
    if (!onCheckout) { log(body.slice(0, 1200)); return; }

    const rowAmount = async (label) => {
      const row = page.locator("div.flex.justify-between", { hasText: new RegExp(label, "i") }).last();
      if (!(await row.count())) return null;
      const t = (await row.innerText().catch(() => "")).replace(/\n/g, " ");
      const ms = [...t.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g)];
      return ms.length ? parseFloat(ms[ms.length - 1][1].replace(/,/g, "")) : null;
    };
    check(`${tag}: barrel line = $${expected.item}`, body.includes(expected.item.toFixed(2)), `body has ${expected.item.toFixed(2)}: ${body.includes(expected.item.toFixed(2))}`);
    check(`${tag}: Customs & Delivery line rendered`, /Customs\s*&\s*Delivery/i.test(body));
    const parishSelVal = await page.locator("select").filter({ has: page.locator('option:text-is("Select parish…")') }).first().inputValue().catch(() => "");
    check(`${tag}: parish auto-detected (${parish})`, parishSelVal === parish, `select value: ${parishSelVal}`);
    const cd = await rowAmount("Customs & Delivery");
    check(`${tag}: parish fee = $${expected.parishFee}`, cd === expected.parishFee, `found ${cd}`);
    const pickup = await rowAmount("Pickup");
    check(`${tag}: pickup = $${expected.pickup}`, pickup === expected.pickup, `found ${pickup}`);
    check(`${tag}: no legacy 'Customs and handling' line`, !/Customs and handling/i.test(body));
    const totalMin = expected.item + expected.parishFee + expected.pickup;
    const totalMatch = body.match(/Total[\s\S]{0,60}?\$\s?([\d,]+(?:\.\d{2})?)/i);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : null;
    check(`${tag}: total ≥ $${totalMin} (plus % fees)`, total !== null && total >= totalMin - 0.01, `total ${total}`);

    if (testGuard) {
      // Non-happy: clear the parish → fee dash + payment blocked
      const sel = page.locator("select").filter({ has: page.locator('option:text-is("Select parish…")') }).first();
      if (await sel.count()) {
        await sel.selectOption("");
        await page.waitForTimeout(400);
        const cdRow = page.locator("div.flex.justify-between", { hasText: /Customs\s*&\s*Delivery/i }).last();
        const cdTxt = (await cdRow.innerText().catch(() => "")).trim();
        check("guard: fee hidden when no parish", cdTxt.endsWith("—"), cdTxt.slice(-20));
        body = await text(page);
        await page.locator('button', { hasText: "Review and Pay" }).first().click();
        await page.waitForTimeout(1200);
        body = await text(page);
        check("guard: payment blocked without parish", /select the destination parish/i.test(body));
        // recover: pick parish again → payment proceeds to Stripe modal
        await sel.selectOption(parish);
        await page.waitForTimeout(400);
        await page.locator('button', { hasText: "Review and Pay" }).first().click();
        await page.waitForTimeout(6000);
        body = await text(page);
        const stripeOpen = (await page.locator('iframe[src*="stripe"], [class*="StripeElement"]').count()) > 0 || /card|payment/i.test(body);
        check("guard: payment proceeds once parish chosen", stripeOpen);
        await page.screenshot({ path: SHOT(`${tag}-pay`), fullPage: true });
      } else check("guard: checkout parish select present", false);
    }
  } catch (e) {
    log(`  SCRIPT ERROR (${tag}):`, e.message);
    await page.screenshot({ path: SHOT(`${tag}-error`), fullPage: true }).catch(() => {});
  } finally {
    log(`  API failures (${tag}):`, page.bad.length ? JSON.stringify(page.bad) : "none");
    page.bad = [];
  }
}

// Run 1: qty 6 → 5-9 tier ($90/bbl = $540), St. Ann $155, pickup $65. Full guard tests.
await runFlow({ qty: 6, parish: "St. Ann", tag: "q6", expected: { item: 540, parishFee: 155, pickup: 65 }, testGuard: true });
// Run 2: qty 10 → 10+ tier ($75/bbl = $750), Kingston $150, pickup $65.
await runFlow({ qty: 10, parish: "Kingston", tag: "q10", expected: { item: 750, parishFee: 150, pickup: 65 }, testGuard: false });

log("\n==== SUMMARY ====");
const fails = results.filter((r) => !r.ok);
log(`${results.length - fails.length}/${results.length} passed`);
if (fails.length) log("FAILED:", fails.map((f) => f.name));
await browser.close();
