// Exercises the two paths the v2 flow does not: the legacy-model editor form,
// and retiring a card on a provider that has more than one.
import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000";
const ADMIN = { email: "e2e-admin@vership.test", password: "AdminTest123!" };
const SHOT = (n) => `/tmp/claude-1000/-home-runner-workspace/23df2438-5133-429c-88a7-803d4a64efa1/scratchpad/legacy-${n}.png`;
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); console.log(`  ${ok ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`); };

const api = async (p, o = {}) =>
  (await fetch(`${BASE}${p}`, { ...o, headers: { "Content-Type": "application/json", ...(o.headers || {}) } })).json();
const tok = (await api("/api/admin/login", { method: "POST", body: JSON.stringify(ADMIN) })).body.token;
const H = { Authorization: `Bearer ${tok}` };

// Reset card 9509's base price to a known baseline first. Without this the run
// is not repeatable: the previous run already saved 200, so the browser flow
// types the value that is already there, "Review & save" has nothing to diff
// and stays disabled, and the click times out.
const BASELINE_BASE_PRICE = "150";
const reset = await api("/api/admin/provider/417/pricing/9509", {
  method: "PUT",
  headers: H,
  body: JSON.stringify({
    patch: { basePrice: BASELINE_BASE_PRICE },
    password: ADMIN.password,
    reason: "e2e baseline reset",
    notify: false,
  }),
});
console.log(`  baseline: ${reset.success ? `card 9509 reset to $${BASELINE_BASE_PRICE}` : reset.message}`);

// ---- Legacy editor in the browser -------------------------------------------
console.log("\n== Legacy-model editor (provider 417) ==");
const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1200 } })).newPage();
page.on("pageerror", (e) => console.log("  [PAGEERROR]", e.message));

await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', ADMIN.email);
await page.fill('input[type="password"]', ADMIN.password);
await page.click("button#login");
await page.waitForTimeout(3000);

await page.goto(`${BASE}/admin/pricing/417`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
let body = await page.locator("body").innerText();
await page.screenshot({ path: SHOT("1-editor"), fullPage: true });

check("legacy badge shown", /legacy/i.test(body));
check("legacy fields render", /Base price, per barrel/i.test(body) && /Price per mile/i.test(body));
check("volume discount control present", /Volume discount/i.test(body));
check("legacy customs CSV field present", /legacy 25-slot list/i.test(body));
check("no parish grid on a legacy card", !/Customs & delivery, by parish/i.test(body));
check("preview still renders a total", /Customer total/i.test(body));
check("retired-cards history panel present", /Retired rate cards/i.test(body));

// Legacy preview should react to a base-price change.
const totalNow = async () => {
  const t = await page.locator("text=Customer total").first().locator("xpath=../..").innerText().catch(() => "");
  const m = t.match(/\$([\d,]+\.\d{2})/g);
  return m ? parseFloat(m[m.length - 1].replace(/[$,]/g, "")) : null;
};
const before = await totalNow();
const baseInput = page.locator('div:has(> label:text-is("Base price, per barrel")) input[type="number"]').first();
await baseInput.fill("200");
await page.waitForTimeout(700);
const after = await totalNow();
check("legacy preview reacts to base price", after !== null && before !== null && after > before, `$${before} → $${after}`);
await page.screenshot({ path: SHOT("2-preview"), fullPage: true });

// Regression: card 9509 carries customsAndHandling "Included" — real legacy data
// that is not a number. Editing an unrelated field must not put that value
// through money validation, so the client sends only what changed.
console.log("\n== Non-numeric legacy value does not block an unrelated edit ==");
const csv = page.locator('input.font-monospace').first();
check("card holds a non-numeric customs value", (await csv.inputValue()) === "Included", await csv.inputValue());
await page.click('button:has-text("Review & save")');
await page.waitForTimeout(900);
let saveMsg = "";
page.on("response", async (r) => {
  if (r.url().includes("/pricing/") && r.request().method() === "PUT") {
    try { saveMsg = (await r.json())?.message || ""; } catch { /* ignore */ }
  }
});
await page.fill('input[placeholder*="Correcting rate"]', `e2e legacy base price ${Date.now().toString().slice(-6)}`);
await page.fill('.modal input[type="password"]', ADMIN.password);
await page.uncheck("#notify-forwarder");
await page.click('button:has-text("Save pricing")');
await page.waitForTimeout(3000);
const afterBody = await page.locator("body").innerText();
check("base-price edit saves despite the non-numeric field", /Pricing updated/i.test(afterBody), saveMsg);
await page.screenshot({ path: SHOT("3-saved"), fullPage: true });
await browser.close();

// The untouched field must still hold its original value.
const reread = await api("/api/admin/provider/417/pricing", { headers: H });
const card9509 = reread.body.cards.find((c) => c.id === 9509);
check("untouched customs value preserved", card9509?.customsAndHandling === "Included", String(card9509?.customsAndHandling));
check("base price actually changed", parseFloat(card9509?.basePrice) === 200, String(card9509?.basePrice));

// ---- Retire path over the API ----------------------------------------------
console.log("\n== Retire a card (provider 417 has several) ==");
const pricing = await api("/api/admin/provider/417/pricing", { headers: H });
const cards = pricing.body.cards;
console.log(`  provider 417 live cards: ${cards.length}`);
const victim = cards[cards.length - 1];

const noReason = await api(`/api/admin/provider/417/pricing/${victim.id}`, {
  method: "DELETE", headers: H,
  body: JSON.stringify({ password: ADMIN.password, notify: false }),
});
check("retire without a reason is refused", !noReason.success, noReason.message);

const badPw = await api(`/api/admin/provider/417/pricing/${victim.id}`, {
  method: "DELETE", headers: H,
  body: JSON.stringify({ password: "wrong", reason: "test", notify: false }),
});
check("retire with a wrong password is refused", !badPw.success, badPw.message);

const done = await api(`/api/admin/provider/417/pricing/${victim.id}`, {
  method: "DELETE", headers: H,
  body: JSON.stringify({ password: ADMIN.password, reason: "e2e — retiring a duplicate card", notify: false }),
});
check("retire succeeds", done.success === true, done.message);

const after2 = await api("/api/admin/provider/417/pricing", { headers: H });
check("card count drops by one", after2.body.cards.length === cards.length - 1, `${cards.length} → ${after2.body.cards.length}`);
check("retired card moves to history", after2.body.history.some((h) => h.id === victim.id));
check("retire is audit-logged", after2.body.audit.some((a) => a.action === "retire" && a.cardId === victim.id));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log("FAILED:\n" + failed.map((f) => "  - " + f.n).join("\n"));
process.exit(failed.length ? 1 : 0);
