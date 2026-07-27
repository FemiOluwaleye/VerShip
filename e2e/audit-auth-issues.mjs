// Second half of the independent re-audit: the checks that need a logged-in
// customer or forwarder. Same convention — reports whether the ORIGINAL problem
// still exists.
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5000';
const OUT = '/tmp/claude-1000/-home-runner-workspace/61923129-7d3a-43fa-8227-e1c6d2d88a9b/scratchpad/audit';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, title, issuePresent, evidence) => {
  results.push({ id, title, issuePresent });
  console.log(`${String(id).padStart(2)}. [${issuePresent ? 'ISSUE PRESENT' : 'issue absent '}] ${title}\n      ${evidence}`);
};

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(1400);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill('Test@1234');
  await page.getByRole('button', { name: /log in/i }).first().click();
  await sleep(4200);
  const toasts = await page.locator('[data-sonner-toast], li[role=status]').allInnerTexts().catch(() => []);
  if (/too many login attempts/i.test(toasts.join(' '))) throw new Error('RATE LIMITED — restart server to reset the in-memory limiter');
  return new URL(page.url()).pathname;
}

/* ============ CUSTOMER: #3 (logged-in header) and #7 (parish autofill) ============ */
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const landed = await login(page, 'e2e-user@vership.test');
  console.log(`   (customer login landed on ${landed})`);

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(2500);
  const nav = page.locator('nav[aria-label="Main"]');
  const h = (await nav.boundingBox()).height.toFixed(1);
  const right = await nav.evaluate((el) => {
    const out = [];
    el.querySelectorAll('button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width && r.x > 900) out.push({ t: b.innerText.trim().replace(/\s+/g, ' '), x: Math.round(r.x) });
    });
    return out.sort((a, b) => a.x - b.x);
  });
  const profileBtn = right.find((r) => !/get quotes/i.test(r.t));
  const saysProfileWord = /\bProfile\b/i.test(profileBtn?.t || '');
  check(3, 'Logged-in header: profile block still shows a redundant "Profile" label / not compact',
    saysProfileWord || +h > 80,
    `nav height=${h}px | right-hand items: ${JSON.stringify(right.map((r) => r.t))} | profile chip text: "${profileBtn?.t}"`);
  await page.screenshot({ path: `${OUT}/03-header-loggedin.png`, clip: { x: 0, y: 0, width: 1440, height: Math.ceil(+h + 6) } });

  // #7 — choose a parish at the destination step, then read the recipient's parish field.
  const PARISH = 'St. Ann';
  await page.locator('[aria-label="Select origin"]').scrollIntoViewIfNeeded();
  await page.locator('[aria-label="Select origin"]').click();
  await sleep(700);
  await page.locator('li[role=option] button:has-text("Pittsburgh, PA")').first().click();
  await sleep(400);
  await page.locator('[aria-label="Select destination"]').click();
  await sleep(700);
  await page.locator(`ul[aria-label="Destination"] li button:has-text("${PARISH}")`).first().click();
  await sleep(400);
  await page.locator('input[type=number]').first().fill('2');
  await sleep(300);
  await page.locator('#booking-form button:has-text("Get quotes")').click();
  await sleep(7000);

  const path = new URL(page.url()).pathname;
  const parishSelects = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('select').forEach((s, i) => {
      const opts = [...s.options].map((o) => o.textContent);
      if (opts.some((o) => /select parish/i.test(o))) out.push({ i, value: s.value });
    });
    return out;
  });
  const recipient = parishSelects[parishSelects.length - 1];
  check(7, 'Parish chosen at destination does NOT pre-fill the recipient address form',
    !recipient || recipient.value !== PARISH,
    `landed on ${path} | parish selects on page: ${JSON.stringify(parishSelects)} | recipient parish value = "${recipient?.value ?? '(none)'}" (expected "${PARISH}")`);

  // quotes must still be returned for a non-Kingston parish
  const body = await page.locator('body').innerText();
  const prices = (body.match(/\$\s?[\d,]+(\.\d\d)?/g) || []).slice(0, 5);
  console.log(`      (side-check) quotes returned for ${PARISH}: ${prices.join(', ') || 'NONE'}`);

  if (recipient) {
    const el = page.locator('select').nth(recipient.i);
    await el.scrollIntoViewIfNeeded();
    await sleep(500);
    const b = await el.boundingBox();
    await page.screenshot({ path: `${OUT}/07-recipient-parish.png`, clip: { x: Math.max(0, b.x - 330), y: Math.max(0, b.y - 120), width: 700, height: 200 } });
  }
  await page.context().close();
}

/* ============ FORWARDER: #11 tooltips, #12 Stripe CTA ============ */
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const landed = await login(page, 'e2e-provider@vership.test');
  console.log(`   (forwarder login landed on ${landed})`);

  await page.goto(`${BASE}/businessuploadnext`, { waitUntil: 'networkidle' });
  await sleep(2500);
  await page.locator('select').first().selectOption({ label: 'Barrel' });
  await sleep(1400);

  const infoBtns = await page.locator('[aria-label^="About Ship Your Own Barrel"], [aria-label^="About Request Barrel Drop-Off"]').count();
  const block = page.locator('label:has-text("Sub-shipment Type")').locator('xpath=..');
  const tickedBefore = (await block.innerText()).includes('✓');
  let tipText = '', tickedAfter = tickedBefore;
  if (infoBtns) {
    await page.locator('[aria-label="About Ship Your Own Barrel"]').click();
    await sleep(700);
    tipText = (await page.locator('[role=tooltip]').first().innerText().catch(() => '')).slice(0, 90);
    tickedAfter = (await block.innerText()).includes('✓');
  }
  check(11, 'No (i) explanation beside "Ship Your Own Barrel" / "Request Barrel Drop-Off"',
    infoBtns < 2 || !tipText || tickedAfter !== tickedBefore,
    `(i) buttons: ${infoBtns} | tooltip on click: "${tipText}…" | option got selected by reading help: ${tickedAfter !== tickedBefore} (must be false)`);
  if (infoBtns) {
    const b = await block.boundingBox();
    await page.screenshot({ path: `${OUT}/11-tooltip.png`, clip: { x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12), width: Math.min(b.width + 24, 1268 - b.x), height: b.height + 200 } });
  }

  // #12 — the callout only renders for a forwarder without payments set up.
  await page.goto(`${BASE}/businessProfile`, { waitUntil: 'networkidle' });
  await sleep(3000);
  const profText = await page.locator('body').innerText();
  const bundleHasOld = await page.evaluate(async () => {
    // Search the shipped JS bundles for the old label, independent of UI state.
    const srcs = [...document.querySelectorAll('script[src]')].map((s) => s.src);
    let oldHit = false, newHit = false;
    for (const s of srcs) {
      const t = await (await fetch(s)).text();
      if (/Connect Stripe|Connect to Stripe/.test(t)) oldHit = true;
      if (/Start Collecting Payments/.test(t)) newHit = true;
    }
    return { oldHit, newHit };
  });
  check(12, '"Connect Stripe" wording not changed to "Start Collecting Payments"',
    bundleHasOld.oldHit || !bundleHasOld.newHit,
    `shipped bundle contains old "Connect Stripe": ${bundleHasOld.oldHit} | contains "Start Collecting Payments": ${bundleHasOld.newHit} | this account currently shows: "${(profText.match(/Stripe[^\n]{0,80}/) || ['(connected — callout hidden)'])[0]}"`);
  await page.context().close();
}

const still = results.filter((r) => r.issuePresent);
console.log(`\n=== ${results.length} checks | ${still.length} issue(s) still present ===`);
still.forEach((r) => console.log(`  #${r.id} ${r.title}`));
await browser.close();
