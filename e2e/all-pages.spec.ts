import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Real happy-path + browser coverage for EVERY route in the app.
// Auth fixtures (real JWTs + user payloads) are produced by
// server/seed-test-users.js -> e2e/.auth.json.
const BASE = "http://localhost:5000";
const auth = JSON.parse(fs.readFileSync(path.join(__dirname, ".auth.json"), "utf-8"));

type Session = "public" | "user" | "provider" | "admin";

// localStorage the app expects for each session (mirrors what the Login pages set).
function storageFor(session: Session): Record<string, string> {
  if (session === "user")
    return { token: auth.user.token, user: JSON.stringify(auth.user.user), is_login: "1" };
  if (session === "provider")
    return { token: auth.provider.token, user: JSON.stringify(auth.provider.user), is_login: "1" };
  if (session === "admin")
    return { admin_token: auth.admin.admin_token, admin_userData: JSON.stringify(auth.admin.admin_userData) };
  return {};
}

// Routes grouped by the session needed to reach them.
const ROUTES: { session: Session; path: string; name: string }[] = [
  // ---------- PUBLIC ----------
  { session: "public", path: "/", name: "Home / Index" },
  { session: "public", path: "/signup", name: "Signup" },
  { session: "public", path: "/login", name: "Login" },
  { session: "public", path: "/forgot", name: "Forgot password" },
  { session: "public", path: "/verification", name: "Verification (OTP)" },
  { session: "public", path: "/forgot-verification", name: "Forgot verification" },
  { session: "public", path: "/forgot-password-reset", name: "Forgot password reset" },
  { session: "public", path: "/reset", name: "Reset password" },
  { session: "public", path: "/about", name: "About" },
  { session: "public", path: "/terms", name: "Terms" },
  { session: "public", path: "/privacy", name: "Privacy" },
  { session: "public", path: "/contact", name: "Contact" },
  { session: "public", path: "/help", name: "Help" },
  { session: "public", path: "/cookie-policy", name: "Cookie policy" },
  { session: "public", path: "/freight-content", name: "Freight content" },
  { session: "public", path: "/refund-policy", name: "Refund policy" },
  { session: "public", path: "/forwarders", name: "All forwarders" },
  { session: "public", path: "/type", name: "Account type" },
  { session: "public", path: "/businessSignup", name: "Business signup" },
  { session: "public", path: "/verified", name: "Verified" },
  { session: "public", path: "/businessCreateAccount", name: "Business create account" },
  { session: "public", path: "/businessdoument", name: "Business document" },
  { session: "public", path: "/businesscontact", name: "Business contact" },
  { session: "public", path: "/businesstime", name: "Business time" },
  { session: "public", path: "/businesspolicies", name: "Business policies" },
  { session: "public", path: "/businessupload", name: "Business upload" },
  { session: "public", path: "/businessdetail", name: "Business detail" },
  { session: "public", path: "/businessverification", name: "Business verification" },
  { session: "public", path: "/barrel-request/1", name: "Barrel request form" },

  // ---------- USER (role 1, protected) ----------
  { session: "user", path: "/profile", name: "Profile" },
  { session: "user", path: "/quotes", name: "Quotes" },
  { session: "user", path: "/quotes-shipown", name: "Quotes shipown" },
  { session: "user", path: "/quotes-shipown-history/1", name: "Quotes shipown history" },
  { session: "user", path: "/detail", name: "Details" },
  { session: "user", path: "/history", name: "History" },
  { session: "user", path: "/support", name: "Support" },
  { session: "user", path: "/edit", name: "Edit profile" },
  { session: "user", path: "/chat", name: "Chat" },
  { session: "user", path: "/cards", name: "Cards" },
  { session: "user", path: "/faqs", name: "FAQs" },
  { session: "user", path: "/notifications", name: "Notifications" },
  { session: "user", path: "/delete", name: "Delete account" },
  { session: "user", path: "/businessProfile", name: "Business profile" },
  { session: "user", path: "/businessedit", name: "Business edit" },
  { session: "user", path: "/businesseditnext", name: "Business edit next" },
  { session: "user", path: "/businesseditcontact", name: "Business edit contact" },
  { session: "user", path: "/editnextdocument", name: "Edit next document" },
  { session: "user", path: "/businesseditpolicies", name: "Business edit policies" },
  { session: "user", path: "/businesstimeedit", name: "Business time edit" },
  { session: "user", path: "/edittimelinenext", name: "Edit timeline next" },
  { session: "user", path: "/businessuploadnext", name: "Business upload next" },

  // ---------- PROVIDER (role 2, protected) ----------
  { session: "provider", path: "/request", name: "Provider requests" },
  { session: "provider", path: "/earning", name: "Provider earnings" },
  { session: "provider", path: "/current", name: "Provider current" },
  { session: "provider", path: "/delivered", name: "Provider delivered" },
  { session: "provider", path: "/norequest", name: "Provider no-request" },

  // ---------- ADMIN ----------
  { session: "public", path: "/admin/login", name: "Admin login" },
  { session: "admin", path: "/admin/dashboard", name: "Admin dashboard" },
  { session: "admin", path: "/admin/profile", name: "Admin profile" },
  { session: "admin", path: "/admin/password", name: "Admin password" },
  { session: "admin", path: "/admin/userlist", name: "Admin user list" },
  { session: "admin", path: "/admin/providerlist", name: "Admin provider list" },
  { session: "admin", path: "/admin/contactlist", name: "Admin contact list" },
  { session: "admin", path: "/admin/privacypolicy", name: "Admin privacy policy" },
  { session: "admin", path: "/admin/aboutus", name: "Admin about us" },
  { session: "admin", path: "/admin/termsConditions", name: "Admin terms" },
  { session: "admin", path: "/admin/cookiepolicy", name: "Admin cookie policy" },
  { session: "admin", path: "/admin/freightforwarder", name: "Admin freight forwarder" },
  { session: "admin", path: "/admin/refundpolicy", name: "Admin refund policy" },
  { session: "admin", path: "/admin/faqlist", name: "Admin FAQ list" },
  { session: "admin", path: "/admin/addfaq", name: "Admin add FAQ" },
  { session: "admin", path: "/admin/updatefaq/1", name: "Admin edit FAQ" },
  { session: "admin", path: "/admin/activeridelist", name: "Admin active bookings" },
  { session: "admin", path: "/admin/ratinglist", name: "Admin ratings" },
  { session: "admin", path: "/admin/reportlist", name: "Admin reports" },
  { session: "admin", path: "/admin/bannerlist", name: "Admin banner list" },
  { session: "admin", path: "/admin/addbanner", name: "Admin add banner" },
  { session: "admin", path: "/admin/updatebanner/1", name: "Admin edit banner" },
  { session: "admin", path: "/admin/cookielist", name: "Admin cookie list" },
  { session: "admin", path: "/admin/addcookie", name: "Admin add cookie" },
  { session: "admin", path: "/admin/updatecookie/1", name: "Admin edit cookie" },
  { session: "admin", path: "/admin/bookingcompleted", name: "Admin completed bookings" },
  { session: "admin", path: "/admin/Bookinglist", name: "Admin booking list" },
];

// Ignore noise that is expected in a seeded/empty-data staging env and does not
// indicate a broken page (network 4xx/5xx from empty tables, missing 3rd-party
// keys, favicon, etc). A genuine React render crash surfaces as a `pageerror`.
const IGNORED_PAGEERROR = [
  /ResizeObserver/i,
  /Stripe/i,          // Stripe.js not configured in staging
  /firebase/i,        // FCM messaging not configured
];

for (const route of ROUTES) {
  test(`[${route.session}] ${route.name} (${route.path})`, async ({ page }) => {
    const store = storageFor(route.session);
    // Seed auth into localStorage before any app code runs on this origin.
    await page.addInitScript((kv) => {
      try {
        for (const k in kv) window.localStorage.setItem(k, kv[k]);
      } catch (e) {}
    }, store);

    const info = await checkPageWithPath(page, route.name, route.path);
    console.log(`OK  [${route.session}] ${route.name} — ${info.buttons} clickable controls, ${info.bodyLen} chars`);
  });
}

async function checkPageWithPath(page: Page, name: string, routePath: string) {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => {
    if (!IGNORED_PAGEERROR.some((re) => re.test(e.message))) pageErrors.push(e.message);
  });

  await page.goto(BASE + routePath, { waitUntil: "domcontentloaded" }).catch(() => null);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);

  expect(pageErrors, `Uncaught JS errors on "${name}":\n${pageErrors.join("\n")}`).toHaveLength(0);

  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
  const interactiveCount = await page
    .locator("button, a, input, select, textarea, [role=button]")
    .count();
  expect(
    bodyText.trim().length > 15 || interactiveCount > 0,
    `"${name}" rendered a blank page (no text, no interactive elements)`
  ).toBeTruthy();

  const clickables = page.locator("button:visible, [role=button]:visible, a[href]:visible");
  const n = await clickables.count();
  const broken: string[] = [];
  for (let i = 0; i < n; i++) {
    const el = clickables.nth(i);
    const disabled = await el.isDisabled().catch(() => false);
    if (disabled) continue;
    const box = await el.boundingBox().catch(() => null);
    if (!box || box.width === 0 || box.height === 0) {
      const label =
        (await el.innerText().catch(() => "")).slice(0, 40) ||
        (await el.getAttribute("aria-label")) ||
        "(no label)";
      broken.push(label);
    }
  }
  expect(
    broken,
    `"${name}" has visible controls with no hit box (not clickable): ${broken.join(" | ")}`
  ).toHaveLength(0);

  return { buttons: n, bodyLen: bodyText.trim().length };
}
