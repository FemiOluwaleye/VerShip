// Confirms the (i) tooltips are on the REGISTRATION pricing screen
// (/businessupload), that clicking one reveals its blurb, and that clicking it
// does not tick the checkbox it sits beside.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(`${BASE}/businessupload`, { waitUntil: 'networkidle' });
await sleep(1200);

// Pick the barrel shipment type so the sub-type options render. It's a native
// <select>, so it has to be driven with selectOption rather than a click.
await page.selectOption('select[name="shipmentType"]', 'barrel');
await sleep(600);

for (const label of ['Ship Your Own Barrel', 'Request Barrel Drop-Off']) {
  const tip = page.getByRole('button', { name: `About ${label}` });
  const present = await tip.count();
  console.log(`\n${label}: (i) button present = ${present > 0}`);
  if (!present) continue;

  const checkedBefore = await page.locator(`text=${label}`).first().isVisible();
  await tip.click();
  await sleep(300);
  const tooltip = page.getByRole('tooltip');
  console.log('  blurb:', (await tooltip.innerText()).slice(0, 90) + '…');
  // The checkbox must NOT have toggled from reading the help.
  const ticked = await page.locator('input[type=checkbox]').nth(label.startsWith('Ship') ? 0 : 1).isChecked();
  console.log('  checkbox toggled by reading help:', ticked);
  await tip.click();
  await sleep(200);
}

await page.screenshot({ path: '/tmp/infotip-registration.png', fullPage: false });
console.log('\npage errors:', errs.length ? errs : 'none');
await browser.close();
