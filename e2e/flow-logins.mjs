import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000";
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const log = (...a) => console.log(...a);

async function newPage() {
  const p = await (await browser.newContext()).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("response", async (r) => { const u = r.url(); if ((u.includes("/website/") || u.includes("/api/")) && r.status() >= 400 && !u.includes("get-user-cookies") && !u.includes("get-notification")) { let b=""; try{b=(await r.text()).slice(0,120)}catch{}; errs.push(`HTTP ${r.status()} ${u.replace(BASE,"")} ${b}`);} });
  return { p, errs };
}
async function toast(p){ return (await p.locator("[data-sonner-toast]").allInnerTexts().catch(()=>[])).join(" | ") || (await p.locator(".alert").allInnerTexts().catch(()=>[])).join(" | "); }

try {
  // ---- CUSTOMER (role 1) ----
  { const { p, errs } = await newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await p.fill('input[name="email"]', "e2e-user@vership.test");
    await p.fill('input[name="password"]', "Test@1234");
    await p.click('form button[type="submit"]');
    await p.waitForTimeout(2800);
    const u = await p.evaluate(() => localStorage.getItem("user"));
    const role = u ? JSON.parse(u).role : null;
    log(`CUSTOMER  login -> url=${p.url().replace(BASE,"")} role=${role} toast="${await toast(p)}" errs=${errs.length?errs.join("; "):"none"}`);
  }
  // ---- PROVIDER (role 2) ----
  { const { p, errs } = await newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await p.fill('input[name="email"]', "e2e-provider@vership.test");
    await p.fill('input[name="password"]', "Test@1234");
    await p.click('form button[type="submit"]');
    await p.waitForTimeout(2800);
    const u = await p.evaluate(() => localStorage.getItem("user"));
    const role = u ? JSON.parse(u).role : null;
    log(`PROVIDER  login -> url=${p.url().replace(BASE,"")} role=${role} toast="${await toast(p)}" errs=${errs.length?errs.join("; "):"none"}`);
  }
  // ---- ADMIN (role 0) via /admin/login ----
  { const { p, errs } = await newPage();
    await p.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await p.fill('input[placeholder="Email address"]', "e2e-admin@vership.test");
    await p.fill('input[placeholder="Password"]', "Test@1234");
    await p.click('button#login');
    await p.waitForTimeout(3000);
    const tok = await p.evaluate(() => localStorage.getItem("admin_token"));
    log(`ADMIN     login -> url=${p.url().replace(BASE,"")} admin_token=${!!tok} toast="${await toast(p)}" errs=${errs.length?errs.join("; "):"none"}`);
  }
} catch (e) { log("SCRIPT ERROR:", e.message); } finally { await browser.close(); }
