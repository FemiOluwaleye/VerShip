// Header inspector: measures the nav's height, lists its buttons in DOM order,
// and screenshots it — logged out and logged in — so header changes are provable.
//   node e2e/hdr.mjs <label> [--login=user|none] [--path=/] [--w=1440]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const label = args.filter((a) => !a.startsWith('--'))[0] || 'hdr';
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const BASE = 'http://localhost:5000';
const OUT = '/tmp/claude-1000/-home-runner-workspace/61923129-7d3a-43fa-8227-e1c6d2d88a9b/scratchpad/shots';
const login = flag('login', 'none');
const path = flag('path', '/');
const width = parseInt(flag('w', '1440'), 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();

if (login !== 'none') {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(1200);
  await page.fill('input[type="email"], input[name="email"]', 'e2e-user@vership.test');
  await page.fill('input[type="password"], input[name="password"]', 'Test@1234');
  await page.getByRole('button', { name: /log in/i }).first().click();
  await sleep(3500);
  console.log(`login landed on: ${new URL(page.url()).pathname}`);
}

await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
await sleep(2000);

const nav = page.locator('nav[aria-label="Main"]');
const box = await nav.boundingBox();
console.log(`nav height : ${box ? box.height.toFixed(1) : 'n/a'}px  (viewport ${width}px)`);

// Buttons in DOM order, restricted to the desktop bar, tells us the visual order.
const items = await nav.evaluate((el) => {
  const out = [];
  el.querySelectorAll('button, a').forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const t = (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    out.push({ t: t || '(logo/icon)', x: Math.round(r.x), fs: getComputedStyle(b).fontSize });
  });
  return out.sort((a, b) => a.x - b.x);
});
console.log('items left→right:');
items.forEach((i) => console.log(`   x=${String(i.x).padStart(4)}  ${i.fs.padEnd(6)}  ${i.t}`));

const logo = await nav.locator('img').first().boundingBox();
console.log(`logo x      : ${logo ? Math.round(logo.x) : 'n/a'}`);

const file = `${OUT}/${label}.png`;
await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height: Math.ceil((box?.height || 100) + 8) } });
console.log(`saved -> ${file}`);
await browser.close();
