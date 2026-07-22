// Browser test: OTP security hardening (48h changes) + pre-packed barrel page.
// - Business signup OTP: 6 boxes render, wrong code rejected, real code verifies -> docs
// - Resend cooldown enforced right after registration
// - Forgot-password: wrong code rejected, real code -> reset ticket -> new password -> login
// - /prepacked-barrel public page renders seeded product
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:5000";
const SCRATCH = "/tmp/claude-1000/-home-runner-workspace/b053e698-4d65-4944-8bc6-512a42d0754a/scratchpad";
const SHOT = (n) => `${SCRATCH}/otp-${n}.png`;
const EMAIL = `e2e-otp-${Date.now()}@vership.test`;
const PHONE = `8${String(Date.now()).slice(-9)}`;

const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const log = (...a) => console.log(...a);
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); log(`  ${ok ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`); };
const pageErrs = [];
page.on("pageerror", (e) => pageErrs.push(e.message));
const body = () => page.locator("body").innerText().then((t) => t.replace(/\n{2,}/g, "\n"));
const toasts = async () => (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).join(" | ");

// issue a real OTP through the server's own helper; returns the plaintext code
const issueCode = (email, purpose) => execSync(
  `node -e 'const db=require("/home/runner/workspace/server/models");const otp=require("/home/runner/workspace/server/helper/otpHelper");(async()=>{const u=await db.users.findOne({where:{email:process.env.OTP_EMAIL},order:[["createdAt","DESC"]]});const c=await otp.issueCode(u,otp.PURPOSE[process.env.OTP_PURPOSE]);console.log("CODE:"+c);process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)})'`,
  { encoding: "utf8", env: { ...process.env, OTP_EMAIL: email, OTP_PURPOSE: purpose } }
).split("CODE:")[1].trim();

const typeOtp = async (code) => {
  const boxes = page.locator("form input[type='text'], form input:not([type])");
  for (let i = 0; i < code.length; i++) await boxes.nth(i).fill(code[i]);
};

try {
  // ---------- 1. Register a throwaway forwarder via API ----------
  const reg = await (await fetch(`${BASE}/website/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "E2E OTP Freight LLC", email: EMAIL, password: "Test@1234", number: PHONE,
      countryCode: "+1", role: "2", main_address: "1 Dock St, Miami, FL", latitude: "25.77",
      longitude: "-80.19", streetAddress: "1 Dock St", city: "Miami", state: "Florida",
      zip: "33101", primaryContactPersonFirstName: "Otp", primaryContactPersonLastName: "Tester",
      primaryContactEmail: "otp.tester@vership.test",
    }),
  })).json();
  check("api register ok", reg.status === 200 || reg.status === "1", reg.message);

  // ---------- 2. Resend cooldown right after registration ----------
  const resend = await (await fetch(`${BASE}/website/resend-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL }),
  })).json();
  check("resend on cooldown after register", /wait/i.test(resend.message || ""), resend.message);

  // ---------- 3. Business OTP page: 6 boxes, wrong code rejected ----------
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate((e) => sessionStorage.setItem("userEmail", e), EMAIL);
  await page.goto(`${BASE}/businessverification`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  let b = await body();
  check("business OTP page says 6-digit", /6-digit/i.test(b));
  check("6 OTP boxes render", (await page.locator("#otp-5").count()) === 1 && (await page.locator("#otp-6").count()) === 0);
  await page.screenshot({ path: SHOT("boxes"), fullPage: false });

  await typeOtp("000000");
  await page.click("button[type='submit']");
  await page.waitForTimeout(2000);
  check("wrong signup code rejected", page.url().includes("businessverification") && /invalid|expired/i.test(await toasts()), await toasts());

  // ---------- 4. Real code verifies -> lands on docs ----------
  const code = issueCode(EMAIL, "VERIFY_EMAIL");
  check("issued real 6-digit code", /^\d{6}$/.test(code));
  await typeOtp(code);
  await page.click("button[type='submit']");
  await page.waitForTimeout(3000);
  check("real code verifies -> docs page", page.url().includes("businessdoument"), page.url());

  // ---------- 5. Forgot-password flow ----------
  await page.evaluate(() => { localStorage.removeItem("token"); localStorage.removeItem("user"); });
  await page.goto(`${BASE}/forgot`, { waitUntil: "domcontentloaded" });
  await page.fill("input", EMAIL);
  await page.click("button[type='submit']");
  await page.waitForTimeout(2500);
  check("forgot -> verification page", page.url().includes("forgot-verification"), page.url());

  await typeOtp("111111");
  await page.click("button[type='submit']");
  await page.waitForTimeout(2000);
  check("wrong reset code rejected", page.url().includes("forgot-verification") && /invalid|expired|failed/i.test(await toasts()), await toasts());

  const resetCode = issueCode(EMAIL, "RESET_PASSWORD");
  await typeOtp(resetCode);
  await page.click("button[type='submit']");
  await page.waitForTimeout(3000);
  check("real reset code -> new-password page", page.url().includes("forgot-password-reset"), page.url());

  await page.fill("input[name='newPassword']", "NewPass@123");
  await page.fill("input[name='confirmPassword']", "NewPass@123");
  await page.click("button[type='submit']");
  await page.waitForTimeout(3000);
  check("password reset -> login page", page.url().includes("/login"), page.url());

  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', "NewPass@123");
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(3000);
  check("login works with NEW password", page.url().includes("businessdoument"), page.url());

  // old password must now fail
  await page.evaluate(() => { localStorage.removeItem("token"); localStorage.removeItem("user"); });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', "Test@1234");
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(2500);
  check("old password rejected", page.url().includes("/login"), await toasts());

  // ---------- 6. Pre-packed barrel public page ----------
  await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: "domcontentloaded" });
  // product hydrates from the API — wait for it rather than a fixed pause
  await page.locator("text=/order this barrel/i").waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  b = await body();
  await page.screenshot({ path: SHOT("prepacked"), fullPage: true });
  check("prepacked page renders product + price", /order this barrel/i.test(b) && /(\$|USD)\s?[\d,]+/.test(b), b.slice(0, 80).replace(/\n/g, " "));
  check("prepacked page has order CTA", /(order|buy|get|request|checkout|reserve)/i.test(b));
  check("no page errors across run", pageErrs.length === 0, pageErrs.join("; "));
} catch (e) {
  log("FATAL:", e.message);
  await page.screenshot({ path: SHOT("fatal"), fullPage: true }).catch(() => {});
  results.push({ n: "fatal", ok: false });
}

const fails = results.filter((r) => !r.ok);
log(`\n${results.length - fails.length}/${results.length} passed${fails.length ? " — FAILURES: " + fails.map((f) => f.n).join(", ") : ""}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
