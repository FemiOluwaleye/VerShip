import { chromium } from "@playwright/test";
import fs from "fs";
const BASE = "http://localhost:5000";
const SCRATCH = "/tmp/claude-1000/-home-runner-workspace/fae0fc25-8cd1-4387-8536-9e190ba93d7f/scratchpad";
const browser = await chromium.launch({ executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
let fails = 0;
const check = (n, ok) => { console.log((ok ? "PASS" : "FAIL") + " — " + n); if (!ok) fails++; };

// 1. Landing: merged Start a Shipment + add-on checkbox
const p1 = await (await browser.newContext()).newPage();
await p1.goto(BASE, { waitUntil: "networkidle" });
const b1 = await p1.textContent("body");
check("landing shows 'Start a Shipment'", /Start a Shipment/i.test(b1));
check("landing has no separate Request Barrel tab", !/Request Barrel Drop-Off/.test(b1.replace(/Also request barrel drop-off[^]*?add-on\)/, "")));
check("drop-off add-on checkbox present", /Also request barrel drop-off/i.test(b1));
await p1.screenshot({ path: `${SCRATCH}/landing-merged.png` });

// 2. Customer History: additional cost strip + print buttons
const auth509 = JSON.parse(fs.readFileSync(`${SCRATCH}/auth-509.json`));
const p2 = await (await browser.newContext()).newPage();
await p2.addInitScript((u) => { localStorage.setItem("token", u.token); localStorage.setItem("user", JSON.stringify(u)); localStorage.setItem("is_login", 1); }, auth509);
await p2.goto(`${BASE}/history`, { waitUntil: "networkidle" });
await p2.waitForTimeout(1500);
const b2 = await p2.textContent("body");
check("customer sees Additional Costs strip", /Additional Costs/i.test(b2));
check("charge shows description + Paid", /Storage fee/.test(b2) && /\$25\.00/.test(b2));
check("Print button on bookings", (await p2.locator("button", { hasText: "Print" }).count()) > 0);
await p2.screenshot({ path: `${SCRATCH}/history-customer.png`, fullPage: true });

// 3. Provider History: + Additional Cost button
const auth381 = JSON.parse(fs.readFileSync(`${SCRATCH}/auth-381.json`));
const p3 = await (await browser.newContext()).newPage();
await p3.addInitScript((u) => { localStorage.setItem("token", u.token); localStorage.setItem("user", JSON.stringify(u)); localStorage.setItem("is_login", 1); }, auth381);
await p3.goto(`${BASE}/history`, { waitUntil: "networkidle" });
await p3.waitForTimeout(1500);
check("provider sees + Additional Cost button", (await p3.locator("button", { hasText: "Additional Cost" }).count()) > 0);
// open the modal
await p3.locator("button", { hasText: "Additional Cost" }).first().click();
await p3.waitForTimeout(400);
const b3 = await p3.textContent("body");
check("add-cost modal opens", /Request Additional Cost/i.test(b3) && /What is it for/i.test(b3));
await p3.screenshot({ path: `${SCRATCH}/history-provider-modal.png` });

await browser.close();
console.log(fails === 0 ? "ALL PASS" : fails + " FAILURES");
process.exit(fails ? 1 : 0);
