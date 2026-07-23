// QA sweep for: merged Start-a-Shipment landing + drop-off add-on, prepacked
// payment edge cases (cancel / declined card), forwarder additional costs
// (validation, pay, both-side status), print receipts, mobile spot-check.
import { chromium } from "@playwright/test";
import fs from "fs";
const BASE = "http://localhost:5000";
const SCRATCH = "/tmp/claude-1000/-home-runner-workspace/fae0fc25-8cd1-4387-8536-9e190ba93d7f/scratchpad";
const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`); };
const setDate = (page, aria, val) => page.$eval(`input[aria-label="${aria}"]`, (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, val);
const money = (body, label) => { const re = new RegExp(label + "[\\s\\S]{0,80}?\\$\\s?([\\d,]+(?:\\.\\d{2})?)", "i"); const m = body.match(re); return m ? parseFloat(m[1].replace(/,/g, "")) : null; };

async function landingToCheckout(page, { qty, addon }) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.click('button[aria-label="Select origin"]'); await page.waitForTimeout(250);
  await page.click('li[role=option] button:has-text("Fort Lauderdale, FL")');
  await page.click('button[aria-label="Select destination"]'); await page.waitForTimeout(250);
  await page.click('li[role=option] button:has-text("Kingston, Jamaica")');
  await page.fill('input[aria-label="Barrel quantity"]', String(qty));
  await setDate(page, "Pickup date", "2026-07-28");
  await setDate(page, "Delivery date", "2026-08-20");
  if (addon) await page.check('input[type="checkbox"]');
  await page.waitForTimeout(250);
  const gq = page.locator("button", { hasText: "Get quotes" });
  for (let i = 0; i < (await gq.count()); i++) { const c = (await gq.nth(i).getAttribute("class")) || ""; if (c.includes("c1a35e")) { await gq.nth(i).click(); break; } }
  await page.waitForTimeout(4000);
  await page.waitForSelector("div.cursor-pointer.rounded-xl", { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll("div.cursor-pointer.rounded-xl")];
    const target = cards.find((c) => /\$\s?100(?!\d|\.\d*[1-9])/.test(c.textContent));
    if (target && !target.className.includes("border-white")) target.click();
  });
  await page.waitForTimeout(600);
  // fill the booking form (self-healing like flow-pricing-v2), then Review & Order
  const fillAllLabeled = async () => {
    const blocks = page.locator("div:has(> label):has(> input)");
    const n = await blocks.count();
    for (let i = 0; i < n; i++) {
      const b = blocks.nth(i);
      const input = b.locator("> input").first();
      if (!(await input.isVisible().catch(() => false))) continue;
      if (await input.inputValue()) continue;
      const l = ((await b.locator("> label").first().innerText().catch(() => "")) || "").toLowerCase();
      if (/optional/.test(l)) continue;
      let v = "";
      if (l.includes("first")) v = "Delroy";
      else if (l.includes("last")) v = "Brown";
      else if (l.includes("email")) v = "e2e-user@vership.test";
      else if (l.includes("street") || l === "address") v = "100 SE 2nd St";
      else if (l.includes("city") || l.includes("town")) v = "Fort Lauderdale";
      else if (l === "state") v = "Florida";
      if (v) await input.fill(v).catch(() => {});
    }
    const phoneBlocks = page.locator('div:has(label:text-is("Phone Number"))');
    for (let i = 0; i < (await phoneBlocks.count()); i++) {
      const blk = phoneBlocks.nth(i);
      const inp = blk.locator("input:visible").last();
      if (!(await inp.count())) continue;
      if (await inp.inputValue().catch(() => "x")) continue;
      const ctx = (await blk.innerText().catch(() => "")) || "";
      await inp.fill(/1876/.test(ctx) ? "8765551234" : "3055551234").catch(() => {});
    }
    const sels = page.locator("select").filter({ has: page.locator('option:text-is("Select parish")') });
    for (let i = 0; i < (await sels.count()); i++) await sels.nth(i).selectOption("Kingston").catch(() => {});
  };
  await fillAllLabeled();
  for (let round = 0; round < 4; round++) {
    await page.locator("button", { hasText: "Review & Order" }).first().click();
    await page.waitForTimeout(3500);
    if (!page.url().includes("quotes")) break;
    const errs = await page.locator("p.text-red-400:visible").allInnerTexts().catch(() => []);
    if (!errs.length) break;
    await fillAllLabeled();
  }
  await page.waitForTimeout(2500);
  return page.locator("body").innerText();
}

/* ═══ 1. Landing + drop-off add-on ═══ */
console.log("\n═══ 1. Start a Shipment + drop-off add-on ═══");
const ctx1 = await browser.newContext();
const p1 = await ctx1.newPage();
await p1.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await p1.fill('input[name="email"]', "e2e-user@vership.test");
await p1.fill('input[name="password"]', "Test@1234");
await p1.click('form button[type="submit"]');
await p1.waitForTimeout(2500);

const bodyNoAddon = await landingToCheckout(p1, { qty: 2, addon: false });
check("1a: checkout WITHOUT add-on has no drop-off line", !/Barrel Drop-Off \(add-on\)/i.test(bodyNoAddon));
const totalNoAddon = money(bodyNoAddon, "Total Due");
check("1a: total renders", totalNoAddon != null, `$${totalNoAddon}`);

const bodyAddon = await landingToCheckout(p1, { qty: 2, addon: true });
check("1b: add-on line shown", /Barrel Drop-Off \(add-on\)/i.test(bodyAddon));
const addonAmt = money(bodyAddon, "Barrel Drop-Off \\(add-on\\)");
check("1b: add-on = $300 (2 × $150 dropoff rate)", addonAmt === 300, `got $${addonAmt}`);
const totalAddon = money(bodyAddon, "Total Due");
check("1b: total grew by exactly the add-on", totalAddon != null && totalNoAddon != null && Math.abs(totalAddon - totalNoAddon - 300) < 0.01, `${totalNoAddon} → ${totalAddon}`);
await p1.screenshot({ path: `${SCRATCH}/qa-addon-checkout.png`, fullPage: true });

if (process.env.QA_ONLY_S1) {
  await browser.close();
  const failed1 = results.filter((r) => !r).length;
  console.log(`\n==== S1 ONLY: ${results.length - failed1}/${results.length} passed ====`);
  process.exit(failed1 ? 1 : 0);
}

/* ═══ 2. Logged-out: add-on survives the login redirect ═══ */
console.log("\n═══ 2. Logged-out landing keeps the add-on flag ═══");
const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(1000);
await p2.click('button[aria-label="Select origin"]'); await p2.waitForTimeout(250);
await p2.click('li[role=option] button:has-text("Fort Lauderdale, FL")');
await p2.click('button[aria-label="Select destination"]'); await p2.waitForTimeout(250);
await p2.click('li[role=option] button:has-text("Kingston, Jamaica")');
await p2.fill('input[aria-label="Barrel quantity"]', "3");
await setDate(p2, "Pickup date", "2026-07-28");
await setDate(p2, "Delivery date", "2026-08-20");
await p2.check('input[type="checkbox"]');
const gq2 = p2.locator("button", { hasText: "Get quotes" });
for (let i = 0; i < (await gq2.count()); i++) { const c = (await gq2.nth(i).getAttribute("class")) || ""; if (c.includes("c1a35e")) { await gq2.nth(i).click(); break; } }
await p2.waitForTimeout(1500);
check("2a: redirected to login", p2.url().includes("/login"));
const pending = await p2.evaluate(() => JSON.parse(localStorage.getItem("pending_booking_payload") || "{}"));
check("2b: pending payload keeps dropoff_addon=1", pending.dropoff_addon === 1, JSON.stringify({ dropoff_addon: pending.dropoff_addon, qty: pending.items?.[0]?.quantity }));

/* ═══ 3. Prepacked payment: cancel + declined card + recovery ═══ */
console.log("\n═══ 3. Prepacked payment edge cases ═══");
const ctx3 = await browser.newContext();
const p3 = await ctx3.newPage();
const EMAIL3 = `e2e-qa-${Date.now()}@vership.test`;
async function fillPrepackedForm(page, email) {
  await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: "networkidle" });
  await page.locator("button, a").filter({ hasText: /order|choose|select/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.fill('input[name="firstName"]', "QA");
  await page.fill('input[name="lastName"]', "Tester");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', "4155550123");
  await page.fill('input[name="recipient_name"]', "QA Recipient");
  await page.fill('input[name="recipient_phone"]', "8765550123");
  await page.fill('input[name="delivery_street"]', "1 QA Street");
  await page.fill('input[name="delivery_town"]', "Kingston");
  await page.selectOption('select[name="delivery_parish"]', "Kingston");
  await page.click('form button[type="submit"]');
  await page.waitForSelector("text=/complete payment/i", { timeout: 15000 });
}
// 3a: cancel backs out without a confirmation
await fillPrepackedForm(p3, EMAIL3);
const orderId3a = ((await p3.textContent("body")).match(/ORD-PP-[\d-]+/) || [])[0];
await p3.locator("button", { hasText: "Cancel" }).click();
await p3.waitForTimeout(1200);
const body3a = await p3.textContent("body");
check("3a: cancel returns to page, no false confirmation", !/your order is in/i.test(body3a));
check("3a: cancel toast shown", /not confirmed|cancelled/i.test(body3a));

// 3b: declined card shows the error and stays on the payment step
await fillPrepackedForm(p3, EMAIL3);
const orderId3b = ((await p3.textContent("body")).match(/ORD-PP-[\d-]+/) || [])[0];
const frame3 = p3.frameLocator('iframe[name^="__privateStripe"]').first();
await frame3.locator('input[name="number"]').fill("4000000000000002", { timeout: 20000 });
await frame3.locator('input[name="expiry"]').fill("12/30");
await frame3.locator('input[name="cvc"]').fill("123");
const zip3 = frame3.locator('input[name="postalCode"]');
if (await zip3.count()) await zip3.fill("33101");
await p3.locator("button", { hasText: /^Pay \$/ }).click();
// toast lives ~4s — poll for it rather than sleeping past it
let declineSeen = false;
for (let i = 0; i < 16 && !declineSeen; i++) {
  await p3.waitForTimeout(500);
  declineSeen = /declined/i.test(await p3.textContent("body"));
}
const body3b = await p3.textContent("body");
check("3b: declined card shows error, no confirmation", declineSeen && !/your order is in/i.test(body3b));

// 3c: retry with a good card on the SAME order succeeds
await frame3.locator('input[name="number"]').fill("4242424242424242");
await p3.locator("button", { hasText: /^Pay \$/ }).click();
await p3.waitForSelector("text=/your order is in/i", { timeout: 30000 });
check("3c: recovery — good card after decline confirms order", true);
fs.writeFileSync(`${SCRATCH}/qa-order-ids.json`, JSON.stringify({ cancelled: orderId3a, recovered: orderId3b }));

/* ═══ 4. Additional cost: validation → request → pay → both sides ═══ */
console.log("\n═══ 4. Additional cost end-to-end ═══");
const authP = JSON.parse(fs.readFileSync(`${SCRATCH}/auth-381.json`));
const authC = JSON.parse(fs.readFileSync(`${SCRATCH}/auth-509.json`));
const ctx4p = await browser.newContext();
const p4p = await ctx4p.newPage();
await p4p.addInitScript((u) => { localStorage.setItem("token", u.token); localStorage.setItem("user", JSON.stringify(u)); localStorage.setItem("is_login", 1); }, authP);
await p4p.goto(`${BASE}/history`, { waitUntil: "networkidle" });
await p4p.waitForTimeout(1500);
await p4p.locator("button", { hasText: "Additional Cost" }).first().click();
await p4p.waitForTimeout(400);
// validation: empty submit
await p4p.locator("button", { hasText: "Send Request" }).click();
await p4p.waitForTimeout(600);
check("4a: empty amount rejected", /valid amount/i.test(await p4p.textContent("body")));
// valid request
await p4p.fill('input[type="number"]', "12.50");
await p4p.fill("textarea", "QA sweep — re-delivery fee");
await p4p.locator("button", { hasText: "Send Request" }).click();
await p4p.waitForTimeout(2000);
check("4b: request sent (toast)", /customer has been emailed/i.test(await p4p.textContent("body")));
await p4p.reload({ waitUntil: "networkidle" });
await p4p.waitForTimeout(1200);
check("4c: provider sees 'Awaiting payment'", /Awaiting payment/i.test(await p4p.textContent("body")));

// customer pays it
const ctx4c = await browser.newContext();
const p4c = await ctx4c.newPage();
await p4c.addInitScript((u) => { localStorage.setItem("token", u.token); localStorage.setItem("user", JSON.stringify(u)); localStorage.setItem("is_login", 1); }, authC);
await p4c.goto(`${BASE}/history`, { waitUntil: "networkidle" });
await p4c.waitForTimeout(1500);
const body4c = await p4c.textContent("body");
check("4d: customer sees the charge + Pay Now", /re-delivery fee/i.test(body4c) && /\$12\.50/.test(body4c));
await p4c.locator("button", { hasText: "Pay Now" }).first().click();
await p4c.waitForTimeout(3000);
const frame4 = p4c.frameLocator('iframe[name^="__privateStripe"]').first();
await frame4.locator('input[name="number"]').fill("4242424242424242", { timeout: 20000 });
await frame4.locator('input[name="expiry"]').fill("12/30");
await frame4.locator('input[name="cvc"]').fill("123");
const zip4 = frame4.locator('input[name="postalCode"]');
if (await zip4.count()) await zip4.fill("33101");
await p4c.locator("button", { hasText: /^Pay \$/ }).click();
await p4c.waitForTimeout(6000);
await p4c.reload({ waitUntil: "networkidle" });
await p4c.waitForTimeout(1500);
const paidRow = await p4c.evaluate(() => {
  const rows = [...document.querySelectorAll("div")].filter((d) => /re-delivery fee/i.test(d.textContent) && /\$12\.50/.test(d.textContent));
  return rows.some((r) => /Paid/.test(r.textContent));
});
check("4e: customer side shows Paid after payment", paidRow);
await p4p.reload({ waitUntil: "networkidle" });
await p4p.waitForTimeout(1500);
check("4f: provider side shows Paid too", !/Awaiting payment/i.test(await p4p.textContent("body")));
await p4c.screenshot({ path: `${SCRATCH}/qa-additional-cost-paid.png`, fullPage: true });

/* ═══ 5. Print receipts ═══ */
console.log("\n═══ 5. Print receipts ═══");
const [popup] = await Promise.all([
  p4c.waitForEvent("popup", { timeout: 10000 }),
  p4c.locator("button", { hasText: "Print" }).first().click(),
]);
await popup.waitForLoadState("domcontentloaded").catch(() => {});
await popup.waitForTimeout(600);
const popBody = await popup.textContent("body").catch(() => "");
check("5a: booking receipt opens with VerShip branding", /VerShip/.test(popBody));
check("5b: receipt has order + status rows", /Order ID/.test(popBody) && /Status/.test(popBody));
await popup.close().catch(() => {});

/* ═══ 6. Mobile spot-check (390px) ═══ */
console.log("\n═══ 6. Mobile viewport ═══");
const ctx6 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p6 = await ctx6.newPage();
await p6.goto(`${BASE}/`, { waitUntil: "networkidle" });
const cb = p6.locator('input[type="checkbox"]');
check("6a: add-on checkbox visible on mobile", await cb.isVisible());
const hasHScroll = await p6.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5);
check("6b: no horizontal scroll on mobile landing", !hasHScroll);
await p6.screenshot({ path: `${SCRATCH}/qa-mobile-landing.png` });

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n==== QA SWEEP: ${results.length - failed}/${results.length} passed ====`);
process.exit(failed ? 1 : 0);
