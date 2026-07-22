// Browser test: consolidated freight-forwarder signup flow.
// Signup (all details once) -> OTP page -> [verify via DB] -> login resumes at docs
// -> upload docs -> lands on pricing. Checks DB rows created at registration.
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";

const BASE = "http://localhost:5000";
const SCRATCH = "/tmp/claude-1000/-home-runner-workspace/b053e698-4d65-4944-8bc6-512a42d0754a/scratchpad";
const SHOT = (n) => `${SCRATCH}/su-${n}.png`;
const EMAIL = `e2e-ff-${Date.now()}@vership.test`;
const PHONE = `9${String(Date.now()).slice(-9)}`;

const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await (await browser.newContext()).newPage();
const log = (...a) => console.log(...a);
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); log(`  ${ok ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`); };
page.on("pageerror", (e) => log("  [PAGEERROR]", e.message));

// run a one-off query through the server's sequelize models
const dbEval = (code) => execSync(
  `node -e 'const db=require("/home/runner/workspace/server/models"); (async()=>{ ${code} process.exit(0); })().catch(e=>{console.error(e.message);process.exit(1)})'`,
  { encoding: "utf8" }
).trim();

try {
  // ---------- 1. Signup page: consolidated fields render ----------
  await page.goto(`${BASE}/businessSignup`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const body = () => page.locator("body").innerText().then((t) => t.replace(/\n{2,}/g, "\n"));
  let b = await body();
  await page.screenshot({ path: SHOT("form"), fullPage: true });
  check("legal name field", /Legal Name of Business/i.test(b));
  check("zip code field", /Zip Code/i.test(b));
  check("FMC license field", /FMC License/i.test(b));
  check("primary contact first+last fields", /Primary Contact First Name/i.test(b) && /Primary Contact Last Name/i.test(b));
  check("primary contact email field", /Primary Contact Email/i.test(b));

  // ---------- 2. Non-happy: submit without primary contact ----------
  await page.fill('input[name="companyName"]', "E2E Consolidated Freight LLC");
  await page.fill('input[name="email"]', EMAIL);
  await page.locator('input[type="tel"], input[placeholder="Enter"][inputmode], input[name="phone"]').first().fill(PHONE).catch(async () => {
    await page.locator("input").nth(3).fill(PHONE);
  });
  // address typed manually — the Places Autocomplete input has no name attr,
  // target it via its label's container instead
  const addr = page.locator('div:has(> label:has-text("Street Address")) input').first();
  await addr.fill("100 Harbor Way, Miami, FL");
  await page.fill('input[name="city"]', "Miami");
  await page.fill('input[name="state"]', "Florida");
  await page.fill('input[name="password"]', "Test@1234");
  await page.fill('input[name="confirmPassword"]', "Test@1234");
  await page.locator('input[name="agreeTerms"]').check();
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(1200);
  check("missing zip/contact blocks submit", page.url().includes("businessSignup"));

  // ---------- 3. Happy path ----------
  await page.fill('input[name="zip"]', "33101");
  await page.fill('input[name="registerationNumber"]', "FMC-019876");
  await page.fill('input[name="primaryContactFirstName"]', "Paula");
  await page.fill('input[name="primaryContactLastName"]', "Contact");
  await page.fill('input[name="primaryContactEmail"]', "paula.contact@vership.test");
  await page.screenshot({ path: SHOT("filled"), fullPage: true });
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(3000);
  check("signup -> OTP page", page.url().includes("businessverification"), page.url());
  await page.screenshot({ path: SHOT("otp"), fullPage: true });

  // ---------- 4. DB: registration seeded the full provider profile ----------
  const dbOut = dbEval(`
    const u = await db.users.findOne({ where: { email: ${JSON.stringify(EMAIL)} } });
    const pd = u && await db.providerDetails.findOne({ where: { providerId: u.id } });
    const sr = u && await db.serviceAreaRoutes.findOne({ where: { providerId: u.id } });
    console.log(JSON.stringify({
      user: u && { step: u.profile_step, zip: u.zip },
      pd: pd && { businessName: pd.businessName, zip: pd.zip, reg: pd.registerationNumber,
        pcFirst: pd.primaryContactPersonFirstName, pcLast: pd.primaryContactPersonLastName,
        pcFull: pd.primaryContactPerson, pcEmail: pd.primaryContactEmail,
        timeline: pd.deliveryTimeline, email: pd.email, docVerify: pd.documentVerify },
      route: sr && { country: sr.country, freightType: sr.freightType },
    }));
  `);
  const row = JSON.parse(dbOut.split("\n").pop());
  log("  DB:", JSON.stringify(row));
  check("users.profile_step=3 + zip stored", row.user?.step === 3 && row.user?.zip === "33101");
  check("providerDetails seeded at signup", row.pd?.businessName === "E2E Consolidated Freight LLC" && row.pd?.zip === "33101" && row.pd?.reg === "FMC-019876");
  check("primary contact stored", row.pd?.pcFirst === "Paula" && row.pd?.pcLast === "Contact" && row.pd?.pcFull === "Paula Contact" && row.pd?.pcEmail === "paula.contact@vership.test");
  check("defaults: 21 Days timeline + USA/Sea route", row.pd?.timeline === "21 Days" && row.route?.country === "USA" && Number(row.route?.freightType) === 2);

  // ---------- 5. Verify email via DB (OTP is hashed at rest), then login ----------
  dbEval(`await db.users.update({ otpVerify: "1" }, { where: { email: ${JSON.stringify(EMAIL)} } });`);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', "Test@1234");
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(3000);
  check("login not blocked by admin gate (no docs yet)", !page.url().includes("/login"), page.url());
  check("login resumes at document upload", page.url().includes("businessdoument"), page.url());
  b = await body();
  check("docs page shows 2-step progress", (await page.locator("div.h-\\[4px\\]").count()) === 2);
  await page.screenshot({ path: SHOT("docs"), fullPage: true });

  // ---------- 6. Upload docs -> modal -> pricing ----------
  const png = `${SCRATCH}/doc.png`;
  fs.writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const inputs = page.locator('input[type="file"]');
  for (let i = 0; i < 3; i++) await inputs.nth(i).setInputFiles(png);
  await page.waitForTimeout(500);
  await page.click("button:has-text('Next')");
  await page.waitForTimeout(4000);
  b = await body();
  check("verification modal shown", /verified by admin/i.test(b));
  await page.click("button:has-text('Ok')");
  await page.waitForTimeout(2000);
  check("docs -> pricing page", page.url().includes("businessupload"), page.url());
  await page.screenshot({ path: SHOT("pricing"), fullPage: true });

  const after = JSON.parse(dbEval(`
    const u = await db.users.findOne({ where: { email: ${JSON.stringify(EMAIL)} } });
    const pd = await db.providerDetails.findOne({ where: { providerId: u.id } });
    console.log(JSON.stringify({ step: u.profile_step, cert: !!pd.certificateOfIncorporation, pcFull: pd.primaryContactPerson }));
  `).split("\n").pop());
  check("docs saved, step=6", after.step === 6 && after.cert === true);
  check("contact name NOT clobbered by doc submit", after.pcFull === "Paula Contact", after.pcFull);
} catch (e) {
  log("FATAL:", e.message);
  await page.screenshot({ path: SHOT("fatal"), fullPage: true }).catch(() => {});
  results.push({ n: "fatal", ok: false });
}

const fails = results.filter((r) => !r.ok);
log(`\n${results.length - fails.length}/${results.length} passed${fails.length ? " — FAILURES: " + fails.map((f) => f.n).join(", ") : ""}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
