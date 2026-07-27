// Proves the origin dropdown's coverage logic against a real browser.
//
// Run 1 uses the live provider list. Run 2 intercepts it and strips every
// Miami lane, so the "no forwarder -> Coming soon" branch is exercised for real
// rather than argued about.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});

async function run(label, stripCity) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  if (stripCity) {
    await page.route('**/website/providerlist', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      (json.body || []).forEach((p) => {
        if (p.businessInfo && Array.isArray(p.businessInfo.barrelPrices)) {
          p.businessInfo.barrelPrices = p.businessInfo.barrelPrices.filter(
            (bp) => !String(bp.originCountry || '').includes(stripCity)
          );
        }
      });
      await route.fulfill({ response: res, json });
    });
  }

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await sleep(1500);
  await page.getByRole('button', { name: 'Select origin' }).click();
  await sleep(400);

  const items = await page.locator('ul[aria-label="Origin"] li').all();
  const rows = [];
  for (const li of items) {
    const btn = li.locator('button');
    rows.push({
      name: (await btn.locator('span').first().innerText()).trim(),
      disabled: await btn.isDisabled(),
      // innerText applies the badge's `uppercase` styling, so compare case-insensitively.
      badge: /coming soon/i.test(await btn.innerText()),
    });
  }
  console.log(`\n--- ${label} ---`);
  rows.forEach((r) =>
    console.log(`  ${r.name.padEnd(22)} ${r.disabled ? 'disabled' : 'selectable'}${r.badge ? '  [Coming soon]' : ''}`)
  );
  if (errs.length) console.log('  page errors:', errs);
  await page.screenshot({ path: `/tmp/origins-${label.replace(/\W+/g, '-')}.png` });
  await ctx.close();
  return rows;
}

await run('live-data', null);
await run('miami-uncovered', 'Miami');

await browser.close();
