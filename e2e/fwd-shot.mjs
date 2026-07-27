// Log in as the seeded forwarder, open the pricing/sub-type step, re-select
// "Barrel" to reveal the sub-shipment options, and screenshot that block.
//   node e2e/fwd-shot.mjs <outfile-label>
import { chromium } from '@playwright/test';

const label = process.argv[2] || 'fwd';
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

await page.goto(`${BASE}/businessuploadnext`, { waitUntil: 'networkidle' });
await sleep(2500);
await page.locator('select').first().selectOption({ label: 'Barrel' });
await sleep(1500);

const block = page.locator('label:has-text("Sub-shipment Type")').locator('xpath=..');
await block.scrollIntoViewIfNeeded();
await sleep(500);
console.log(`sub-type block text: ${(await block.innerText()).replace(/\n+/g, ' | ')}`);
console.log(`info buttons present: ${await page.locator('[aria-label*="About Ship Your Own Barrel"], [aria-label*="About Request Barrel Drop-Off"]').count()}`);

const b = await block.boundingBox();
await page.screenshot({
  path: `${OUT}/${label}.png`,
  clip: { x: b.x - 12, y: b.y - 12, width: Math.min(b.width + 24, 1280 - b.x + 12), height: b.height + 24 },
});
console.log(`saved -> ${OUT}/${label}.png`);
await browser.close();
