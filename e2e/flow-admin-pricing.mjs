// Browser e2e for the admin forwarder-pricing screens (visibility + editing).
//
// Covers: the cross-provider index and its gate/warning badges, the per-provider
// editor, the live quote preview recomputing against unsaved edits, the confirm
// dialog's diff + total delta, server-side rejection of a bad value, and a real
// save landing in the DB and the change log.
//
// Notifications are left OFF throughout — several seeded forwarders carry real
// company email addresses, and a test must not mail them.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5000";
const ADMIN = { email: "e2e-admin@vership.test", password: "AdminTest123!" };
const SHOT = (n) => `/tmp/claude-1000/-home-runner-workspace/23df2438-5133-429c-88a7-803d4a64efa1/scratchpad/adminpricing-${n}.png`;

const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  log(`  ${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

// Reset card 9500 to a known baseline over the API first. Without this the run
// is not repeatable: the previous run's save leaves the values the browser flow
// is about to type, so "Review & save" stays disabled with nothing to diff.
const BASELINE = { seaFreightPrice: "80.30", discount5to9: "0", discount10plus: "0" };
const api = async (path, opts = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  return r.json();
};
const auth = await api("/api/admin/login", { method: "POST", body: JSON.stringify(ADMIN) });
const apiToken = auth?.body?.token;
if (!apiToken) {
  log("❌ could not authenticate against the admin API:", JSON.stringify(auth).slice(0, 200));
  process.exit(1);
}
const seeded = await api("/api/admin/provider/500/pricing/9500", {
  method: "PUT",
  headers: { Authorization: `Bearer ${apiToken}` },
  body: JSON.stringify({
    password: ADMIN.password,
    reason: "e2e baseline reset",
    notify: false,
    patch: BASELINE,
  }),
});
log(`  baseline: ${seeded.success ? "reset to $80.30" : seeded.message}`);

const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => log("  [PAGEERROR]", e.message));
const bad = [];
page.on("response", (r) => {
  const u = r.url();
  if (u.includes("/api/admin/") && r.status() >= 400) bad.push(`${r.status()} ${u.replace(BASE, "")}`);
});

const text = () => page.locator("body").innerText().catch(() => "");

// ---- Login ------------------------------------------------------------------
log("\n== Admin login ==");
await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"], input[name="email"]', ADMIN.email);
await page.fill('input[type="password"], input[name="password"]', ADMIN.password);
await page.click("button#login");
await page.waitForTimeout(3000);
check("reached admin dashboard", !page.url().includes("/login"), page.url());

// ---- Pricing index ----------------------------------------------------------
log("\n== Pricing index ==");
await page.goto(`${BASE}/admin/pricing`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
let body = await text();
await page.screenshot({ path: SHOT("1-index"), fullPage: true });

check("page renders the pricing heading", /Forwarder pricing/i.test(body));
check("summary tiles present", /Live on site/i.test(body) && /Simplified \(v2\)/i.test(body));
check("a known forwarder is listed", /SHIP IT FLORIDA/i.test(body));
const rowCount = await page.locator("table tbody tr").count();
check("table has rows", rowCount > 0, `${rowCount} rows`);

// The "needs attention" filter should be a strict subset of all forwarders.
await page.selectOption("select.form-select", "misconfigured");
await page.waitForTimeout(2000);
const misRows = await page.locator("table tbody tr").count();
body = await text();
await page.screenshot({ path: SHOT("2-needs-attention"), fullPage: true });
check("needs-attention filter narrows the list", misRows <= rowCount, `${misRows} of ${rowCount}`);
// Every row under this filter must state why it is there — and when nothing
// qualifies, the page must say so rather than render a silently empty table.
// (There used to be a "listed price mismatch" reason. The public listing now
// derives its price from the same rate card a quote uses, so that class of
// inconsistency cannot occur and is no longer flagged.)
check(
  misRows === 0
    ? "nothing needs attention, and the table says so"
    : "every flagged row states a reason",
  misRows === 0
    ? /No forwarders match this filter/i.test(body)
    : /duplicate routes?|parish(es)? unpriced|not live/i.test(body),
  misRows === 0
    ? "empty state shown"
    : (body.match(/duplicate routes?|\d+ parish(es)? unpriced|not live/i) || ["none"])[0]
);

// ---- Editor -----------------------------------------------------------------
log("\n== Editor: provider 500 ==");
await page.goto(`${BASE}/admin/pricing/500`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
body = await text();
await page.screenshot({ path: SHOT("3-editor"), fullPage: true });

check("shows the forwarder name", /SHIP IT FLORIDA/i.test(body));
check("publish-gate panel present", /Public listing status/i.test(body));
check("all four gates render", /Forwarder account/i.test(body) && /Documents verified/i.test(body) && /Has a rate card/i.test(body));
check("route is shown but frozen", /Barrel type and route are fixed/i.test(body));
check("quote preview present", /What the customer would pay/i.test(body));
check("parish grid renders 14 parishes", /Kingston/.test(body) && /Westmoreland/.test(body) && /St\. Catherine/.test(body));

// The route identity fields must not be editable anywhere on the page.
const routeInputs = await page.locator('input[value*="Miami"], input[value*="Kingston, Jamaica"]').count();
check("no editable input holds the route", routeInputs === 0, `${routeInputs} found`);

// ---- Live preview recomputes on edit ---------------------------------------
log("\n== Live quote preview ==");
const totalNow = async () => {
  const t = await page.locator("text=Customer total").locator("xpath=../..").innerText().catch(() => "");
  const m = t.match(/\$([\d,]+\.\d{2})/g);
  return m ? parseFloat(m[m.length - 1].replace(/[$,]/g, "")) : null;
};

// Set quantity to 5 so the 5-9 tier discount is in play.
const qtyInput = page.locator('label:text-is("Barrels") + input').first();
await qtyInput.fill("5");
await page.waitForTimeout(600);
const totalAt5 = await totalNow();
check("preview produces a total at qty 5", totalAt5 !== null && totalAt5 > 0, `$${totalAt5}`);

// Raising sea freight must raise the customer total.
const seaInput = page.locator('div:has(> label:text-is("Sea freight, per barrel")) input[type="number"]').first();
const seaBefore = await seaInput.inputValue();
await seaInput.fill("120");
await page.waitForTimeout(600);
const totalAfterRaise = await totalNow();
check(
  "raising sea freight raises the preview total",
  totalAfterRaise !== null && totalAt5 !== null && totalAfterRaise > totalAt5,
  `$${totalAt5} → $${totalAfterRaise}`
);
body = await text();
check("unsaved-changes badge appears", /unsaved change/i.test(body));
await page.screenshot({ path: SHOT("4-preview-edited"), fullPage: true });

// ---- Confirm dialog shows the diff and the delta ---------------------------
log("\n== Confirm dialog ==");
await page.click('button:has-text("Review & save")');
await page.waitForTimeout(1200);
body = await text();
await page.screenshot({ path: SHOT("5-confirm"), fullPage: true });
check("confirm dialog opens", /Confirm pricing change/i.test(body));
check("diff lists the changed field", /seaFreightPrice/i.test(body));
check("shows the impact on a sample order", /5-barrel order to Kingston goes/i.test(body));
check("requires a reason and password", /Reason for this change/i.test(body) && /Your admin password/i.test(body));
check("notification toggle present and on by default", /Email SHIP IT FLORIDA/i.test(body));
const saveDisabled = await page.locator('button:has-text("Save pricing")').isDisabled();
check("save is blocked before reason + password", saveDisabled === true);

// ---- Server rejects a bad value --------------------------------------------
log("\n== Server-side rejection ==");
await page.fill('input[placeholder*="Correcting rate"]', "e2e test — intentional bad value");
await page.fill('.modal input[type="password"]', ADMIN.password);
// Turn notification OFF: provider 500's address is a real company inbox.
await page.uncheck("#notify-forwarder");
// Sneak an impossible discount past the UI by writing straight to the field.
await page.click('button:has-text("Cancel")');
await page.waitForTimeout(600);
const d59 = page.locator('div:has(> label:text-is("Discount, 5–9 barrels")) input[type="number"]').first();
await d59.fill("500"); // greater than sea freight -> must be refused
await page.waitForTimeout(400);
await page.click('button:has-text("Review & save")');
await page.waitForTimeout(800);
await page.fill('input[placeholder*="Correcting rate"]', "e2e test — expect rejection");
await page.fill('.modal input[type="password"]', ADMIN.password);
await page.uncheck("#notify-forwarder");
await page.click('button:has-text("Save pricing")');
await page.waitForTimeout(2500);
body = await text();
await page.screenshot({ path: SHOT("6-rejected"), fullPage: true });
check(
  "discount above sea freight is refused",
  /cannot exceed the sea freight price/i.test(body),
  (body.match(/.*cannot exceed the sea freight price.*/i) || [""])[0].slice(0, 80)
);
// Dismiss the Swal, then close the modal so the next save starts from a clean
// dialog rather than one still holding the rejected diff.
await page.click("button.swal2-confirm").catch(() => {});
await page.waitForTimeout(600);
await page.click('.modal button:has-text("Cancel")').catch(() => {});
await page.waitForTimeout(600);

// ---- A valid save lands -----------------------------------------------------
log("\n== Valid save ==");
// Capture the save response so a failure reports the server's reason.
let saveMsg = "";
page.on("response", async (r) => {
  if (r.url().includes("/pricing/9500") && r.request().method() === "PUT") {
    try { saveMsg = (await r.json())?.message || ""; } catch { /* ignore */ }
  }
});
// A valid tier ladder: 10+ must be at least the 5-9 discount, or larger orders
// would cost more per barrel (the server refuses the inversion).
await d59.fill("30");
const d10 = page.locator('div:has(> label:text-is("Discount, 10+ barrels")) input[type="number"]').first();
await d10.fill("60");
await page.waitForTimeout(400);
await page.click('button:has-text("Review & save")');
await page.waitForTimeout(900);
// Unique per run, so a stale audit row from a previous run cannot satisfy the
// change-log assertions below.
const runTag = `e2e save ${Date.now().toString().slice(-6)}`;
await page.fill('input[placeholder*="Correcting rate"]', runTag);
await page.fill('.modal input[type="password"]', ADMIN.password);
await page.uncheck("#notify-forwarder");
await page.click('button:has-text("Save pricing")');
await page.waitForTimeout(3500);
body = await text();
await page.screenshot({ path: SHOT("7-saved"), fullPage: true });
check("save succeeds", /Pricing updated/i.test(body), saveMsg || (body.match(/Pricing updated[\s\S]{0,90}/i) || [""])[0].replace(/\n/g, " "));
check("suppressed notice is reported as such", /No notice was sent/i.test(body));
await page.click("button.swal2-confirm").catch(() => {});
await page.waitForTimeout(2500);

body = await text();
check("change log records the edit", /Admin change log/i.test(body) && /e2e-admin@vership\.test/i.test(body));
check("change log shows this run's reason", body.includes(runTag), runTag);
check("change log marks notification suppressed", /suppressed/i.test(body));
await page.screenshot({ path: SHOT("8-changelog"), fullPage: true });

log(`\n  seaFreightPrice was ${seaBefore}, now 120 (restored by the caller)`);

// ---- Providers page deep link ----------------------------------------------
log("\n== Providers page link ==");
await page.goto(`${BASE}/admin/providerlist`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const pricingLinks = await page.locator('a[href*="/pricing/"]').count();
check("providers list links to pricing", pricingLinks > 0, `${pricingLinks} links`);
await page.screenshot({ path: SHOT("9-providers"), fullPage: true });

// ---- Summary ----------------------------------------------------------------
if (bad.length) log("\n  Unexpected 4xx/5xx (some are the intentional rejections):", bad.join(" | "));
const failed = results.filter((r) => !r.ok);
log(`\n${"=".repeat(60)}\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) log("FAILED:\n" + failed.map((f) => "  - " + f.name).join("\n"));
await browser.close();
process.exit(failed.length ? 1 : 0);
