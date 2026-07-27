// Screenshot a single element (auto-scrolls it into view) and print its text.
//   node e2e/elshot.mjs <path> "<selector>" <outfile> [--w=1280] [--h=900]
//                       [--wait=1800] [--pad=16] [--click="sel"] [--nth=0]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const [path, selector, out] = pos;
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};

const BASE = process.env.BASE || 'http://localhost:5000';
const width = parseInt(flag('w', '1280'), 10);
const height = parseInt(flag('h', '900'), 10);
const wait = parseInt(flag('wait', '1800'), 10);
const pad = parseInt(flag('pad', '16'), 10);
const nth = parseInt(flag('nth', '0'), 10);
const clickSel = flag('click', '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
await sleep(wait);
if (clickSel) {
  const c = page.locator(clickSel).first();
  if (await c.count()) { await c.click(); await sleep(wait); }
  else console.log(`click: NOT FOUND -> ${clickSel}`);
}

const el = page.locator(selector).nth(nth);
const count = await page.locator(selector).count();
console.log(`matches  : ${count}`);
if (!count) { console.log('SELECTOR NOT FOUND'); await browser.close(); process.exit(1); }

await el.scrollIntoViewIfNeeded();
await sleep(400);
console.log(`text     : ${(await el.innerText()).replace(/\n/g, ' | ').slice(0, 400)}`);
// Screenshot the element plus a little breathing room around it.
const box = await el.boundingBox();
await page.screenshot({
  path: out,
  clip: {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(width - Math.max(0, box.x - pad), box.width + pad * 2),
    height: box.height + pad * 2,
  },
});
console.log(`failedReqs: ${bad.length}${bad.length ? '\n  ' + bad.join('\n  ') : ''}`);
console.log(`pageErrors: ${errs.length}${errs.length ? '\n  ' + errs.join('\n  ') : ''}`);
console.log(`saved -> ${out}`);
await browser.close();
