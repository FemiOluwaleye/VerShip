// Happy path for the parish destination change:
//   log in -> pick origin -> open destination -> confirm all 14 parishes are
//   listed -> pick a NON-Kingston parish -> submit -> land on quotes with at
//   least one quote (proving country-level matching still finds forwarders who
//   priced their lane as "Kingston, Jamaica").
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5000';
const OUT = '/tmp/claude-1000/-home-runner-workspace/61923129-7d3a-43fa-8227-e1c6d2d88a9b/scratchpad/shots';
const PARISH = process.env.PARISH || 'St. Ann';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

// login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await sleep(1200);
await page.fill('input[type="email"], input[name="email"]', 'e2e-user@vership.test');
await page.fill('input[type="password"], input[name="password"]', 'Test@1234');
await page.getByRole('button', { name: /log in/i }).first().click();
await sleep(3500);
console.log(`1. logged in -> ${new URL(page.url()).pathname}`);

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await sleep(2200);

// origin
await page.locator('[aria-label="Select origin"]').scrollIntoViewIfNeeded();
await page.locator('[aria-label="Select origin"]').click();
await sleep(600);
await page.locator('li[role=option] button:has-text("Pittsburgh, PA")').first().click();
await sleep(500);
console.log('2. origin = Pittsburgh, PA');

// destination -> parish list
await page.locator('[aria-label="Select destination"]').click();
await sleep(700);
const parishes = await page.locator('ul[aria-label="Destination"] li').allInnerTexts();
console.log(`3. destination options (${parishes.length}): ${JSON.stringify(parishes)}`);
await page.screenshot({ path: `${OUT}/06-destination-AFTER.png`, clip: await (async () => {
  const b = await page.locator('[aria-label="Select destination"]').boundingBox();
  return { x: b.x - 20, y: b.y - 60, width: b.width + 40, height: 480 };
})() });

await page.locator(`ul[aria-label="Destination"] li button:has-text("${PARISH}")`).first().click();
await sleep(600);
console.log(`4. picked parish: ${PARISH} | control now reads: "${await page.locator('[aria-label="Select destination"]').innerText()}"`);

// quantity
const qty = page.locator('input[type="number"]').first();
await qty.fill('2');
await sleep(300);
console.log('5. quantity = 2');

// capture what we POST
let posted = null;
page.on('request', (r) => {
  if (r.url().includes('save-booking-request') || r.url().includes('booking-request')) {
    try { posted = JSON.parse(r.postData() || '{}'); } catch { /* ignore */ }
  }
});

await page.locator('#booking-form button:has-text("Get quotes")').click();
await sleep(6000);
console.log(`6. POST payload destination="${posted?.destination}" parish="${posted?.parish}" dest_lat=${posted?.destination_lat}`);
console.log(`7. landed on: ${new URL(page.url()).pathname}`);

const body = await page.locator('body').innerText();
const noQuotes = /no quotes|no providers|not found/i.test(body);
const priceHits = body.match(/\$\s?[\d,]+(\.\d\d)?/g) || [];
console.log(`8. quotes page shows prices: ${priceHits.slice(0, 6).join(', ') || '(none)'} | "no quotes" message: ${noQuotes}`);
await page.screenshot({ path: `${OUT}/06-quotes-AFTER.png`, fullPage: false });
console.log(`failedReqs: ${bad.length}${bad.length ? '\n  ' + bad.slice(0, 8).join('\n  ') : ''}`);
await browser.close();
