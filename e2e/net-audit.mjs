import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5000";
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const auth = JSON.parse(fs.readFileSync(path.join(__dirname, ".auth.json"), "utf-8"));

function storageFor(session) {
  if (session === "user") return { token: auth.user.token, user: JSON.stringify(auth.user.user), is_login: "1" };
  if (session === "provider") return { token: auth.provider.token, user: JSON.stringify(auth.provider.user), is_login: "1" };
  if (session === "admin") return { admin_token: auth.admin.admin_token, admin_userData: JSON.stringify(auth.admin.admin_userData) };
  return {};
}

// representative pages per session that trigger data fetches
const ROUTES = [
  ["public", "/"], ["public", "/forwarders"], ["public", "/about"], ["public", "/contact"], ["public", "/help"], ["public", "/faqs"],
  ["user", "/profile"], ["user", "/quotes"], ["user", "/quotes-shipown"], ["user", "/history"], ["user", "/detail"],
  ["user", "/chat"], ["user", "/cards"], ["user", "/notifications"], ["user", "/support"], ["user", "/edit"], ["user", "/faqs"],
  ["provider", "/request"], ["provider", "/earning"], ["provider", "/current"], ["provider", "/delivered"],
  ["admin", "/admin/dashboard"], ["admin", "/admin/userlist"], ["admin", "/admin/providerlist"], ["admin", "/admin/contactlist"],
  ["admin", "/admin/activeridelist"], ["admin", "/admin/ratinglist"], ["admin", "/admin/reportlist"], ["admin", "/admin/bannerlist"],
  ["admin", "/admin/faqlist"], ["admin", "/admin/bookingcompleted"], ["admin", "/admin/Bookinglist"], ["admin", "/admin/cookielist"],
];

const failures = [];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });

for (const [session, route] of ROUTES) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const store = storageFor(session);
  await page.addInitScript((kv) => { for (const k in kv) try { localStorage.setItem(k, kv[k]); } catch {} }, store);
  const bad = [];
  page.on("response", async (r) => {
    const u = r.url();
    if ((u.includes("/website/") || u.includes("/api/")) && r.status() >= 400) {
      let body = ""; try { body = (await r.text()).slice(0, 200); } catch {}
      bad.push({ status: r.status(), url: u.replace(BASE, ""), body });
    }
  });
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  if (bad.length) { failures.push({ session, route, bad }); console.log(`FAIL [${session}] ${route}`); for (const b of bad) console.log(`   ${b.status} ${b.url} :: ${b.body}`); }
  else console.log(`ok   [${session}] ${route}`);
  await ctx.close();
}

await browser.close();
console.log(`\n==== ${failures.length} route(s) with failing API calls ====`);
fs.writeFileSync("/tmp/claude-1000/-home-runner-workspace/b825b880-a714-437f-a048-5c41f7510c04/scratchpad/net-audit.json", JSON.stringify(failures, null, 2));
