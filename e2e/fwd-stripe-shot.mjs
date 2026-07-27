// Screenshot the forwarder's Stripe-connect callout on the business profile.
//   node e2e/fwd-stripe-shot.mjs <label>
import { chromium } from '@playwright/test';

const label = process.argv[2] || 'stripe';
const BASE = 'http://localhost:5000';
const OUT = '/tmp/claude-1000/-home-runner-workspace/61923129-7d3a-43fa-8227-e1c6d2d88a9b/scratchpad/shots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await sleep(1400);
await page.locator('input[type=email]').fill('e2e-provider@vership.test');
await page.locator('input[type=password]').fill('Test@1234');
await page.getByRole('button', { name: /log in/i }).first().click();
await sleep(4000);

await page.goto(`${BASE}/businessProfile`, { waitUntil: 'networkidle' });
await sleep(3000);

// Match either wording so this script works before and after the copy change.
const callout = page
  .locator('p:has-text("Stripe account is not connected"), p:has-text("You can\'t be paid yet")')
  .locator('xpath=..');
if (!(await callout.count())) {
  console.log('Stripe callout NOT shown (account already connected?)');
  console.log((await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
  await browser.close();
  process.exit(0);
}
await callout.scrollIntoViewIfNeeded();
await sleep(500);
console.log(`callout text: ${(await callout.innerText()).replace(/\n+/g, ' | ')}`);
const btns = await callout.locator('button').allInnerTexts();
console.log(`button label(s): ${JSON.stringify(btns)}`);
const b = await callout.boundingBox();
await page.screenshot({ path: `${OUT}/${label}.png`, clip: { x: b.x - 10, y: b.y - 10, width: b.width + 20, height: b.height + 20 } });
console.log(`saved -> ${OUT}/${label}.png`);
await browser.close();
