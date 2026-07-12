import { chromium } from "@playwright/test";
const BASE = "http://localhost:5000";
const exe = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const log = (...a) => console.log(...a);
const stamp = "e2e" + (process.env.STAMP || "X");

function trackApi(p, errs) {
  p.on("pageerror", (e) => errs.push("PAGEERR " + e.message));
  p.on("response", async (r) => { const u = r.url(); if ((u.includes("/website/") || u.includes("/api/")) && r.status() >= 400) { let b=""; try{b=(await r.text()).slice(0,160)}catch{}; errs.push(`HTTP ${r.status()} ${u.replace(BASE,"")} ${b}`);} });
}
const toast = async (p) => (await p.locator("[data-sonner-toast]").allInnerTexts().catch(()=>[])).join(" | ");

try {
  // ---------- 1. CONTACT FORM (public write) ----------
  { const p = await (await browser.newContext()).newPage(); const errs=[]; trackApi(p, errs);
    let apiOk=null; p.on("response", async r=>{ if(r.url().includes("contact")) { try{apiOk=(await r.json())}catch{} } });
    await p.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1000);
    await p.fill('input[name="first_name"]', "E2E");
    await p.fill('input[name="last_name"]', "Tester");
    await p.fill('input[name="email"]', `${stamp}@vership.test`);
    await p.locator('input[type="tel"]').first().fill("4155550123");
    await p.fill('textarea', "Automated e2e contact message. Please ignore.");
    await p.click('form button[type="submit"]');
    await p.waitForTimeout(2500);
    log(`CONTACT submit -> toast="${await toast(p)}" api=${apiOk?JSON.stringify(apiOk).slice(0,120):"(none captured)"} errs=${errs.filter(e=>!e.includes("contact")).join("; ")||"none"}`);
  }

  // ---------- 2. ADMIN: add FAQ, verify it persists ----------
  { const p = await (await browser.newContext()).newPage(); const errs=[]; trackApi(p, errs);
    await p.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    await p.fill('input[placeholder="Email address"]', "e2e-admin@vership.test");
    await p.fill('input[placeholder="Password"]', "Test@1234");
    await p.click('button#login');
    await p.waitForTimeout(2500);
    const q = `E2E question ${stamp}?`;
    await p.goto(`${BASE}/admin/addfaq`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await p.fill('#question', q);
    await p.fill('#answer', "E2E answer — automated test.");
    await p.click('form button[type="submit"]');
    await p.waitForTimeout(2500);
    log(`ADMIN addfaq -> url=${p.url().replace(BASE,"")} toast="${await toast(p)}"`);
    // verify in list
    await p.goto(`${BASE}/admin/faqlist`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const listBody = await p.locator("body").innerText().catch(()=> "");
    log(`ADMIN faqlist contains new FAQ: ${listBody.includes(stamp)}`);
    log(`  errs=${errs.join("; ")||"none"}`);
  }
} catch (e) { log("SCRIPT ERROR:", e.message); } finally { await browser.close(); }
