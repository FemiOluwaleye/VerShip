// Reusable real-browser screenshot + text-probe helper for the cleanup pass.
//
//   node e2e/shot.mjs <path> <outfile> [--w=1280] [--h=900] [--full] [--wait=1500]
//                                      [--click="selector"] [--grep="regex"]
//
// Prints the page's visible text length, any matched --grep hits, and every
// failed network request, so a run doubles as the "happy path" check.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const [path = '/', out = '/tmp/shot.png'] = args.filter((a) => !a.startsWith('--'));
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const has = (n) => args.includes(`--${n}`);

const BASE = process.env.BASE || 'http://localhost:5000';
const width = parseInt(flag('w', '1280'), 10);
const height = parseInt(flag('h', '900'), 10);
const wait = parseInt(flag('wait', '1800'), 10);
const clickSel = flag('click', '');
const grep = flag('grep', '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width, height } });
const page = await ctx.newPage();

const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch((e) => console.log('goto:', e.message));
await sleep(wait);

if (clickSel) {
  const loc = page.locator(clickSel).first();
  if (await loc.count()) { await loc.click(); await sleep(wait); }
  else console.log(`click: NOT FOUND -> ${clickSel}`);
}

await page.screenshot({ path: out, fullPage: has('full') });

const text = await page.locator('body').innerText();
console.log(`URL      : ${page.url()}`);
console.log(`viewport : ${width}x${height}${has('full') ? ' (fullPage)' : ''}`);
console.log(`docHeight: ${await page.evaluate(() => document.documentElement.scrollHeight)}px`);
console.log(`textLen  : ${text.length}`);
if (grep) {
  const re = new RegExp(grep, 'gi');
  const hits = text.match(re) || [];
  console.log(`grep /${grep}/ : ${hits.length} hit(s)${hits.length ? ' -> ' + JSON.stringify(hits.slice(0, 12)) : ''}`);
}
console.log(`failedReqs: ${bad.length}${bad.length ? '\n  ' + bad.join('\n  ') : ''}`);
console.log(`pageErrors: ${errs.length}${errs.length ? '\n  ' + errs.join('\n  ') : ''}`);
console.log(`saved -> ${out}`);

await browser.close();
