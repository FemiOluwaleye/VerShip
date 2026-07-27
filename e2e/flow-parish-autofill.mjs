// Does the parish chosen at the destination step pre-fill the recipient's
// (consignee) Parish field on the quotes page?
//   node e2e/flow-parish-autofill.mjs <BEFORE|AFTER>
import { chromium } from '@playwright/test';

const TAG = process.argv[2] || 'BEFORE';
const BASE = 'http://localhost:5000';
const OUT = '/tmp/claude-1000/-home-runner-workspace/61923129-7d3a-43fa-8227-e1c6d2d88a9b/scratchpad/shots';
const PARISH = process.env.PARISH || 'St. Ann';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await sleep(1200);
await page.fill('input[type="email"], input[name="email"]', 'e2e-user@vership.test');
await page.fill('input[type="password"], input[name="password"]', 'Test@1234');
await page.getByRole('button', { name: /log in/i }).first().click();
await sleep(3500);

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await sleep(2200);
await page.locator('[aria-label="Select origin"]').scrollIntoViewIfNeeded();
await page.locator('[aria-label="Select origin"]').click();
await sleep(600);
await page.locator('li[role=option] button:has-text("Pittsburgh, PA")').first().click();
await sleep(400);
await page.locator('[aria-label="Select destination"]').click();
await sleep(600);
await page.locator(`ul[aria-label="Destination"] li button:has-text("${PARISH}")`).first().click();
await sleep(400);
await page.locator('input[type="number"]').first().fill('2');
await sleep(300);
console.log(`chose destination parish: ${PARISH}`);

// what the API hands back
page.on('response', async (r) => {
  if (r.url().includes('available-quotes') || r.url().includes('getAvailableQuotes')) {
    try {
      const j = await r.json();
      console.log(`API bookingRequest.parish = ${JSON.stringify(j?.body?.bookingRequest?.parish)}`);
    } catch { /* ignore */ }
  }
});

await page.locator('#booking-form button:has-text("Get quotes")').click();
await sleep(7000);
console.log(`landed on: ${new URL(page.url()).pathname}`);

// The consignee Parish select — the last Parish select on the page belongs to
// the delivery/recipient block.
const selects = page.locator('select');
const n = await selects.count();
const vals = [];
for (let i = 0; i < n; i++) {
  const opts = await selects.nth(i).locator('option').allInnerTexts();
  if (opts.some((o) => /Select parish/i.test(o))) vals.push({ i, value: await selects.nth(i).inputValue() });
}
console.log(`parish selects found: ${vals.length} -> ${JSON.stringify(vals)}`);
const recipient = vals[vals.length - 1];
console.log(`RECIPIENT PARISH VALUE = "${recipient ? recipient.value : '(none)'}"`);

const target = recipient ? selects.nth(recipient.i) : null;
if (target) {
  await target.scrollIntoViewIfNeeded();
  await sleep(500);
  const b = await target.boundingBox();
  await page.screenshot({
    path: `${OUT}/07-recipient-parish-${TAG}.png`,
    clip: { x: Math.max(0, b.x - 330), y: Math.max(0, b.y - 120), width: 700, height: 200 },
  });
  console.log(`saved -> ${OUT}/07-recipient-parish-${TAG}.png`);
}
await browser.close();
